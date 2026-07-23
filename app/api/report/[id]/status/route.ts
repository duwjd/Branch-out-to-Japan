/**
 * GET /api/report/[id]/status — 상태 폴링(08 §3.3).
 * 터미널 상태(published·failed)에 도달하면 리포트 본문을 함께 반환한다.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { getSession } from '@/lib/server/session';
import { sessionOwnsBrand } from '@/lib/server/ownership';

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
