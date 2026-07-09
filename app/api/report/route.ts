/**
 * POST /api/report — 진단 제출(티어 입력) → 요청 생성 + 파이프라인 백그라운드 킥오프.
 * GET /api/report — 실행 모드 메타(저장 종류·LLM 모드) — 폼 화면의 dev 배지용.
 */

import { NextResponse, after } from 'next/server';
import { createDiagnosisRequest, runDiagnosisJob } from '@/lib/server/reportJob';
import { currentLlmMode } from '@/lib/engine/llm/client';
import { getStore } from '@/lib/db/store';
import { logger } from '@/lib/logger';
import type { Category, ProductClass, TierInput } from '@/lib/engine/types';

const CATEGORIES: Category[] = ['skincare', 'makeup', 'suncare', 'cleansing'];
const PRODUCT_CLASSES: ProductClass[] = ['화장품', '의약외품', '미상'];

/** 폼 입력을 서버에서 재검증해 TierInput으로 정규화한다(50자 하드게이트 포함) */
function parseTierInput(body: Record<string, unknown>): { input: TierInput } | { error: string } {
  const category = body.category as Category;
  if (!CATEGORIES.includes(category)) return { error: '카테고리를 선택해 주세요.' };
  const productClass = body.productClass as ProductClass;
  if (!PRODUCT_CLASSES.includes(productClass)) return { error: '제품 분류를 선택해 주세요.' };

  const sourceType = body.sourceType === 'url' ? 'url' : 'text';
  const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
  const sourceText = typeof body.sourceText === 'string' ? body.sourceText : '';

  if (sourceType === 'url') {
    if (!/^https?:\/\//.test(sourceUrl)) return { error: 'http(s)로 시작하는 URL을 입력해 주세요.' };
  } else if (sourceText.replace(/\s/g, '').length < 50) {
    return { error: '최소 50자 이상 콘텐츠가 필요합니다(하드 게이트).' };
  }

  const keyIngredients = typeof body.keyIngredients === 'string'
    ? body.keyIngredients.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8)
    : [];
  const priceJpy = Number(body.priceJpy);

  return {
    input: {
      category,
      productClass,
      sourceType,
      sourceUrl: sourceType === 'url' ? sourceUrl : undefined,
      sourceText: sourceType === 'text' ? sourceText : undefined,
      brandName: typeof body.brandName === 'string' ? body.brandName.slice(0, 60) : undefined,
      productName: typeof body.productName === 'string' ? body.productName.slice(0, 120) : undefined,
      keyIngredients: keyIngredients.length ? keyIngredients : undefined,
      priceJpy: Number.isFinite(priceJpy) && priceJpy > 0 ? priceJpy : undefined,
      targetMemo: typeof body.targetMemo === 'string' ? body.targetMemo.slice(0, 500) : undefined,
      reviewSourceUrl: typeof body.reviewSourceUrl === 'string' && body.reviewSourceUrl.trim() ? body.reviewSourceUrl.trim() : undefined,
    },
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const parsed = parseTierInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const record = await createDiagnosisRequest(parsed.input);
  logger.info('진단 요청 접수', { requestId: record.id, category: parsed.input.category });

  // 응답 반환 후 백그라운드 실행(next/server after) — 실패는 잡이 상태로 기록
  after(async () => {
    await runDiagnosisJob(record.id);
  });

  return NextResponse.json({ id: record.id }, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  const store = await getStore();
  return NextResponse.json({ storeKind: store.kind(), llmMode: currentLlmMode() });
}
