/**
 * POST /api/report — 진단 제출(티어 입력) → 요청 생성 + 파이프라인 백그라운드 킥오프.
 * GET /api/report — 실행 모드 메타(저장 종류·LLM 모드) — 폼 화면의 dev 배지용.
 */

import { NextResponse, after } from 'next/server';
import { createDiagnosisRequest, runDiagnosisJob } from '@/lib/server/reportJob';
import { currentLlmMode } from '@/lib/engine/llm/client';
import { getStore } from '@/lib/db/store';
import { logger } from '@/lib/logger';
import { HARD_GATE_CHARS, contentCharCount, isValidHttpUrl } from '@/lib/engine/rules/gates';
import {
  POSITIONING_NOTE_MAX,
  POSITIONING_TAGS_MAX,
  POSITIONING_TAGS_MIN,
  isKnownPositioningTag,
} from '@/lib/engine/rules/positioning';
import type { Category, ProductClass, TierInput } from '@/lib/engine/types';

const CATEGORIES: Category[] = ['skincare', 'makeup', 'suncare', 'cleansing'];
const PRODUCT_CLASSES: ProductClass[] = ['화장품', '의약외품', '미상'];

/**
 * 폼 입력을 서버에서 재검증해 TierInput으로 정규화한다(스펙 §3 v4).
 * 브랜드 섹션 3종은 필수(400), 제품 섹션은 절삭 정규화만(에러 없음 — 선택 입력에 에러를 내지 않는다).
 * mode는 여기서 한 번 판정해 물질화한다(§3.3) — 콘텐츠가 있으면 brandProduct, 없으면 brand.
 */
function parseTierInput(body: Record<string, unknown>): { input: TierInput } | { error: string } {
  // ── 브랜드 섹션 (필수)
  const brandName = typeof body.brandName === 'string' ? body.brandName.trim().slice(0, 60) : '';
  if (!brandName) return { error: '브랜드명을 입력해 주세요.' };

  const rawPositioning = (typeof body.positioning === 'object' && body.positioning !== null
    ? body.positioning
    : {}) as Record<string, unknown>;
  const tags = Array.isArray(rawPositioning.tags)
    ? rawPositioning.tags
        .filter((t): t is string => typeof t === 'string' && isKnownPositioningTag(t))
        .slice(0, POSITIONING_TAGS_MAX)
    : [];
  if (tags.length < POSITIONING_TAGS_MIN) return { error: '브랜드 포지셔닝을 1개 이상 선택해 주세요.' };
  const note = typeof rawPositioning.note === 'string' ? rawPositioning.note.slice(0, POSITIONING_NOTE_MAX) : '';

  const category = body.category as Category;
  if (!CATEGORIES.includes(category)) return { error: '카테고리를 선택해 주세요.' };

  // ── 제품 섹션 (선택 — 절삭 정규화만)
  const keyIngredients = typeof body.keyIngredients === 'string'
    ? body.keyIngredients.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8)
    : [];
  const priceJpy = Number(body.priceJpy);
  const base = {
    brandName,
    positioning: { tags, note },
    category,
    targetMemo: typeof body.targetMemo === 'string' ? body.targetMemo.slice(0, 500) : undefined,
    productName: typeof body.productName === 'string' ? body.productName.slice(0, 120) : undefined,
    keyIngredients: keyIngredients.length ? keyIngredients : undefined,
    priceJpy: Number.isFinite(priceJpy) && priceJpy > 0 ? priceJpy : undefined,
  };

  // ── 콘텐츠 → 모드 판정 (§3.3). 제출된 콘텐츠에만 게이트가 발동한다
  const sourceType = body.sourceType === 'url' ? 'url' : 'text';
  const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
  const sourceText = typeof body.sourceText === 'string' ? body.sourceText : '';
  const hasContent = sourceType === 'url' ? sourceUrl.length > 0 : contentCharCount(sourceText) > 0;

  if (!hasContent) {
    // 브랜드 진단 — 제품 필드 일부가 입력됐어도 에러가 아니다(사실은 스냅샷에 담는다, §3.3)
    return { input: { mode: 'brand', ...base } };
  }

  if (sourceType === 'url') {
    if (!isValidHttpUrl(sourceUrl)) return { error: 'http(s)로 시작하는 URL을 입력해 주세요.' };
  } else if (contentCharCount(sourceText) < HARD_GATE_CHARS) {
    return { error: '최소 50자 이상 콘텐츠가 필요합니다(하드 게이트).' };
  }

  // 제품 분류 미입력 → '미상' 정규화(스펙 §3.2 — 새 값을 만들지 않는다)
  const productClass = PRODUCT_CLASSES.includes(body.productClass as ProductClass)
    ? (body.productClass as ProductClass)
    : '미상';

  return {
    input: {
      mode: 'brandProduct',
      ...base,
      sourceType,
      sourceUrl: sourceType === 'url' ? sourceUrl : undefined,
      sourceText: sourceType === 'text' ? sourceText : undefined,
      productClass,
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
