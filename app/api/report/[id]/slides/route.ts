/**
 * GET /api/report/[id]/slides — 보고용 슬라이드 HTML 다운로드 (스펙 §10).
 * 동기 처리: 콜⑤ 1회(~20초) + 렌더. 파이프라인과 무관하며 실패해도 리포트에 영향 없다.
 * 저장하지 않고 매번 재생성한다 — 저장이 필요해지면 HTML이 아니라 덱 spec(수 KB JSON)을 저장할 것(§10.6).
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { getSession } from '@/lib/server/session';
import { sessionOwnsBrand } from '@/lib/server/ownership';
import { runCall5 } from '@/lib/engine/llm/calls';
import { renderDeckHtml } from '@/lib/engine/rules/slides';
import { logger } from '@/lib/logger';

/** 콜⑤가 20초 안팎 — 기본 제한을 넘기지 않도록 여유를 준다 */
export const maxDuration = 60;

/** 파일명에 못 쓰는 문자를 제거한다(경로 분리자·제어문자·헤더 인젝션 방지) */
function safeFileName(brandName: string): string {
  const base = brandName.replace(/[^\p{L}\p{N}\-_]/gu, '').slice(0, 40);
  return `${base || 'KGLOW'}-일본진출진단-보고용.html`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const store = await getStore();

  const request = await store.getRequest(id);
  if (!request) return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 });
  // 소유 가드 — 비소유·게스트는 존재를 노출하지 않도록 not-found와 동일한 404로 응답
  if (!(await sessionOwnsBrand(request.brandProfileId, await getSession()))) {
    return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (request.status !== 'published') {
    return NextResponse.json({ error: '발행된 리포트만 슬라이드로 만들 수 있습니다.' }, { status: 409 });
  }

  const report = await store.getReport(id);
  if (!report) return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 });

  try {
    logger.info('슬라이드 생성 시작', { requestId: id });
    const spec = await runCall5(report.blocksJson, request.tierInput, (entry) => store.saveLlmLog(id, entry));
    const html = renderDeckHtml(spec, report.blocksJson);
    logger.info('슬라이드 생성 완료', { requestId: id, bytes: html.length });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeFileName(report.blocksJson.block0.brandName))}`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    const reason = String((err as Error)?.message ?? err);
    logger.error('슬라이드 생성 실패', { requestId: id, reason });
    return NextResponse.json({ error: '슬라이드 생성에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 });
  }
}
