/**
 * Supabase 서버 클라이언트 — DB 스토어(supabaseStore)와 파일 저장(lib/files/storage)이 공유하는
 * lazy 싱글턴. env 2종(NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)이 모두 있을 때만 생성된다.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger';

let clientInstance: SupabaseClient | null = null;

/**
 * 표준 Supabase 프로젝트 URL 형식. 캡처 그룹 1 = 프로젝트 ref.
 * 형식 경고(getSupabaseClient)와 ref 추출(supabaseProjectRef)이 같은 규칙을 쓰도록 한 곳에 둔다.
 */
const PROJECT_URL_PATTERN = /^https:\/\/([a-z0-9-]+)\.supabase\.co$/i;

/** URL 오타 방어 — 앞뒤 공백·개행과 끝의 슬래시(들)를 제거한다 */
function normalizedUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
}

/** Supabase env 2종이 모두 설정돼 있는가 — 스토어/스토리지 선택 기준(store.ts와 동일 조건) */
export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * 현재 가리키는 Supabase 프로젝트 ref(`https://<ref>.supabase.co` 의 `<ref>`).
 * 환경 분리 확진용 — stg 와 prd 의 ref 가 다른지가 분리 성공의 판정선이다.
 * ref 는 공개 URL 에 이미 담긴 값이라 노출 위험이 없다. 미설정·형식 이상이면 null.
 */
export function supabaseProjectRef(): string | null {
  return PROJECT_URL_PATTERN.exec(normalizedUrl())?.[1]?.toLowerCase() ?? null;
}

/** 서버 전용(service role) Supabase 클라이언트를 반환한다 — env 없으면 throw(호출 전 hasSupabaseEnv 확인) */
export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) return clientInstance;
  if (!hasSupabaseEnv()) throw new Error('Supabase env 미설정 — NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 필요');
  // 끝 슬래시/개행이 남으면 클라이언트가 `//rest/v1/...`를 만들어 게이트웨이가
  // "Invalid path specified in request URL"로 거부한다(대시보드에서 값을 붙여넣을 때 흔한 실수).
  const url = normalizedUrl();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY as string).trim();
  // 형식이 표준 프로젝트 URL(https://<ref>.supabase.co)이 아니면 원인 추적용으로 경고만 남긴다(차단 아님).
  if (!PROJECT_URL_PATTERN.test(url)) {
    logger.warn(
      `NEXT_PUBLIC_SUPABASE_URL 형식이 비정상입니다("${url}") — ` +
        'Supabase → Settings → API → Project URL(https://<ref>.supabase.co)을 경로·끝슬래시 없이 넣으세요.',
    );
  }
  clientInstance = createClient(url, key, { auth: { persistSession: false } });
  return clientInstance;
}
