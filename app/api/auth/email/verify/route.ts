/**
 * POST /api/auth/email/verify — 이메일 인증 링크 확인.
 * verify 토큰을 원자적으로 소비(1회용)하고 유저를 emailVerified=true로 갱신한다.
 * 자동 로그인은 하지 않는다 — 프론트가 로그인 화면으로 유도한다.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { hashAuthToken } from '@/lib/server/authToken';
import { logger } from '@/lib/logger';

export async function POST(request: Request): Promise<NextResponse> {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const token = String(body.token ?? '');
  const invalid = () =>
    NextResponse.json({ error: '인증 링크가 만료되었거나 유효하지 않습니다.' }, { status: 400 });
  if (!token) return invalid();

  const store = await getStore();
  const record = await store.consumeAuthToken(hashAuthToken(token), 'verify');
  if (!record) return invalid();

  await store.updateUser(record.userId, { emailVerified: true });
  logger.info('이메일 인증 완료', { userId: record.userId });
  return NextResponse.json({ ok: true });
}
