/**
 * Supabase 서버 클라이언트 — DB 스토어(supabaseStore)와 파일 저장(lib/files/storage)이 공유하는
 * lazy 싱글턴. env 2종(NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)이 모두 있을 때만 생성된다.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger';

let clientInstance: SupabaseClient | null = null;

/** Supabase env 2종이 모두 설정돼 있는가 — 스토어/스토리지 선택 기준(store.ts와 동일 조건) */
export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** 서버 전용(service role) Supabase 클라이언트를 반환한다 — env 없으면 throw(호출 전 hasSupabaseEnv 확인) */
export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) return clientInstance;
  if (!hasSupabaseEnv()) throw new Error('Supabase env 미설정 — NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 필요');
  // URL 오타 방어: 앞뒤 공백·개행과 끝의 슬래시(들)를 제거한다. 끝 슬래시/개행이 남으면
  // 클라이언트가 `//rest/v1/...`를 만들어 게이트웨이가 "Invalid path specified in request URL"로
  // 거부한다(대시보드에서 값을 붙여넣을 때 흔한 실수).
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL as string).trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY as string).trim();
  // 형식이 표준 프로젝트 URL(https://<ref>.supabase.co)이 아니면 원인 추적용으로 경고만 남긴다(차단 아님).
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    logger.warn(
      `NEXT_PUBLIC_SUPABASE_URL 형식이 비정상입니다("${url}") — ` +
        'Supabase → Settings → API → Project URL(https://<ref>.supabase.co)을 경로·끝슬래시 없이 넣으세요.',
    );
  }
  clientInstance = createClient(url, key, { auth: { persistSession: false } });
  return clientInstance;
}
