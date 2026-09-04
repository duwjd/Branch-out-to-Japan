/**
 * GET /api/studio/detail/prefill?productId=… — 상세 폼 프리필(DETAIL-01c).
 *
 * 우선순위 3단으로 **먼저 값이 있는 쪽이 이긴다.**
 *  1. 그 제품의 가장 최근 완료 상세 자산의 입력 — 시즌·채널마다 다시 만드는 실제 패턴
 *  2. 제품 자산(`products`) — 상품 종류
 *  3. 브랜드 킷 — 무첨가 등 브랜드 공통값이 있으면
 *
 * 값과 함께 **출처를 돌려준다.** 화면이 "지난 생성에서 가져왔습니다"를 말해야 하기 때문이다 —
 * 조용히 채우면 사용자가 placeholder 로 오인해 그대로 제출한다(UT-31).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { getStore } from '@/lib/db/store';
import { CATEGORIES as DETAIL_CATEGORIES, toFormFields } from '@/lib/server/detailForm';
import { restoreKoreanInput } from '@/lib/studio/detail/translate';

/** 값 하나의 출처 — 화면 배지 문구가 여기서 갈린다 */
export type PrefillSource = 'lastAsset' | 'product' | 'brandKit';

export async function GET(request: Request): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const productId = new URL(request.url).searchParams.get('productId')?.trim();
  if (!productId) return NextResponse.json({ error: '제품을 선택해 주세요.' }, { status: 400 });

  const brand = await getActiveBrand();
  if (!brand) return NextResponse.json({ error: '브랜드를 먼저 등록해 주세요.' }, { status: 400 });

  const store = await getStore();
  const products = await store.listProducts(brand.id);
  const product = products.find((p) => p.id === productId);
  if (!product) return NextResponse.json({ error: '선택한 제품을 찾을 수 없습니다.' }, { status: 404 });

  const fields: Record<string, string> = {};
  const sources: Record<string, PrefillSource> = {};
  /** 이미 채워진 칸은 덮지 않는다 — 우선순위가 그대로 승부를 낸다 */
  const put = (values: Record<string, string>, source: PrefillSource) => {
    for (const [k, v] of Object.entries(values)) {
      if (!v.trim() || fields[k] !== undefined) continue;
      fields[k] = v;
      sources[k] = source;
    }
  };

  // ① 지난 생성 — 완료된 상세 자산 중 가장 최근 것
  const summaries = await store.listAssets(brand.id);
  const lastDone = summaries.find((a) => a.kind === 'detail' && a.status === 'done' && a.productId === productId);
  let lastAssetAt: string | null = null;
  /** 지난 생성에서 이어받을 **선택**(칸이 아니라 라디오·카드다) — 화면이 setState 로 적용한다 */
  let lastChoice: { templateId: string; platform: string } | null = null;
  // 목록 요약에는 detailInput 이 없다(무거운 jsonb 는 빠져 있다) — 전체 레코드를 따로 받는다
  const full = lastDone ? await store.getAsset(lastDone.id) : null;
  if (full?.detailInput) {
    // ⚠ 저장된 입력은 **일본어**다. 한국어 폼에 그대로 넣지 않는다 — sourceKo 로 되돌린다
    put(toFormFields(restoreKoreanInput(full.detailInput)), 'lastAsset');
    lastAssetAt = full.createdAt;
    // `styleCategory` 가 곧 템플릿 ID 다(`runDetailJob` 이 그렇게 읽는다). 채널도 같이 잇는다 —
    // 이 둘이 빠지면 2회차에도 카드를 다시 고르게 되어 「제품 선택 하나」가 성립하지 않는다.
    lastChoice = { templateId: full.styleCategory, platform: full.platform };
  }

  // ② 제품 자산 — `products.category` 는 자유 텍스트("토너"·"앰플"…)라 폼의 6종과 다르다.
  //    우연히 같은 값일 때만 쓴다. 아니면 채우지 않는다(잘못 고른 칩이 시퀀스를 통째로 바꾼다).
  if ((DETAIL_CATEGORIES as readonly string[]).includes(product.category)) {
    put({ productCategory: product.category }, 'product');
  }

  // ③ 브랜드 킷 — **지금은 채울 것이 없다.** 킷이 들고 있는 값(productNamesJa·forbiddenTerms·
  //    toneGuide)은 어느 것도 이 폼의 칸이 아니다. 우선순위 자리만 남겨 둔다.

  const primary = product.images.find((im) => im.isPrimary) ?? product.images[0] ?? null;
  return NextResponse.json({
    product: {
      id: product.id,
      nameKr: product.nameKr,
      nameJa: product.nameJa,
      category: product.category,
      primaryFileId: primary?.fileId ?? null,
    },
    fields,
    sources,
    /** 지난 생성이 언제였는지 — 화면이 "8/21 생성분에서 가져왔습니다"로 말한다 */
    lastAssetAt,
    lastChoice,
  });
}
