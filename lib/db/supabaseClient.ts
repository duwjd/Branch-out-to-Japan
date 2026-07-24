/**
 * Supabase 서버 클라이언트 — DB 스토어(supabaseStore)와 파일 저장(lib/files/storage)이 공유하는
 * lazy 싱글턴. env 2종(NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)이 모두 있을 때만 생성된다.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

/** Supabase env 2종이 모두 설정돼 있는가 — 스토어/스토리지 선택 기준(store.ts와 동일 조건) */
export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** 서버 전용(service role) Supabase 클라이언트를 반환한다 — env 없으면 throw(호출 전 hasSupabaseEnv 확인) */
export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) return clientInstance;
  if (!hasSupabaseEnv()) throw new Error('Supabase env 미설정 — NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 필요');
  clientInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  );
  return clientInstance;
}
