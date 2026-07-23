/**
 * POST /api/auth/email/login — 이메일 로그인.
 * 계정 존재 여부를 노출하지 않는다(없음·소셜계정·비번불일치 모두 동일 401).
 * 미인증 계정은 403 { code:'unverified' } — 프론트가 인증 재발송으로 유도한다.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { verifyPassword } from '@/lib/server/password';
import { normalizeEmail } from '@/lib/server/email';
import { SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions } from '@/lib/server/session';
import { signSession } from '@/lib/server/sessionToken';
import { logger } from '@/lib/logger';

export async function POST(request: Request): Promise<NextResponse> {
  let body: { email?: string; password?: string; remember?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const email = normalizeEmail(String(body.email ?? ''));
  const password = String(body.password ?? '');
  // 계정 존재 비노출 — 없음/소셜계정(passwordHash null)/비번불일치 모두 같은 문구
  const invalid = () =>
    NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });

  const store = await getStore();
  const user = await store.getUserByEmail(email);
  if (!user || user.passwordHash === null) return invalid();
  if (!verifyPassword(password, user.passwordHash)) return invalid();

  if (user.emailVerified === false) {
    return NextResponse.json(
      { code: 'unverified', email: user.email, error: '이메일 인증이 필요합니다.' },
      { status: 403 },
    );
  }

  const remember = body.remember === true;
  const token = signSession({ userId: user.id, provider: 'email', exp: Date.now() + SESSION_MAX_AGE * 1000 });
  logger.info('이메일 로그인', { userId: user.id });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(remember));
  return res;
}
