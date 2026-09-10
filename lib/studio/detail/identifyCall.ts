/**
 * 제품 식별 — 제품컷 + 웹 검색으로 제품 후보를 찾는다(BRAND-03b 3b-5).
 *
 * **담당이 나뉘어 있다.** 스펙 7칸은 브랜드가 소유한 KR 원본이 강하고(콜⑩ specExtract),
 * 등재명·카테고리는 웹이 강하다 — 일본 등재명은 브랜드 본인도 모르는 경우가 많다.
 *
 * **후보 0건이 정상 경로다.** 2~30인 브랜드의 신제품·미출시 제품은 웹에 없다.
 * 0건을 실패로 다루면 폴백(수동 입력)이 곁다리가 되고, 그러면 이 기능은 등록을 느리게만 만든다.
 */

import { runWebSearchCall, type WebSearchSource } from '../../engine/llm/client';

/** 제품 등록 폼이 채우는 칸과 같은 이름을 쓴다 */
export interface ProductCandidate {
  nameKr: string;
  nameJa: string;
  category: string;
  /** 이 후보를 어디서 봤는지. **없으면 카드로 세우지 않는다** */
  sourceUrl: string;
}

export interface IdentifyResult {
  candidates: ProductCandidate[];
  /** 서버 툴이 실패했을 때의 사유(예외가 아니라 200 으로 온다) */
  toolError: string | null;
}

/** 제품 등록 모달의 카테고리 셀렉트와 같은 목록 — 모델이 다른 라벨을 지어내지 않게 못박는다 */
export const PRODUCT_CATEGORIES = ['스킨케어', '메이크업', '선케어', '클렌징', '기타'];

interface RawResult {
  candidates: { nameKr?: string; nameJa?: string; category?: string; sourceUrl?: string }[];
}

export interface IdentifyOptions {
  /** 제품 대표컷 1장. 여러 장을 보내도 식별에 보태는 게 없다 */
  image: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string };
  /** 사용자가 이미 적은 브랜드명 — 있으면 검색이 훨씬 정확해진다 */
  brandName?: string;
  /** 사용자가 이미 적은 제품명 — 이미지만으로 못 찾을 때의 단서 */
  nameHint?: string;
  timeoutMs: number;
}

/** 목 응답 — 실 키 없이도 후보 카드·출처 배지 동선을 볼 수 있다 */
const MOCK: RawResult = {
  candidates: [
    {
      nameKr: '시카 진정 앰플',
      nameJa: 'シカ鎮静アンプル',
      category: '스킨케어',
      sourceUrl: 'https://example.co.jp/products/cica-ampoule',
    },
    {
      nameKr: '시카 앰플 세럼',
      nameJa: 'シカアンプルセラム',
      category: '스킨케어',
      sourceUrl: 'https://example.jp/item/cica-serum',
    },
  ],
};

const MOCK_SOURCES: WebSearchSource[] = [
  { url: 'https://example.co.jp/products/cica-ampoule', title: 'シカ鎮静アンプル — 商品ページ' },
];

/**
 * 제품컷으로 후보를 찾는다. 못 찾으면 빈 배열을 돌려준다 — 예외를 던지지 X.
 *
 * 호출부(라우트)가 실패를 200 으로 접으므로 여기서도 같은 계약을 지킨다:
 * **검색이 안 되는 것은 등록이 안 되는 것과 다르다.**
 */
export async function runProductIdentify(opts: IdentifyOptions): Promise<IdentifyResult> {
  const payload = [
    '[작업] 첨부한 제품 사진의 화장품이 무엇인지 웹에서 찾아 **후보**를 제시한다.',
    opts.brandName ? `[브랜드] ${opts.brandName}` : '',
    opts.nameHint ? `[사용자가 적은 제품명] ${opts.nameHint}` : '',
    [
      '[찾을 것]',
      '- nameKr : 한국어 제품명',
      '- nameJa : 일본에서 판매·등재된 일본어 제품명. 일본 판매처가 없으면 빈 문자열',
      `- category : 다음 중 하나만 고른다 — ${PRODUCT_CATEGORIES.join(' / ')}`,
      '- sourceUrl : 그 정보를 본 페이지 주소',
    ].join('\n'),
    [
      '[출력 규칙]',
      '- JSON 만 출력한다. 형식: {"candidates":[{"nameKr":"","nameJa":"","category":"","sourceUrl":""}]}',
      '- **확인한 페이지가 없으면 candidates 를 빈 배열로 둔다.** 후보 0건은 정상적인 답이다.',
      '- sourceUrl 이 없는 후보는 담지 마라. 출처 없이 이름만 지어내는 것이 가장 나쁜 답이다.',
      '- 신제품·미출시 제품은 웹에 없을 수 있다. 그럴 때 비슷한 다른 제품으로 채우지 마라.',
      '- 후보는 최대 3개.',
    ].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');

  const { data, sources, toolError } = await runWebSearchCall<RawResult>({
    callName: 'productIdentify',
    system:
      '너는 화장품 제품 사진을 보고 웹에서 그 제품을 찾아 주는 도구다. ' +
      '찾은 것만 말하고, 확인한 출처가 없으면 후보를 만들지 않는다. 빈 결과를 돌려주는 것이 정상 동작이다.',
    userPayload: payload,
    images: [opts.image],
    // 검색을 무한정 돌리지 않는다 — 등록 화면에서 사용자가 기다리는 시간이다
    maxUses: 4,
    // 일본 등재명을 찾는 것이 이 콜의 주된 값이라 검색 지역을 일본으로 둔다
    userLocation: { type: 'approximate', country: 'JP' },
    timeoutMs: opts.timeoutMs,
    mockData: MOCK,
    mockSources: MOCK_SOURCES,
  });

  const known = new Set(PRODUCT_CATEGORIES);
  const candidates = (data.candidates ?? [])
    .map((c) => ({
      nameKr: String(c.nameKr ?? '').trim(),
      nameJa: String(c.nameJa ?? '').trim(),
      // 모르는 라벨은 버린다 — 셀렉트에 없는 값이 들어가면 화면이 빈 칸으로 보인다
      category: known.has(String(c.category ?? '').trim()) ? String(c.category).trim() : '',
      sourceUrl: String(c.sourceUrl ?? '').trim(),
    }))
    // 출처 없는 후보는 세우지 X. 이름만 있는 후보는 검색이 아니라 추측이다
    .filter((c) => c.nameKr && c.sourceUrl.startsWith('http'))
    .slice(0, 3);

  // 모델이 출처를 흘렸는데 검색은 돌았다면, 검색이 실제로 무엇을 봤는지만 남긴다
  if (candidates.length === 0 && sources.length > 0) {
    return { candidates: [], toolError };
  }
  return { candidates, toolError };
}
