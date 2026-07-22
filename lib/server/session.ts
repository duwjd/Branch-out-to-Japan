/**
 * 목 세션 — 소셜 로그인은 실 OAuth를 연동하지 않는다(스프린트 2 결정, 09 §4b).
 * httpOnly 쿠키 1개(값 = provider 이름) + 데모 유저 1명 하드코딩이 전부다.
 * User 엔티티·Supabase Auth·middleware를 만들지 않는다 — 가드는 app/app/layout.tsx 1곳.
 */

import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'kglow_session';

export type AuthProvider = 'kakao' | 'naver' | 'google';

export const AUTH_PROVIDERS: readonly AuthProvider[] = ['kakao', 'naver', 'google'];

export const PROVIDER_LABELS: Record<AuthProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
};

/** 데모 유저 — 실 인증 도입 전까지 모든 세션이 이 계정이다 */
export const DEMO_USER = {
  id: 'demo-user',
  name: '데모 사용자',
  email: 'demo@kglow.example',
  joinedAt: '2026-07-21',
} as const;

export interface Session {
  user: typeof DEMO_USER;
  provider: AuthProvider;
}

/** 현재 목 세션 조회 — 쿠키 값이 provider 3종 중 하나면 유효 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value || !AUTH_PROVIDERS.includes(value as AuthProvider)) return null;
  return { user: DEMO_USER, provider: value as AuthProvider };
}
