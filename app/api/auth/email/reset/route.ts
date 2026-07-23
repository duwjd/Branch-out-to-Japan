/**
 * POST /api/auth/email/reset — 비밀번호 재설정 확정.
 * reset 토큰을 원자적으로 소비(1회용)하고 비밀번호를 교체한다.
 * 재설정 성공 시 이메일 인증도 완료 처리(메일 링크 소유 = 이메일 확인)한다. 자동 로그인은 안 함.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { hashPassword, isValidPassword } from '@/lib/server/password';
import { hashAuthToken } from '@/lib/server/authToken';
import { logger } from '@/lib/logger';

export async function POST(request: Request): Promise<NextResponse> {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const token = String(body.token ?? '');
  const password = String(body.password ?? '');
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
  }

  const store = await getStore();
  const record = await store.consumeAuthToken(hashAuthToken(token), 'reset');
  if (!record) {
    return NextResponse.json({ error: '재설정 링크가 만료되었거나 유효하지 않습니다.' }, { status: 400 });
  }

  await store.updateUser(record.userId, { passwordHash: hashPassword(password), emailVerified: true });
  logger.info('비밀번호 재설정 완료', { userId: record.userId });
  return NextResponse.json({ ok: true });
}
