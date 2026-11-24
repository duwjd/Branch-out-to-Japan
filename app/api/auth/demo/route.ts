/**
 * POST /api/auth/demo — 데모 계정 로그인("데모 계정 체험하기" 버튼, dev-ai-champion 시연용).
 * 계정은 env(`DEMO_ACCOUNT_EMAIL`·`DEMO_ACCOUNT_PASSWORD`)로 정한다 — `lib/server/demoAccount.ts`.
 * 이메일 로그인과 같은 절차(비번 검증 → 인증 여부 → 세션 발급)를 밟고, 계정은 여기서 만들지 않는다.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { verifyPassword } from '@/lib/server/password';
import { getDemoAccount } from '@/lib/server/demoAccount';
import { SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions } from '@/lib/server/session';
import { signSession } from '@/lib/server/sessionToken';
import { logger } from '@/lib/logger';

export async function POST(): Promise<NextResponse> {
  const demo = getDemoAccount();
  if (!demo) {
    return NextResponse.json({ error: '데모 계정이 설정되지 않은 환경입니다.' }, { status: 404 });
  }

  const unavailable = (reason: string) => {
    logger.warn('데모 로그인 실패', { reason });
    return NextResponse.json({ error: '데모 계정을 사용할 수 없습니다. 관리자에게 문의해 주세요.' }, { status: 503 });
  };

  const store = await getStore();
  const user = await store.getUserByEmail(demo.email);
  if (!user) return unavailable('계정 없음');
  if (user.passwordHash === null || !verifyPassword(demo.password, user.passwordHash)) {
    return unavailable('비밀번호 불일치');
  }
  if (user.emailVerified === false) return unavailable('이메일 미인증');

  const token = signSession({ userId: user.id, provider: 'email', exp: Date.now() + SESSION_MAX_AGE * 1000 });
  logger.info('데모 로그인', { userId: user.id });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(false));
  return res;
}
