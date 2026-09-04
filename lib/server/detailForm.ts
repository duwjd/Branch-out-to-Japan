/**
 * 상세페이지 폼(FormData) 파싱 — 제출 라우트와 구성 미리보기 라우트가 **같은 규칙**을 쓴다.
 * 규칙이 갈리면 "확인 화면에서 본 구성"과 "실제 생성된 구성"이 달라지므로 한 곳에 둔다.
 *
 * 클라이언트·서버 이중 검증(② DETAIL-08) — 버튼 잠금을 우회해도 여기서 차단한다.
 */

import type { DetailInput, DetailOptionAxis, DetailProductCategory, PromoInput, ThumbnailProof } from '../db/store';
import { PLATFORMS, type Platform } from '../studio/platform';
import { getDetailPack, type TemplateId } from '../studio/detail/blockPack';
import { resolveTheme } from '../studio/detail/theme';
import { allowsPromoLayer, type BlockType } from '../studio/detail/output';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** 비전 콜 계약(client.ts images 1~10장) */
export const MAX_SOURCE_IMAGES = 10;
export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/** 상세 폼이 받는 상품 종류 6종. `products.category`(자유 텍스트)와 다르다 — 프리필이 이걸로 대조한다 */
export const CATEGORIES: DetailProductCategory[] = ['skincare', 'suncare', 'makeup', 'cleansing', 'haircare', 'etc'];
const OPTION_AXES: DetailOptionAxis[] = ['color', 'size', 'set', 'variant'];

export interface ParsedDetailForm {
  /**
   * 어느 제품으로 만드는가(`products.id`). **필수** — 이 칸이 없어서 생성기가 일본어
   * 상품명을 지어냈다(UT-58). 실제로 그 브랜드의 제품인지는 호출부가 확인한다
   * (여기는 FormData 만 보므로 저장소를 알지 못한다).
   */
  productId: string;
  templateId: TemplateId;
  platform: Platform;
  note: string;
  detailInput: DetailInput;
  disabledBlocks: BlockType[];
  /**
   * 확인 화면이 돌려보낸 일본어 변환값(`{path, kr, ja}` 목록).
   * 여기서는 형태만 검사하고 **채택하지 않는다** — 원문 대조·숫자 검사·한글 잔존 검사는
   * 서버가 파싱한 입력 기준으로 다시 해야 하므로 호출부가 `verifyClientTranslation` 을 태운다.
   */
  clientTranslation: { path: string; kr: string; ja: string }[] | null;
}

/** hidden 필드 `translationJson` 파싱 — 형태가 어긋나면 없는 것으로 본다(서버가 재번역한다). */
function parseTranslationJson(form: FormData): { path: string; kr: string; ja: string }[] | null {
  const raw = text(form, 'translationJson');
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const out: { path: string; kr: string; ja: string }[] = [];
    for (const e of parsed) {
      if (!e || typeof e !== 'object') continue;
      const r = e as { path?: unknown; kr?: unknown; ja?: unknown };
      if (typeof r.path === 'string' && typeof r.kr === 'string' && typeof r.ja === 'string') {
        out.push({ path: r.path, kr: r.kr, ja: r.ja });
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

/** 줄 단위 입력 → 배열(빈 줄 제거). textarea 계약. */
function lines(form: FormData, key: string): string[] {
  return String(form.get(key) ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `A|B|C` 줄들 → 열 배열. 모자란 열은 빈 문자열. */
function rows(form: FormData, key: string, cols: number): string[][] {
  return lines(form, key).map((l) => {
    const parts = l.split('|').map((s) => s.trim());
    return Array.from({ length: cols }, (_, i) => parts[i] ?? '');
  });
}

/**
 * 폼을 파싱한다. 사용자에게 보여줄 오류가 있으면 { error } 를 돌려준다.
 * 이미지 저장은 하지 않는다 — 호출부(제출 라우트)가 담당하고, 미리보기는 저장 없이 돈다.
 */
export function parseDetailForm(form: FormData, sourceImagePaths: string[]): ParsedDetailForm | { error: string } {
  const productId = text(form, 'productId');
  if (!productId) return { error: '어느 제품인지 먼저 골라 주세요.' };

  const templateId = text(form, 'templateId');
  const knownTemplates = getDetailPack().templates.map((t) => t.id as string);
  if (!knownTemplates.includes(templateId)) return { error: '템플릿을 1개 선택해 주세요.' };

  const platformRaw = text(form, 'platform') || 'unset';
  const platform: Platform = (PLATFORMS as string[]).includes(platformRaw) ? (platformRaw as Platform) : 'unset';

  const categoryRaw = text(form, 'productCategory');
  if (!(CATEGORIES as string[]).includes(categoryRaw)) return { error: '상품 카테고리를 선택해 주세요.' };
  const productCategory = categoryRaw as DetailProductCategory;

  // 약기법 표시 의무 영역 — 원문 그대로 받고 재가공하지 않는다
  const spec = {
    volume: text(form, 'specVolume'),
    category: text(form, 'specCategory'),
    manufacturer: text(form, 'specManufacturer'),
    origin: text(form, 'specOrigin'),
    fullIngredients: text(form, 'specFullIngredients'),
  };
  if (!spec.volume || !spec.category || !spec.manufacturer) {
    return { error: '내용량·구분·판매원은 표시 의무 항목이라 반드시 필요합니다.' };
  }

  // 근거는 그룹 단위로만 인정한다 — 부분 입력은 블록 미생성(景表法 우량오인 방지)
  const rankTitle = text(form, 'proofRankTitle');
  const genre = text(form, 'proofGenre');
  const aggregationDate = text(form, 'proofDate');
  const proof: ThumbnailProof | null =
    rankTitle && genre && aggregationDate ? { rankTitle, genre, aggregationDate } : null;

  const salesCount = text(form, 'salesCount');
  const salesPeriod = text(form, 'salesPeriod');
  const sales =
    salesCount && salesPeriod
      ? {
          count: salesCount,
          period: salesPeriod,
          reviewCount: text(form, 'salesReviewCount'),
          rating: text(form, 'salesRating'),
        }
      : null;

  const testName = text(form, 'testName');
  const testInstitution = text(form, 'testInstitution');
  const testDate = text(form, 'testDate');
  const testSampleSize = text(form, 'testSampleSize');
  const test =
    testName && testInstitution && testDate && testSampleSize
      ? {
          name: testName,
          condition: text(form, 'testCondition'),
          institution: testInstitution,
          date: testDate,
          sampleSize: testSampleSize,
        }
      : null;

  // 프로모 — 아마존JP A+ 는 가격·프로모션 표기가 규정상 금지라 입력 자체를 막는다
  let promo: PromoInput | null = null;
  const promoSetTitle = text(form, 'promoSetTitle');
  const promoSalePrice = text(form, 'promoSalePrice');
  if (promoSetTitle && promoSalePrice) {
    if (!allowsPromoLayer(platform)) {
      return { error: '아마존JP A+ 콘텐츠는 가격·프로모션 표기가 규정상 금지라 프로모션 입력을 넣을 수 없습니다.' };
    }
    const normalPrice = text(form, 'promoNormalPrice');
    promo = {
      setTitle: promoSetTitle,
      salePrice: promoSalePrice,
      normalPrice,
      // 실적 확인 체크가 없으면 false — 조립 단계가 통상가를 버린다(有利誤認 방지)
      normalPriceVerified: text(form, 'promoNormalPriceVerified') === 'true' && Boolean(normalPrice),
      discountRate: text(form, 'promoDiscountRate'),
      gift: text(form, 'promoGift'),
      qualifierChips: text(form, 'promoQualifiers')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      footnote: text(form, 'promoFootnote'),
    };
  }

  const axisRaw = text(form, 'optionAxis');
  const axis: DetailOptionAxis = (OPTION_AXES as string[]).includes(axisRaw) ? (axisRaw as DetailOptionAxis) : 'color';

  const disabledBlocks = text(form, 'disabledBlocks')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as BlockType[];

  const detailInput: DetailInput = {
    productCategory,
    sourceImagePaths,
    disabledBlocks,
    spec,
    ingredients: rows(form, 'ingredientRows', 3).map(([name, percent, purpose]) => ({ name, percent, purpose })),
    freeOf: lines(form, 'freeOf'),
    specs: rows(form, 'specRows', 2).map(([label, value]) => ({ label, value })),
    howToSteps: lines(form, 'howToSteps'),
    options: rows(form, 'optionRows', 3).map(([name, swatchHex, sku]) => ({ axis, name, swatchHex, sku })),
    cautions: lines(form, 'cautions'),
    proof,
    sales,
    test,
    reviews: rows(form, 'reviewRows', 3).map(([t, rating, age]) => ({ text: t, rating, age })),
    promo,
    modelConsent: text(form, 'modelConsent') === 'true',
    // 산출물 색(§2-7). 폼 값은 **여기서 sanitize 한다** — 화이트리스트(paletteId)와
    // normalizeHex(customAccent)를 통과하지 않으면 사용자 문자열이 그대로 satori 스타일과
    // AI 프롬프트에 들어간다. 해석은 theme.ts 가 하고 결과만 자산에 스냅샷된다.
    theme: resolveTheme(
      {
        source: (['custom', 'palette', 'auto'] as const).find((v) => v === text(form, 'themeSource')) ?? 'auto',
        paletteId: text(form, 'themePaletteId'),
        customAccent: text(form, 'themeCustomAccent'),
        moodId: text(form, 'themeMoodId'),
        extracted: text(form, 'themeExtracted'),
      },
      productCategory,
    ) as unknown as Record<string, unknown>,
  };

  return {
    productId,
    templateId: templateId as TemplateId,
    platform,
    note: text(form, 'note'),
    detailInput,
    disabledBlocks,
    clientTranslation: parseTranslationJson(form),
  };
}

/**
 * `parseDetailForm` 의 **역방향** — 저장된 입력을 폼 필드 값으로 편다(DETAIL-01c 프리필).
 *
 * 여기가 `parseDetailForm` 과 **같은 파일에 사는 이유**는 둘이 하나의 계약이기 때문이다.
 * 필드 이름을 한쪽에서만 바꾸면 프리필이 조용히 빈 칸을 채우게 된다.
 *
 * 파일 입력(`productImage`·`images`·`modelImage`)은 **넣지 않는다** — 프로그램으로 채울 수 없다.
 * 제어 상태로 사는 값(`templateId`·`platform`·테마)도 대상이 아니다. 여기는 **텍스트 칸만** 편다.
 */
export function toFormFields(input: DetailInput): Record<string, string> {
  const out: Record<string, string> = {
    productCategory: input.productCategory,
    specVolume: input.spec.volume,
    specCategory: input.spec.category,
    specManufacturer: input.spec.manufacturer,
    specOrigin: input.spec.origin,
    specFullIngredients: input.spec.fullIngredients,
    ingredientRows: input.ingredients.map((i) => [i.name, i.percent, i.purpose].join(' | ')).join('\n'),
    freeOf: input.freeOf.join('\n'),
    specRows: input.specs.map((s) => [s.label, s.value].join(' | ')).join('\n'),
    howToSteps: input.howToSteps.join('\n'),
    optionAxis: input.options[0]?.axis ?? 'color',
    optionRows: input.options.map((o) => [o.name, o.swatchHex ?? '', o.sku ?? ''].join(' | ')).join('\n'),
    cautions: input.cautions.join('\n'),
    reviewRows: input.reviews.map((r) => [r.text, r.rating, r.age].join(' | ')).join('\n'),
  };

  // 근거는 그룹 단위라 부분만 채우면 블록이 안 붙는다 — 있는 그룹만 통째로 편다
  if (input.proof) {
    out.proofRankTitle = input.proof.rankTitle;
    out.proofGenre = input.proof.genre;
    out.proofDate = input.proof.aggregationDate;
  }
  if (input.sales) {
    out.salesCount = input.sales.count;
    out.salesPeriod = input.sales.period;
    out.salesReviewCount = input.sales.reviewCount ?? '';
    out.salesRating = input.sales.rating ?? '';
  }
  if (input.test) {
    out.testName = input.test.name;
    out.testCondition = input.test.condition;
    out.testInstitution = input.test.institution;
    out.testDate = input.test.date;
    out.testSampleSize = input.test.sampleSize;
  }
  if (input.promo) {
    out.promoSetTitle = input.promo.setTitle;
    out.promoSalePrice = input.promo.salePrice;
    out.promoNormalPrice = input.promo.normalPrice;
    // 실적 확인 체크는 **되살리지 않는다.** 통상가 취소선은 사람이 매번 확인해야 하는
    // 有利誤認 방지 장치라, 지난 생성의 체크를 자동으로 물려주면 그 장치가 무력해진다.
    out.promoDiscountRate = input.promo.discountRate;
    out.promoGift = input.promo.gift;
    out.promoQualifiers = input.promo.qualifierChips.join(', ');
    out.promoFootnote = input.promo.footnote;
  }

  // 빈 값은 아예 내려보내지 않는다 — 프리필이 사용자가 이미 적은 칸을 지우지 않게 한다
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== ''));
}

/** 업로드 파일 유효성 — 저장 전에 검사한다. */
export function validateImages(files: UploadMeta[]): string | null {
  if (files.length === 0) return '제품 이미지를 올려 주세요.';
  if (files.length > MAX_SOURCE_IMAGES) return `이미지는 최대 ${MAX_SOURCE_IMAGES}장까지 올릴 수 있습니다.`;
  for (const f of files) {
    if (!IMAGE_MIMES.includes(f.type)) return 'JPG·PNG·WebP만 업로드할 수 있습니다.';
    if (f.size > MAX_UPLOAD_BYTES) return '10MB 이하 이미지만 업로드할 수 있습니다.';
  }
  return null;
}

/**
 * 업로드 메타(형식·크기)만 — 검증에 필요한 건 이 둘과 개수뿐이다. `File`이 구조적으로 만족한다.
 * 구성 미리보기(plan)는 바이트가 필요 없어 이 형태만 받는다.
 */
export interface UploadMeta {
  type: string;
  size: number;
}

/**
 * hidden 필드 `imageMeta` 파싱 — 구성 미리보기에서 파일 바이트 대신 오는 메타 목록.
 *
 * 왜 필요한가: plan 라우트는 이미지를 저장하지도 읽지도 않고 **개수만** 쓰는데,
 * 예전에는 블록 배지를 토글할 때마다 원본 파일 전체(최대 10장 × 10MB)를 다시 올렸다.
 * 형태가 어긋나면 null — 호출부가 실제 파일로 폴백한다.
 */
export function parseImageMeta(form: FormData): UploadMeta[] | null {
  const raw = text(form, 'imageMeta');
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const out: UploadMeta[] = [];
    for (const e of parsed) {
      if (!e || typeof e !== 'object') return null;
      const r = e as { type?: unknown; size?: unknown };
      if (typeof r.type !== 'string' || typeof r.size !== 'number') return null;
      out.push({ type: r.type, size: r.size });
    }
    return out;
  } catch {
    return null;
  }
}
