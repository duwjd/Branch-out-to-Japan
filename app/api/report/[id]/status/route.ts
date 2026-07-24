/**
 * GET /api/report/[id]/status — 상태 폴링(08 §3.3).
 * 터미널 상태(published·failed)에 도달하면 리포트 본문을 함께 반환한다.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { getSession } from '@/lib/server/session';
import { sessionOwnsBrand } from '@/lib/server/ownership';
import { logger } from '@/lib/logger';

// after() 잡이 함수 타임아웃 등으로 죽으면 비터미널 상태가 영구 고착된다 — 폴링 시점에 실패 전환(11 §3)
const STALE_JOB_MS = 10 * 60 * 1000;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const store = await getStore();
  const request = await store.getRequest(id);
  if (!request) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
  // 소유 가드 — 비소유·게스트는 존재를 노출하지 않도록 not-found와 동일한 404로 응답
  if (!(await sessionOwnsBrand(request.brandProfileId, await getSession()))) {
    return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
  }

  const stale =
    (request.status === 'submitted' || request.status === 'processing') &&
    Date.now() - new Date(request.updatedAt).getTime() > STALE_JOB_MS;
  if (stale) {
    request.status = 'failed';
    request.error = '처리 시간이 초과되었습니다. 다시 시도해 주세요.';
    await store.updateRequest(id, { status: 'failed', error: request.error });
    logger.warn('진단 잡 스테일 실패 전환', { requestId: id });
  }

  const report = request.status === 'published' ? await store.getReport(id) : null;

  return NextResponse.json({
    id: request.id,
    status: request.status,
    stage: request.stage,
    error: request.error,
    precisionLimited: request.precisionLimited,
    storeKind: store.kind(),
    report: report
      ? {
          blocksJson: report.blocksJson,
          overallScore: report.overallScore,
          publishedAt: report.publishedAt,
        }
      : null,
  });
}
