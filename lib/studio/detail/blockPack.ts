/**
 * 상세페이지 블록 팩 로더 + 결정적 시퀀스 조립.
 * 썸네일 promptPack.ts 의 법적 게이트를 블록 단위로 승계한다:
 *  - 근거(실적·시험·리뷰)가 미충족이면 그 블록을 **시퀀스에서 통째로 제거**한다.
 *  - 가격·할인은 LLM 산출을 채택하지 않고 사용자 입력만 코드가 자단위로 조립한다.
 *  - 제외는 실패가 아니라 기본값이다. 다만 **왜 빠졌는지**를 항상 반환해 화면이 설명하게 한다.
 *
 * LLM은 이 단계에 개입하지 않는다 — 같은 입력이면 같은 시퀀스가 나와야 하기 때문이다.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DetailInput, DetailOptionAxis, DetailProductCategory, PromoInput, ThumbnailProof } from '../../db/store';

// 엔티티 타입은 저장 계층이 소유한다 — 여기서는 도메인 이름으로 재수출만 한다
export type { DetailInput } from '../../db/store';
export type ProductCategory = DetailProductCategory;
export type OptionAxis = DetailOptionAxis;
import type { Platform } from '../platform';
import {
  MAX_AI_BLOCKS,
  TEXT_ONLY_BLOCKS,
  allowsPromoLayer,
  type BlockType,
  type RenderKind,
} from './output';

export type TemplateId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6';

export interface SlotDef {
  required: boolean;
  source: 'llm' | 'input' | 'proof' | 'promo' | 'code';
  description: string;
  default?: string;
}

export interface BlockDef {
  id: BlockType;
  code: string;
  nameKo: string;
  nameJa: string;
  role: string;
  renderKind: RenderKind;
  necessity: 'required' | 'optional' | 'conditional';
  layer?: 'promo' | 'proof' | 'option';
  requires: string[];
  /**
   * AI 블록에서 제품이 어떻게 등장하는가. 텍스트 블록에는 없다.
   *  - 'source' : 업로드된 원본 제품컷을 편집 모드로 넘긴다(제품이 화면에 서야 하는 블록)
   *  - 'none'   : 용기·패키지를 아예 그리지 않는다
   * 중간이 없는 이유 — 원본 없이 제품을 그리게 두면 모델이 매번 다른 용기를 지어내
   * 한 상세페이지에 서로 다른 제품이 섞인다(실측: 비교 도해가 히어로와 다른 병을 그림).
   */
  productPresence?: 'source' | 'none';
  promptTemplate?: string;
  slots: Record<string, SlotDef>;
  mustInclude: string[];
  mustNotInclude: string[];
  rubric: string[];
}

export interface TemplateDef {
  id: TemplateId;
  slug: string;
  nameKo: string;
  nameJa: string;
  description: string;
  bestFor: string;
  dominantCategories: ProductCategory[];
  platformFit: Platform[];
  blockSequence: BlockType[];
  signatureBlocks: BlockType[];
}

interface DetailPack {
  version: string;
  targetModel: string;
  inputCleanupNote: { when: string; template: string };
  slotFillingRules: string[];
  defaults: Record<string, unknown>;
  moodProfiles: Record<string, { accent: string; surface: string; keywords: string }>;
  commonConstraints: string[];
  commonNegativeConstraints: string[];
  blockCatalog: BlockDef[];
  conditionalLayers: Record<'promo' | 'proof' | 'option', { insertAt: 'head' | 'body'; blocks: BlockType[]; note: string }>;
  templates: TemplateDef[];
  selectionGuide: {
    byCategory: Record<string, TemplateId[]>;
    byPlatform: Record<string, TemplateId[]>;
    tieBreakRules: string[];
  };
}

export interface BlockPlan {
  seq: number;
  blockId: BlockType;
  code: string;
  nameKo: string;
  renderKind: RenderKind;
  layer: 'promo' | 'proof' | 'option' | null;
  /** 템플릿의 서명 블록인가(화면에서 강조) */
  signature: boolean;
}

export interface ExcludedBlock {
  blockId: BlockType;
  code: string;
  nameKo: string;
  /** 사용자에게 그대로 보여줄 한국어 사유 */
  reason: string;
  /** 어떤 입력을 채우면 살아나는지(없으면 입력으로 해결 불가) */
  fixHint: string | null;
}

export interface BlockPlanResult {
  templateId: TemplateId;
  blocks: BlockPlan[];
  excluded: ExcludedBlock[];
  /** AI 이미지 생성이 필요한 블록 수(예산·소요시간 안내용) */
  aiBlockCount: number;
}

let cachedPack: DetailPack | null = null;

/** 팩 로드(프로세스 캐시) — 저장소 루트 기준 상대 경로(promptPack 관례). */
export function getDetailPack(): DetailPack {
  if (!cachedPack) {
    cachedPack = JSON.parse(
      readFileSync(path.join(process.cwd(), 'data/processed/detail-style-prompts.json'), 'utf8'),
    ) as DetailPack;
  }
  return cachedPack;
}

/** 블록 정의 조회 — 미지 id는 즉시 실패. */
export function getBlock(id: string): BlockDef {
  const b = getDetailPack().blockCatalog.find((x) => x.id === id);
  if (!b) throw new Error(`unknown detail block: ${id}`);
  return b;
}

/** 템플릿 정의 조회 — 미지 id는 즉시 실패. */
export function getTemplate(id: string): TemplateDef {
  const t = getDetailPack().templates.find((x) => x.id === id);
  if (!t) throw new Error(`unknown detail template: ${id}`);
  return t;
}

/** 카테고리 기본 템플릿(selectionGuide.tieBreakRules 마지막 규칙). */
export function defaultTemplateFor(category: ProductCategory): TemplateId {
  return getDetailPack().selectionGuide.byCategory[category]?.[0] ?? 'D1';
}

/** 화면용 템플릿 메타 — 라벨은 평문, 내부 ID는 값으로만 쓴다(② 라벨 정책). */
export interface TemplateUiMeta {
  id: TemplateId;
  slug: string;
  nameKo: string;
  description: string;
  bestFor: string;
  platformFit: Platform[];
  /**
   * 이 템플릿이 노리는 상품 종류. 카드의 「추천」 배지가 **플랫폼만** 보면
   * 라쿠텐에서 6장 전부에 배지가 붙어 아무것도 구분하지 못한다 — 카테고리와 함께 봐야 한다.
   */
  dominantCategories: ProductCategory[];
  /** 카드에 그릴 미니 블록 시퀀스(한국어 블록명) */
  sequencePreview: string[];
}

export function templateUiMetas(): TemplateUiMeta[] {
  return getDetailPack().templates.map((t) => ({
    id: t.id,
    slug: t.slug,
    nameKo: t.nameKo,
    description: t.description,
    bestFor: t.bestFor,
    platformFit: t.platformFit,
    dominantCategories: t.dominantCategories,
    sequencePreview: t.blockSequence.map((b) => getBlock(b).nameKo),
  }));
}

/** proof 3필드 완비 여부 — 썸네일 badgeParagraphs 와 같은 판정. */
function hasProof(proof: ThumbnailProof | null): boolean {
  return Boolean(proof && proof.rankTitle.trim() && proof.genre.trim() && proof.aggregationDate.trim());
}

function colorOptionCount(input: DetailInput): number {
  return input.options.filter((o) => o.axis === 'color').length;
}

function nonColorOptionCount(input: DetailInput): number {
  return input.options.filter((o) => o.axis !== 'color').length;
}

/** requires 토큰 1개를 평가한다. 충족이면 null, 아니면 {사유, 해결 힌트}. */
function checkRequirement(token: string, input: DetailInput): { reason: string; fixHint: string | null } | null {
  switch (token) {
    case 'ingredients':
      return input.ingredients.length > 0
        ? null
        : { reason: '성분 데이터가 없어 넣지 않았습니다. 성분명을 지어내지 않습니다.', fixHint: '성분 데이터' };
    case 'freeOf':
      return input.freeOf.length > 0
        ? null
        : { reason: '무첨가 항목이 입력되지 않았습니다.', fixHint: '무첨가 항목' };
    case 'specs':
      return input.specs.length > 0
        ? null
        : { reason: '스펙 수치가 입력되지 않았습니다.', fixHint: '제품 스펙' };
    case 'howToSteps':
      return input.howToSteps.length > 0
        ? null
        : { reason: '사용법 STEP이 입력되지 않았습니다.', fixHint: '사용법' };
    case 'reviews':
      return input.reviews.length > 0
        ? null
        : { reason: '실제 리뷰 원문이 없습니다. 후기를 생성하지 않습니다.', fixHint: '고객 리뷰' };
    case 'modelConsent':
      return input.modelConsent
        ? null
        : { reason: '모델컷 사용 권한 동의가 없어 넣지 않았습니다.', fixHint: '모델컷 동의' };
    case 'options.color>=2':
      return colorOptionCount(input) >= 2
        ? null
        : { reason: '색상 옵션이 2개 미만입니다.', fixHint: '옵션 정보' };
    case 'options.color>=6':
      return colorOptionCount(input) >= 6
        ? null
        : { reason: '색상 옵션이 6개 미만이라 차트 대신 칩만 넣었습니다.', fixHint: null };
    case 'options.nonColor>=2':
      return nonColorOptionCount(input) >= 2
        ? null
        : { reason: '비교할 라인업 옵션이 2개 미만입니다.', fixHint: '옵션 정보' };
    case 'promo.setTitle':
    case 'promo.salePrice': {
      const field = token.split('.')[1] as 'setTitle' | 'salePrice';
      const label = field === 'setTitle' ? '세트명' : '판매가';
      return input.promo && input.promo[field].trim()
        ? null
        : { reason: `프로모션 ${label}이 없어 가격 블록을 넣지 않았습니다. 가격은 지어내지 않습니다.`, fixHint: '프로모션 입력' };
    }
    case 'proof.rankTitle':
    case 'proof.genre':
    case 'proof.aggregationDate':
      return hasProof(input.proof)
        ? null
        : { reason: '실적 3필드(실적명·부문·집계일)가 모두 채워지지 않아 넣지 않았습니다.', fixHint: '실적 근거' };
    case 'sales.count':
    case 'sales.period':
      return input.sales && input.sales.count.trim() && input.sales.period.trim()
        ? null
        : { reason: '누적 판매 수와 집계 기간이 함께 있어야 넣을 수 있습니다.', fixHint: '누적 판매' };
    case 'test.name':
    case 'test.condition':
    case 'test.institution':
    case 'test.date':
    case 'test.sampleSize': {
      const t = input.test;
      const complete = Boolean(t && t.name.trim() && t.institution.trim() && t.date.trim() && t.sampleSize.trim());
      return complete
        ? null
        : { reason: '시험 근거(시험명·기관·시점·n수)가 모두 채워지지 않아 넣지 않았습니다.', fixHint: '시험 근거' };
    }
    case 'spec.volume':
    case 'spec.category':
    case 'spec.manufacturer': {
      const field = token.split('.')[1] as 'volume' | 'category' | 'manufacturer';
      const label = { volume: '내용량', category: '구분', manufacturer: '판매원' }[field];
      return input.spec[field].trim()
        ? null
        : { reason: `제품 스펙의 ${label}이 비어 있습니다. 표시 의무 항목이라 원문이 필요합니다.`, fixHint: '제품 스펙' };
    }
    default:
      // 미지 토큰은 통과시키지 않는다 — 팩 오타가 조용히 게이트를 무력화하면 안 된다
      throw new Error(`unknown block requirement token: ${token}`);
  }
}

/**
 * 템플릿 + 조건부 레이어 + 게이트로 블록 시퀀스를 결정한다(결정적, LLM 미개입).
 *
 * 순서: 템플릿 시퀀스 → 레이어 삽입(프로모·실적은 head, 옵션은 body) → 게이트 → AI 상한 →
 *       각주 블록을 항상 마지막으로.
 */
export function planBlocks(
  input: DetailInput,
  platform: Platform,
  templateId?: TemplateId,
  /** 사용자가 확인 화면에서 끈 블록. 필수 블록은 끌 수 없다(무시된다) */
  disabled: BlockType[] = [],
): BlockPlanResult {
  const pack = getDetailPack();
  const tid = templateId ?? defaultTemplateFor(input.productCategory);
  const template = getTemplate(tid);
  const signature = new Set<BlockType>(template.signatureBlocks);

  const head: BlockType[] = [];
  const body: BlockType[] = [...template.blockSequence];
  const excluded: ExcludedBlock[] = [];

  const pushExcluded = (id: BlockType, reason: string, fixHint: string | null) => {
    if (excluded.some((e) => e.blockId === id)) return;
    const def = getBlock(id);
    excluded.push({ blockId: id, code: def.code, nameKo: def.nameKo, reason, fixHint });
  };

  // ── 조건부 레이어 삽입 ─────────────────────────────────────────────
  // 프로모: A+ 콘텐츠는 가격·프로모션 표기가 규정상 금지라 플랫폼이 먼저 판정한다
  if (!allowsPromoLayer(platform)) {
    for (const id of pack.conditionalLayers.promo.blocks) {
      pushExcluded(id, '아마존JP A+ 콘텐츠는 가격·프로모션 표기가 규정상 금지라 넣지 않았습니다.', null);
    }
  } else {
    head.push(...pack.conditionalLayers.promo.blocks);
  }
  head.push(...pack.conditionalLayers.proof.blocks);

  // 옵션: 축에 따라 삽입 블록이 갈린다. 히어로 다음 자리에 넣는다
  const optionBlocks = pack.conditionalLayers.option.blocks.filter((id) => {
    if (id === 'personal-color-look') return input.productCategory === 'makeup';
    return true;
  });
  const heroAt = body.indexOf('hero-product');
  const insertAt = heroAt >= 0 ? heroAt + 1 : 0;
  for (const id of optionBlocks) {
    if (!body.includes(id)) body.splice(insertAt, 0, id);
  }

  // ── 사용자가 끈 블록 ───────────────────────────────────────────────
  // 필수 블록(히어로·POINT·스펙표·각주)은 끌 수 없다 — 표시 의무·구조가 무너진다
  const disabledSet = new Set<BlockType>(
    disabled.filter((id) => {
      try {
        return getBlock(id).necessity !== 'required';
      } catch {
        return false; // 미지 블록 id 는 조용히 무시
      }
    }),
  );
  for (const id of disabledSet) pushExcluded(id, '확인 화면에서 제외하셨습니다.', null);

  // ── 게이트 ────────────────────────────────────────────────────────
  const ordered = [...head, ...body];
  const seen = new Set<BlockType>();
  const passed: BlockType[] = [];
  for (const id of ordered) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (excluded.some((e) => e.blockId === id)) continue;

    const def = getBlock(id);
    let blocked: { reason: string; fixHint: string | null } | null = null;
    for (const token of def.requires) {
      blocked = checkRequirement(token, input);
      if (blocked) break;
    }
    if (blocked) {
      pushExcluded(id, blocked.reason, blocked.fixHint);
      continue;
    }
    passed.push(id);
  }

  // ── AI 블록 상한 ──────────────────────────────────────────────────
  // gpt-image-2 1장이 40~90초라 5장이면 2웨이브가 되어 maxDuration=300 을 넘긴다.
  // hybrid 는 배경컷을 포기해 text 로 강등하고, ai-visual 은 텍스트 대체안이 없어 제외한다.
  let aiUsed = 0;
  const finalIds: BlockType[] = [];
  const renderKindOf = new Map<BlockType, RenderKind>();
  for (const id of passed) {
    const def = getBlock(id);
    // 법적 블록은 팩에서 text 로 고정돼 있다 — 여기서 다시 확인해 승격을 원천 차단한다
    const kind: RenderKind = TEXT_ONLY_BLOCKS.includes(id) ? 'text' : def.renderKind;
    if (kind === 'text') {
      renderKindOf.set(id, 'text');
      finalIds.push(id);
      continue;
    }
    if (aiUsed < MAX_AI_BLOCKS) {
      aiUsed++;
      renderKindOf.set(id, kind);
      finalIds.push(id);
      continue;
    }
    if (kind === 'hybrid') {
      renderKindOf.set(id, 'text');
      finalIds.push(id);
    } else {
      pushExcluded(id, `이미지 생성 블록 상한(${MAX_AI_BLOCKS}개)을 넘어 넣지 않았습니다.`, null);
    }
  }

  // ── 각주 블록은 항상 마지막 ────────────────────────────────────────
  const footnoteIdx = finalIds.indexOf('footnote-block');
  if (footnoteIdx >= 0 && footnoteIdx !== finalIds.length - 1) {
    finalIds.splice(footnoteIdx, 1);
    finalIds.push('footnote-block');
  }

  const blocks: BlockPlan[] = finalIds.map((id, i) => {
    const def = getBlock(id);
    return {
      seq: i,
      blockId: id,
      code: def.code,
      nameKo: def.nameKo,
      renderKind: renderKindOf.get(id) ?? def.renderKind,
      layer: def.layer ?? null,
      signature: signature.has(id),
    };
  });

  return { templateId: tid, blocks, excluded, aiBlockCount: aiUsed };
}

/** 코드가 소유하는 각주 — 블록이 배출하면 각주 블록이 마지막에 한 번에 해소한다. */
export interface FootnoteRegistry {
  /** 마커(※1·＊ 등) → 각주 본문 */
  entries: { marker: string; text: string }[];
}

export function createFootnoteRegistry(): FootnoteRegistry {
  return { entries: [] };
}

/** 각주를 등록하고 마커를 돌려준다. 같은 본문은 마커를 재사용한다(중복 번호 방지). */
function addFootnote(reg: FootnoteRegistry, text: string): string {
  const found = reg.entries.find((e) => e.text === text);
  if (found) return found.marker;
  const marker = `※${reg.entries.length + 1}`;
  reg.entries.push({ marker, text });
  return marker;
}

/** 가격 문자열 조립 — promoSlots(썸네일)와 같은 규칙. 통화·쉼표는 입력 문자열 그대로 둔다. */
function priceStrings(promo: PromoInput): { sale: string; normal: string; discount: string } {
  return {
    sale: `¥${promo.salePrice}（税込）`,
    // 통상가 취소선은 실적 확인(normalPriceVerified)일 때만 — 有利誤認 방지
    normal: promo.normalPriceVerified && promo.normalPrice.trim() ? `¥${promo.normalPrice}（税込）` : '',
    discount: promo.discountRate.trim() ? `${promo.discountRate}%OFF` : '',
  };
}

/**
 * 블록 슬롯 확정 — LLM 산출과 사용자 입력을 합치되, **코드가 소유하는 슬롯이 최종 권한**을 갖는다.
 * 가격·실적·시험·전성분은 LLM 값이 와도 무조건 폐기하고 입력값만 자단위로 넣는다.
 *
 * @param plan       planBlocks 산출 항목
 * @param llmSlots   콜⑦ detailCopy 가 채운 슬롯(source: 'llm' 만 채택)
 * @param input      화면 입력(사실)
 * @param reg        각주 레지스트리(블록 순서대로 누적, 마지막에 각주 블록이 해소)
 */
export function assembleBlockSlots(
  plan: BlockPlan,
  llmSlots: Record<string, string>,
  input: DetailInput,
  reg: FootnoteRegistry,
): Record<string, string> {
  const def = getBlock(plan.blockId);
  const out: Record<string, string> = {};

  // 1) LLM 슬롯 — 팩에 source:'llm' 으로 선언된 키만 채택(미지 슬롯·월권 슬롯 제거)
  for (const [key, sd] of Object.entries(def.slots)) {
    if (sd.source === 'llm' && llmSlots[key]) out[key] = llmSlots[key];
    else if (sd.default) out[key] = sd.default;
  }

  // 2) 코드 소유 슬롯 — 여기서 덮어쓴다
  switch (plan.blockId) {
    case 'mall-promo-banner': {
      if (!input.promo) break;
      const p = input.promo;
      const { discount } = priceStrings(p);
      out.couponTitleJa = p.setTitle;
      out.discountRateJa = discount;
      out.periodJa = p.qualifierChips.join('　/　');
      out.conditionFootnoteJa = p.footnote;
      break;
    }
    case 'set-offer-table': {
      if (!input.promo) break;
      const p = input.promo;
      const { sale, normal, discount } = priceStrings(p);
      out.setTitleJa = p.setTitle;
      out.salePriceJa = sale;
      out.normalPriceJa = normal; // 미검증이면 빈 문자열 → 취소선 행 자체가 사라진다
      out.discountRateJa = discount;
      out.giftJa = p.gift;
      out.footnoteJa = p.footnote;
      break;
    }
    case 'hero-product':
      out.volumeJa = input.spec.volume;
      out.functionLabelJa = input.spec.category === '医薬部外品' ? '医薬部外品' : (out.functionLabelJa ?? '');
      break;
    case 'ranking-stack': {
      if (!input.proof) break;
      const p = input.proof;
      out.rankTitleJa = p.rankTitle;
      out.genreJa = p.genre;
      out.aggregationDateJa = p.aggregationDate;
      out.footnoteJa = `※${p.rankTitle}（${p.genre}・${p.aggregationDate}）`;
      break;
    }
    case 'cumulative-sales': {
      if (!input.sales) break;
      out.cumulativeCountJa = input.sales.count;
      out.aggregationPeriodJa = input.sales.period;
      out.reviewCountJa = input.sales.reviewCount ?? '';
      out.ratingJa = input.sales.rating ?? '';
      break;
    }
    case 'mechanism-explainer':
      // 침투 범위를 스스로 한정한다 — 「肌の奥深く」류 무한정 표현 차단
      out.scopeFootnoteJa = `${addFootnote(reg, '角質層まで')} 角質層まで`;
      break;
    case 'ingredient-card':
      out.ingredientRows = input.ingredients.map((i) => [i.name, i.percent, i.purpose].join('|')).join('\n');
      out.purposeFootnoteJa = `${addFootnote(reg, '配合目的：整肌・保湿成分として')} 配合目的：整肌・保湿成分として`;
      break;
    case 'quant-data-graph': {
      if (!input.test) break;
      const t = input.test;
      out.sourceFootnoteJa = `${addFootnote(reg, `${t.institution}／${t.date}／${t.sampleSize}／個人差があります`)} ${t.institution}／${t.date}／${t.sampleSize}／個人差があります`;
      break;
    }
    case 'test-evidence-label': {
      if (!input.test) break;
      const t = input.test;
      out.testNamesJa = t.name;
      out.testConditionJa = t.condition;
      out.institutionJa = t.institution;
      out.dateJa = t.date;
      out.sampleSizeJa = t.sampleSize;
      out.disclaimerJa = `${addFootnote(reg, 'すべての方に刺激が起こらないというわけではありません')} すべての方に刺激が起こらないというわけではありません`;
      break;
    }
    case 'spec-panel':
      out.specRows = input.specs.map((s) => `${s.label}|${s.value}`).join('\n');
      break;
    case 'free-from-badges':
      out.freeFromJa = input.freeOf.join('\n');
      break;
    case 'color-chip-grid':
      out.colorRows = input.options
        .filter((o) => o.axis === 'color')
        .map((o, i) => [`${String(i + 1).padStart(2, '0')}`, o.name, o.sku ?? '', o.swatchHex ?? ''].join('|'))
        .join('\n');
      break;
    case 'color-chart-matrix':
      out.axisLabelsJa = 'Light|Warm|Cool|Dark';
      out.placements = input.options
        .filter((o) => o.axis === 'color')
        .map((o, i) => [`${String(i + 1).padStart(2, '0')}`, o.name, o.swatchHex ?? ''].join('|'))
        .join('\n');
      break;
    case 'lineup-compare-chart':
      out.itemRows = input.options.filter((o) => o.axis !== 'color').map((o) => o.name).join('\n');
      out.benchmarkFootnoteJa = `${addFootnote(reg, '比較は当社内基準によるものです')} 比較は当社内基準によるものです`;
      break;
    case 'before-after-diagram':
      out.footnoteJa = `${addFootnote(reg, 'イラストはイメージです')} イラストはイメージです`;
      break;
    case 'swatch-demo':
      out.demoNoteJa = `${addFootnote(reg, '画像はイメージです')} 画像はイメージです`;
      break;
    case 'how-to-use':
      out.stepsJa = input.howToSteps.join('\n');
      break;
    case 'customer-review':
      // 실제 리뷰 원문만 — 생성하지 않는다
      out.reviewRows = input.reviews.map((r) => [r.text, r.rating, r.age].join('|')).join('\n');
      break;
    case 'product-spec-table':
      out.specRows = [
        `内容量|${input.spec.volume}`,
        `区分|${input.spec.category}`,
        `原産国|${input.spec.origin}`,
        `販売元|${input.spec.manufacturer}`,
      ].join('\n');
      out.fullIngredientsJa = input.spec.fullIngredients;
      break;
    case 'footnote-block':
      // 앞선 블록이 배출한 각주를 전부 해소한다(고아 각주 0)
      out.footnoteRows = reg.entries.map((e) => `${e.marker} ${e.text}`).join('\n');
      out.cautionsJa = input.cautions.join('\n');
      break;
    default:
      break;
  }

  return out;
}

/** 본문에 쓰인 각주 마커를 모은다(※1·※12 형태). */
function markersIn(text: string): string[] {
  return [...text.matchAll(/※\d+/g)].map((m) => m[0]);
}

/**
 * 각주 정합 검사 — 본문의 모든 ※n 이 각주 블록에서 해소되는지 확인한다.
 * 고아 각주는 조건 한정 표기가 사라진 것이라 景表法상 打消し表示 누락이 된다.
 */
export function checkFootnoteIntegrity(
  slotsBySeq: Record<string, string>[],
  reg: FootnoteRegistry,
): { ok: boolean; orphans: string[]; unused: string[] } {
  const used = new Set<string>();
  for (const slots of slotsBySeq) {
    for (const [key, value] of Object.entries(slots)) {
      if (key === 'footnoteRows') continue; // 각주 블록 본문은 해소하는 쪽이다
      for (const m of markersIn(value)) used.add(m);
    }
  }
  const registered = new Set(reg.entries.map((e) => e.marker));
  const orphans = [...used].filter((m) => !registered.has(m)).sort();
  const unused = [...registered].filter((m) => !used.has(m)).sort();
  return { ok: orphans.length === 0, orphans, unused };
}

/**
 * AI 배경컷 프롬프트 조립 — 썸네일 buildPrompt 의 블록판.
 * negative 1순위가 "글자를 그리지 말 것"이다: 문자는 전부 satori 가 벡터로 그리므로
 * 생성 이미지에 글자가 섞이면 이중 표기가 되어 오히려 오탈자를 만든다.
 */
export function buildBlockPrompt(
  blockId: BlockType,
  slots: Record<string, string>,
  category: ProductCategory,
  isFromKoreanDetail: boolean,
  userNote?: string,
): string {
  const pack = getDetailPack();
  const def = getBlock(blockId);
  if (!def.promptTemplate) throw new Error(`block has no AI prompt: ${blockId}`);

  const mood = pack.moodProfiles[category] ?? pack.moodProfiles.etc;
  const filled = def.promptTemplate.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (key === 'moodKeywords') return mood.keywords;
    if (key === 'surfaceColor') return mood.surface;
    if (key === 'accentColor') return mood.accent;
    return slots[key] ?? def.slots[key]?.default ?? '';
  });

  const cleanup = isFromKoreanDetail ? `${pack.inputCleanupNote.template}\n\n` : '';
  // 사용자 요청은 제약보다 **앞에** 둔다 — 뒤에 오는 제약이 우선순위를 갖게 하기 위해서다
  const note = userNote?.trim() ? `\n\nAdditional art direction: ${userNote.trim()}` : '';
  const constraints = [...pack.commonConstraints, ...pack.commonNegativeConstraints];
  // 원본 제품컷을 받지 않는 블록은 용기를 아예 그리지 못하게 막는다.
  // 막지 않으면 모델이 그럴듯한 화장품 용기를 지어내고, 그 용기가 히어로 블록의 실제 제품과 달라
  // 한 상세페이지 안에 서로 다른 제품이 섞인다.
  if (def.productPresence === 'none') constraints.push(PRODUCT_BAN_CLAUSE);

  return `${cleanup}${filled}${note}\n\nStrict requirements:\n- ${constraints.join('\n- ')}`;
}

/** 제품 용기 등장 금지 문구 — productPresence: 'none' 블록의 프롬프트 말미에 붙는다. */
const PRODUCT_BAN_CLAUSE =
  'Do not depict any cosmetic container, bottle, jar, tube, pump, dropper, compact, or product packaging anywhere in the image. The product is shown in other blocks using the real supplied photo; any invented container would show a different product on the same page.';

/**
 * 이 블록에 업로드된 원본 제품컷을 넘겨야 하는가.
 * 팩이 정본이다 — 호출부(잡 러너·CLI·블록 재생성)마다 블록 ID를 하드코딩하면
 * 세 곳이 조용히 어긋난다(실제로 어긋났다).
 * @param blockId 블록 식별자
 */
export function usesProductSource(blockId: BlockType): boolean {
  return getBlock(blockId).productPresence === 'source';
}
