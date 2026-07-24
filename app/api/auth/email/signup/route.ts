/**
 * POST /api/auth/email/signup — 이메일 회원가입.
 * 이메일/비번 검증 → 중복이면 409 → 유저 생성(미인증) → verify 토큰·인증 메일 발송.
 * 세션은 발급하지 않는다 — 이메일 인증 후 로그인해야 진입(login이 미인증 403).
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { hashPassword, isValidPassword } from '@/lib/server/password';
import { generateAuthToken } from '@/lib/server/authToken';
import { isValidEmail, normalizeEmail } from '@/lib/server/email';
import { sendAuthMail } from '@/lib/server/mailer';
import { logger } from '@/lib/logger';

/** 이메일 인증 토큰 유효 기간 — 24시간 */
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request): Promise<NextResponse> {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const email = normalizeEmail(String(body.email ?? ''));
  const password = String(body.password ?? '');
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: '올바른 이메일 주소를 입력해 주세요.' }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
  }

  const store = await getStore();
  if (await store.getUserByEmail(email)) {
    return NextResponse.json({ error: '이미 가입된 이메일입니다. 로그인해 주세요.' }, { status: 409 });
  }

  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : email.split('@')[0];
  const user = await store.createUser({
    email,
    passwordHash: hashPassword(password),
    name,
    emailVerified: false,
  });

  const { raw, tokenHash } = generateAuthToken();
  await store.createAuthToken({
    tokenHash,
    userId: user.id,
    kind: 'verify',
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS).toISOString(),
  });

  const link = `${new URL(request.url).origin}/verify-email?token=${raw}`;
  const { devLink } = await sendAuthMail({ to: email, kind: 'verify', link });

  logger.info('이메일 회원가입', { userId: user.id });
  return NextResponse.json({ ok: true, devLink });
}
