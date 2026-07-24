/**
 * POST /api/auth/email/resend — 인증 메일 재발송.
 * 계정 존재/인증 여부를 노출하지 않는다(미가입·이미 인증도 200). 존재 시 60초 쿨다운 후 재발송.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { generateAuthToken } from '@/lib/server/authToken';
import { normalizeEmail } from '@/lib/server/email';
import { sendAuthMail } from '@/lib/server/mailer';
import { logger } from '@/lib/logger';

/** 인증 토큰 유효 기간 — 24시간 */
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
/** 재발송 쿨다운 — 60초(최신 토큰 createdAt 기준) */
const RESEND_COOLDOWN_SEC = 60;

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
  // 비노출 — 미가입이거나 이미 인증 완료여도 성공처럼 응답(devLink는 없음)
  if (!user || user.emailVerified) return NextResponse.json({ ok: true, devLink: null });

  const latest = await store.getLatestAuthToken(user.id, 'verify');
  if (latest) {
    const elapsedSec = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
    if (elapsedSec < RESEND_COOLDOWN_SEC) {
      const retryAfterSec = Math.ceil(RESEND_COOLDOWN_SEC - elapsedSec);
      return NextResponse.json(
        { error: '잠시 후 다시 시도해 주세요.', retryAfterSec },
        { status: 429 },
      );
    }
  }

  const { raw, tokenHash } = generateAuthToken();
  await store.createAuthToken({
    tokenHash,
    userId: user.id,
    kind: 'verify',
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS).toISOString(),
  });

  const link = `${new URL(request.url).origin}/verify-email?token=${raw}`;
  const { devLink } = await sendAuthMail({ to: email, kind: 'verify', link });

  logger.info('인증 메일 재발송', { userId: user.id });
  return NextResponse.json({ ok: true, devLink });
}
