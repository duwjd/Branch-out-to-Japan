/**
 * 상세페이지 폼(FormData) 파싱 — 제출 라우트와 구성 미리보기 라우트가 **같은 규칙**을 쓴다.
 * 규칙이 갈리면 "확인 화면에서 본 구성"과 "실제 생성된 구성"이 달라지므로 한 곳에 둔다.
 *
 * 클라이언트·서버 이중 검증(② DETAIL-08) — 버튼 잠금을 우회해도 여기서 차단한다.
 */

import type { DetailInput, DetailOptionAxis, DetailProductCategory, PromoInput, ThumbnailProof } from '../db/store';
import { PLATFORMS, type Platform } from '../studio/platform';
import { getDetailPack, type TemplateId } from '../studio/detail/blockPack';
import { allowsPromoLayer, type BlockType } from '../studio/detail/output';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** 비전 콜 계약(client.ts images 1~10장) */
export const MAX_SOURCE_IMAGES = 10;
export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const CATEGORIES: DetailProductCategory[] = ['skincare', 'suncare', 'makeup', 'cleansing', 'haircare', 'etc'];
const OPTION_AXES: DetailOptionAxis[] = ['color', 'size', 'set', 'variant'];

export interface ParsedDetailForm {
  templateId: TemplateId;
  platform: Platform;
  note: string;
  detailInput: DetailInput;
  disabledBlocks: BlockType[];
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
      qualifierChips: text(form, 'promoQualifiers').split(',').map((s) => s.trim()).filter(Boolean),
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
  };

  return { templateId: templateId as TemplateId, platform, note: text(form, 'note'), detailInput, disabledBlocks };
}

/** 업로드 파일 유효성 — 저장 전에 검사한다. */
export function validateImages(files: File[]): string | null {
  if (files.length === 0) return '제품 이미지를 올려 주세요.';
  if (files.length > MAX_SOURCE_IMAGES) return `이미지는 최대 ${MAX_SOURCE_IMAGES}장까지 올릴 수 있습니다.`;
  for (const f of files) {
    if (!IMAGE_MIMES.includes(f.type)) return 'JPG·PNG·WebP만 업로드할 수 있습니다.';
    if (f.size > MAX_UPLOAD_BYTES) return '10MB 이하 이미지만 업로드할 수 있습니다.';
  }
  return null;
}
