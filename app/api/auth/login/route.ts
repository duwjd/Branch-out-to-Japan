/**
 * POST /api/auth/login — 목 소셜 로그인(스프린트 2). provider를 받아 세션 쿠키만 발급한다.
 * 실 OAuth 리다이렉트 없음 — "버튼 클릭 = 로그인 가정"이 확정 결정(09 §4b M5).
 * M2 전환: 쿠키값을 provider명 대신 서명 세션(demo-user)으로 발급 → 기존 .data 데이터가 그대로 보인다.
 */

import { NextResponse } from 'next/server';
import {
  AUTH_PROVIDERS,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sessionCookieOptions,
  type AuthProvider,
} from '@/lib/server/session';
import { signSession } from '@/lib/server/sessionToken';
import { getStore } from '@/lib/db/store';
import { logger } from '@/lib/logger';

export async function POST(request: Request): Promise<NextResponse> {
  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  if (!AUTH_PROVIDERS.includes(body.provider as AuthProvider)) {
    return NextResponse.json({ error: '지원하지 않는 로그인 수단입니다.' }, { status: 400 });
  }
  const provider = body.provider as AuthProvider;

  const store = await getStore();
  // 데모 유저 보장 — 소셜 3사 모두 이 계정으로 로그인(레거시 데이터 귀속 대상, LEGACY_USER_ID)
  let demo = await store.getUserById('demo-user');
  if (!demo) {
    demo = await store.createUser({
      id: 'demo-user',
      email: 'demo@kglow.example',
      passwordHash: null, // 소셜(목) 계정 — 비밀번호 없음
      name: '데모 사용자',
      emailVerified: true,
    });
  }

  const token = signSession({ userId: demo.id, provider, exp: Date.now() + SESSION_MAX_AGE * 1000 });
  logger.info('목 로그인', { provider });
  const res = NextResponse.json({ ok: true });
  // 목 세션은 만료 갱신이 없어 항상 30일 유지(remember 상시 true)
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(true));
  return res;
}
