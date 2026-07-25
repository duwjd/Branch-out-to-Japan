/**
 * POST /api/auth/email/forgot — 비밀번호 재설정 메일 요청.
 * 가입 여부를 노출하지 않는다(미가입도 200). 존재 시에만 reset 토큰·메일을 발급하고 devLink를 채운다.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { generateAuthToken } from '@/lib/server/authToken';
import { normalizeEmail } from '@/lib/server/email';
import { sendAuthMail } from '@/lib/server/mailer';
import { logger } from '@/lib/logger';

/** 재설정 토큰 유효 기간 — 1시간 */
const RESET_TTL_MS = 60 * 60 * 1000;

export async function POST(request: Request): Promise<NextResponse> {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const email = normalizeEmail(String(body.email ?? ''));
  const store = await getStore();
  const user = await store.getUserByEmail(email);
  // 비노출 — 미가입이어도 동일한 성공 응답(devLink는 없음)
  if (!user) return NextResponse.json({ ok: true, devLink: null });

  const { raw, tokenHash } = generateAuthToken();
  await store.createAuthToken({
    tokenHash,
    userId: user.id,
    kind: 'reset',
    expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
  });

  const link = `${new URL(request.url).origin}/reset-password?token=${raw}`;
  const { devLink } = await sendAuthMail({ to: email, kind: 'reset', link });

  logger.info('비밀번호 재설정 메일 발송', { userId: user.id });
  return NextResponse.json({ ok: true, devLink });
}
