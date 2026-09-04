/**
 * 서명 세션(실 인증 코어 M2) — httpOnly 쿠키 1개에 HMAC 서명 토큰(sessionToken.ts)을 담는다.
 *
 * 쿠키 상태 규칙(/app 레이아웃이 이 3분기에 의존한다):
 * - 쿠키 없음        = 비로그인                              → getSessionState() { guest:true } → /login
 * - 쿠키 있으나 무효 = 서명 실패·만료·유저 없음(=만료로 취급) → { expired:true } → /login?expired=1
 * - 유효 서명 세션   = 정상 로그인                            → { session }
 * 레거시 소셜 쿠키(값=provider명, M1 이전 dev 쿠키)는 과도기 동안 유효 세션으로 취급한다(무중단).
 *
 * 2026-08-18 플로우 개편으로 `guest`는 "열람 허용"이 아니라 "진입 불가"가 됐다. 그래도 3분기를
 * 유지하는 이유는 착지 화면이 다르기 때문이다 — 만료만 "다시 로그인해 주세요" 배너를 띄운다.
 *
 * 가드는 /app 레이아웃 1곳(middleware 없음). getSession()은 기존 소비자용(세션 or null),
 * getSessionState()는 비로그인/만료 구분이 필요한 레이아웃용.
 */

import { cache } from 'react';
import { cookies } from 'next/headers';
import { getStore, type UserRecord } from '../db/store';
import { verifySession } from './sessionToken';

export const SESSION_COOKIE = 'yoake_session';

/** 세션 지속 기간 — 30일(remember=true 쿠키의 maxAge, 서명 exp도 동일 기준) */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** 발급 주체 — 소셜(목) 3종 + 이메일 자체 로그인 */
export type AuthProvider = 'kakao' | 'naver' | 'google' | 'email';

/**
 * 소셜 로그인 노출 스위치 — **2026-08-31 부터 꺼져 있다.**
 * 실 OAuth 가 아니라 목 세션이었고, 그 경로가 인증 없이 세션을 발급했다(아래 §레거시 쿠키 참조).
 * 되살리는 조건: 실 OAuth 연동 완료. 그때 이 값을 true 로 되돌리고 `/api/auth/login` 을 OAuth 콜백으로 교체한다.
 * env 가 아니라 코드 상수인 이유는 이 개발 머신에서 `.env*` 편집이 차단돼 있어서다.
 */
export const SOCIAL_LOGIN_ENABLED = false;

/** 소셜 3종(email은 자체 로그인 라우트가 다룬다). `SOCIAL_LOGIN_ENABLED` 가 false 면 실제로 쓰이지 않는다 */
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
  email: 'demo@yoake.example',
  joinedAt: '2026-07-21',
};

export interface Session {
  user: SessionUser;
  provider: AuthProvider;
}

/**
 * 세션 쿠키 옵션 — remember면 30일 유지(maxAge), 아니면 브라우저 세션 쿠키(maxAge 생략).
 * secure는 프로덕션에서만(로컬 dev는 http라 secure면 쿠키가 안 실린다).
 */
export function sessionCookieOptions(remember: boolean): {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge?: number;
} {
  const base = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/' as const,
    secure: process.env.NODE_ENV === 'production',
  };
  return remember ? { ...base, maxAge: SESSION_MAX_AGE } : base;
}

/** UserRecord → 세션 표시용 유저(joinedAt은 createdAt 앞 10자 YYYY-MM-DD) */
function toSessionUser(user: UserRecord): SessionUser {
  return { id: user.id, name: user.name, email: user.email, joinedAt: user.createdAt.slice(0, 10) };
}

/**
 * 쿠키 원문값을 세션으로 해석한다(무효면 null). cookies() 접근과 분리해 getSession/getSessionState가 공유.
 * 1) 서명 세션(v1.) → verifySession → 유저 조회, 유저 없으면 null
 * 2) 그 외 → null
 *
 * ⚠ **2026-08-31 제거:** 예전에는 쿠키값이 `kakao`·`naver`·`google` 이면 서명 검증 없이 `demo-user`
 * 세션을 내주는 레거시 경로가 있었다(M2 이전 원시 provider 쿠키 호환). 브라우저에서 쿠키를
 * `yoake_session=kakao` 로 세팅하기만 하면 누구나 로그인되는 상태였다. 이 경로를 지우면서 그때 만든
 * 쿠키를 들고 있던 세션은 무효가 된다 — 애초에 인증된 적이 없으므로 의도한 결과다.
 */
async function resolveSessionUncached(value: string): Promise<Session | null> {
  if (value.startsWith('v1.')) {
    const payload = verifySession(value);
    if (!payload) return null;
    const store = await getStore();
    const user = await store.getUserById(payload.userId);
    if (!user) return null;
    return { user: toSessionUser(user), provider: payload.provider };
  }
  return null;
}

/**
 * 쿠키값 → 세션 해석(요청 단위 메모).
 *
 * 왜 캐시하나: 한 번의 페이지 렌더에서 /app 레이아웃·페이지 본문·활성 브랜드 해석이 각각
 * getSession()/getSessionState()를 부르면 같은 쿠키로 getUserById 를 그만큼 반복한다.
 * react cache 는 **요청 스코프**라 요청 간에 세션이 새지 않는다(전역 캐시가 아니다).
 */
const resolveSession = cache(resolveSessionUncached);

/** 현재 세션 조회 — 쿠키 없음/무효는 모두 null(비로그인·만료 구분이 필요하면 getSessionState) */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return resolveSession(value);
}

/**
 * 세션 상태 조회 — 레이아웃이 비로그인(→/login)과 만료(→/login?expired=1)를 구분하기 위한 3분기.
 * 쿠키 없음 → guest / 해석 성공 → session / 쿠키는 있으나 무효 → expired.
 */
export async function getSessionState(): Promise<{ session: Session } | { expired: true } | { guest: true }> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  if (!value) return { guest: true };
  const session = await resolveSession(value);
  return session ? { session } : { expired: true };
}
