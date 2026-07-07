/**
 * 라쿠텐 이치바 상품검색 API 클라이언트 (공식 API).
 * 문서: https://webservice.rakuten.co.jp/documentation/ichiba-item-search
 * 앱ID(applicationId)만 있으면 무료 사용. 요청은 저속(호출측에서 딜레이)으로.
 */

const ENDPOINT = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';

/** @param {number} ms */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 상품검색 API를 1페이지 호출한다.
 * @param {object} opts
 * @param {string} opts.applicationId 라쿠텐 앱ID
 * @param {string} opts.keyword 검색어(일본어)
 * @param {number} opts.page 페이지 번호(1~100)
 * @param {number} [opts.hits] 페이지당 건수(최대 30)
 * @param {string} [opts.sort] 정렬(예: '-reviewCount' 리뷰 많은 순)
 * @returns {Promise<{items: object[], pageCount: number}>}
 */
export async function searchItems({ applicationId, keyword, page, hits = 30, sort = 'standard' }) {
  const params = new URLSearchParams({
    applicationId,
    keyword,
    page: String(page),
    hits: String(hits),
    sort,
    imageFlag: '1', // 이미지 있는 상품만
    format: 'json',
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: { 'User-Agent': 'branch-out-to-japan-research/0.1 (internal analysis)' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Rakuten API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const items = (json.Items ?? []).map((wrap) => wrap.Item);
  return { items, pageCount: json.pageCount ?? 0 };
}

/**
 * 라쿠텐 Item → 우리 카탈로그 레코드로 매핑.
 * @param {object} item 라쿠텐 Item 객체
 * @param {object} meta @param {string} meta.category 우리 분류 @param {string} meta.collectedAt
 * @returns {object} product-catalog.jsonl 레코드
 */
export function toCatalogRecord(item, { category, collectedAt }) {
  // mediumImageUrls는 [{ imageUrl }] 형태. 쿼리스트링(_ex=128x128)을 키워 원본에 가깝게.
  const rawUrl = item.mediumImageUrls?.[0]?.imageUrl ?? '';
  const imageUrl = rawUrl.replace(/\?_ex=\d+x\d+$/, '?_ex=300x300');
  // itemCode의 콜론 등은 파일명·id 안전 문자로 정리(Windows/툴 호환).
  const safeCode = String(item.itemCode ?? '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    id: `rakuten_${safeCode}`,
    source: 'rakuten',
    type: 'thumbnail',
    productName: item.itemName ?? '',
    brand: item.shopName ?? '',
    category,
    price: item.itemPrice ?? null,
    reviewCount: item.reviewCount ?? 0,
    sourceUrl: item.itemUrl ?? '',
    imageUrl,
    localPath: `raw/product-thumbnails/rakuten/rakuten_${safeCode}.jpg`,
    collectedAt,
    license: '브랜드/셀러 저작물 — 내부 분석용',
  };
}
