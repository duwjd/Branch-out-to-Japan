/**
 * POST /api/auth/login — 목 로그인(스프린트 2). provider를 받아 세션 쿠키만 발급한다.
 * 실 OAuth 리다이렉트 없음 — "버튼 클릭 = 로그인 가정"이 확정 결정(09 §4b M5).
 */

import { NextResponse } from 'next/server';
import { AUTH_PROVIDERS, SESSION_COOKIE, type AuthProvider } from '@/lib/server/session';
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

  logger.info('목 로그인', { provider: body.provider });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, body.provider as string, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30일 — 목 세션이라 만료 갱신 없음
  });
  return res;
}
