/**
 * POST /api/auth/logout — 목 세션 쿠키 삭제.
 */

import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/server/session';

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
