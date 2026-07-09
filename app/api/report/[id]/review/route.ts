/**
 * POST /api/report/[id]/review — 검수 승인(실명 서명 → published) / 반려(rejected).
 * 서명 없는 발행 불가(스펙 성공지표) — 이 엔드포인트가 유일한 발행 경로다.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  let body: { action?: string; reviewerName?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const store = await getStore();
  const record = await store.getRequest(id);
  if (!record) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
  if (record.status !== 'needsReview') {
    return NextResponse.json({ error: `검수 대기 상태가 아닙니다(현재: ${record.status}).` }, { status: 409 });
  }

  if (body.action === 'sign') {
    const reviewerName = (body.reviewerName ?? '').trim();
    if (!reviewerName) return NextResponse.json({ error: '검수자 실명을 입력해 주세요(서명 없는 발행 불가).' }, { status: 400 });
    await store.signReport(id, reviewerName);
    logger.info('리포트 발행(서명)', { requestId: id, reviewerName });
    return NextResponse.json({ ok: true, status: 'published' });
  }

  if (body.action === 'reject') {
    const reason = (body.reason ?? '').trim() || '사유 미기재';
    await store.rejectReport(id, reason);
    logger.info('리포트 반려', { requestId: id, reason });
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  return NextResponse.json({ error: 'action은 sign 또는 reject 여야 합니다.' }, { status: 400 });
}
