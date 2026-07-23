/**
 * 서명 세션(실 인증 코어 M2) — httpOnly 쿠키 1개에 HMAC 서명 토큰(sessionToken.ts)을 담는다.
 *
 * 쿠키 상태 규칙(M3 레이아웃이 이 3분기에 의존한다):
 * - 쿠키 없음        = 게스트(비로그인 열람 허용 대상)      → getSessionState() { guest:true }
 * - 쿠키 있으나 무효 = 서명 실패·만료·유저 없음(=만료로 취급) → { expired:true } (→ /login?expired=1)
 * - 유효 서명 세션   = 정상 로그인                          → { session }
 * 레거시 소셜 쿠키(값=provider명, M1 이전 dev 쿠키)는 과도기 동안 유효 세션으로 취급한다(무중단).
 *
 * 가드는 /app 레이아웃 1곳(middleware 없음). getSession()은 기존 소비자용(세션 or null),
 * getSessionState()는 게스트/만료 구분이 필요한 레이아웃용.
 */

import { cookies } from 'next/headers';
import { getStore, type UserRecord } from '../db/store';
import { verifySession } from './sessionToken';

export const SESSION_COOKIE = 'kglow_session';

/** 세션 지속 기간 — 30일(remember=true 쿠키의 maxAge, 서명 exp도 동일 기준) */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** 발급 주체 — 소셜(목) 3종 + 이메일 자체 로그인 */
export type AuthProvider = 'kakao' | 'naver' | 'google' | 'email';

/** 목 소셜 로그인 라우트 검증용 — 소셜 3종만(email은 자체 로그인 라우트가 다룬다) */
export const AUTH_PROVIDERS: readonly AuthProvider[] = ['kakao', 'naver', 'google'];

export const PROVIDER_LABELS: Record<AuthProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
  email: '이메일',
};

/** 세션 표시용 유저 스냅샷 — 레이아웃·마이페이지가 name/email/joinedAt을 쓴다 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  joinedAt: string; // YYYY-MM-DD
}

/** 데모 유저 — 레거시 소셜 쿠키의 폴백(유저 레코드가 아직 없을 때) */
export const DEMO_USER: SessionUser = {
  id: 'demo-user',
  name: '데모 사용자',
  email: 'demo@kglow.example',
  joinedAt: '2026-07-21',
};

export interface Session {
  user: SessionUser;
  provider: AuthProvider;
}

/** 세션 쿠키 옵션 — remember면 30일 유지(maxAge), 아니면 브라우저 세션 쿠키(maxAge 생략) */
export function sessionCookieOptions(
  remember: boolean,
): { httpOnly: true; sameSite: 'lax'; path: '/'; maxAge?: number } {
  const base = { httpOnly: true as const, sameSite: 'lax' as const, path: '/' as const };
  return remember ? { ...base, maxAge: SESSION_MAX_AGE } : base;
}

/** UserRecord → 세션 표시용 유저(joinedAt은 createdAt 앞 10자 YYYY-MM-DD) */
function toSessionUser(user: UserRecord): SessionUser {
  return { id: user.id, name: user.name, email: user.email, joinedAt: user.createdAt.slice(0, 10) };
}

/**
 * 쿠키 원문값을 세션으로 해석한다(무효면 null). cookies() 접근과 분리해 getSession/getSessionState가 공유.
 * 1) 서명 세션(v1.) → verifySession → 유저 조회, 유저 없으면 null
 * 2) 레거시 소셜 쿠키(provider명) → demo-user 조회(없으면 DEMO_USER 폴백)로 세션 반환(항상 유효)
 * 3) 그 외 → null
 */
async function resolveSession(value: string): Promise<Session | null> {
  if (value.startsWith('v1.')) {
    const payload = verifySession(value);
    if (!payload) return null;
    const store = await getStore();
    const user = await store.getUserById(payload.userId);
    if (!user) return null;
    return { user: toSessionUser(user), provider: payload.provider };
  }
  if (AUTH_PROVIDERS.includes(value as AuthProvider)) {
    const store = await getStore();
    const user = await store.getUserById('demo-user');
    return { user: user ? toSessionUser(user) : DEMO_USER, provider: value as AuthProvider };
  }
  return null;
}

/** 현재 세션 조회 — 쿠키 없음/무효는 모두 null(게스트·만료 구분이 필요하면 getSessionState) */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return resolveSession(value);
}

/**
 * 세션 상태 조회 — 레이아웃이 게스트(열람 허용)와 만료(→로그인 유도)를 구분하기 위한 3분기.
 * 쿠키 없음 → guest / 해석 성공 → session / 쿠키는 있으나 무효 → expired.
 */
export async function getSessionState(): Promise<
  { session: Session } | { expired: true } | { guest: true }
> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  if (!value) return { guest: true };
  const session = await resolveSession(value);
  return session ? { session } : { expired: true };
}
