/**
 * GET /api/review — 검수 큐(needsReview 목록). /admin/review 화면용.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';

export async function GET(): Promise<NextResponse> {
  const store = await getStore();
  const items = await store.listByStatus('needsReview');
  return NextResponse.json({
    storeKind: store.kind(),
    items: items.map(({ request, report }) => ({
      id: request.id,
      createdAt: request.createdAt,
      category: request.tierInput.category,
      brandName: request.tierInput.brandName ?? '(미기재)',
      productName: request.tierInput.productName ?? '(미기재)',
      overallScore: report.overallScore,
      auditSummary: report.blocksJson.block3.summary,
      llmMode: report.blocksJson.meta.llmMode,
    })),
  });
}
