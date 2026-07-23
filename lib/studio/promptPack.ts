/**
 * 썸네일 프롬프트 팩(v1.1.0) 로더 + 결정적 조립 — 스펙 §2-⑤ buildPrompt의 구현.
 * LLM 출력 이후의 법적 게이트를 코드가 강제한다(08 §4.7):
 *  - requiresProof 배지 문단: proof 3필드 전부 있을 때만 채움, 아니면 문단째 제거
 *  - 가격·특가 슬롯(G.priceBlock·giftInsetParagraph): 프로모 입력(HOME-05b)이 있으면 입력값만 코드가 조립,
 *    없으면 공란(지어내기 차단). LLM은 가격을 절대 산출하지 않는다.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PromoInput, ThumbnailProof } from '../db/store';

export type StyleId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

// 플랫폼 정의는 클라이언트 안전 잎 노드에 있다 — 서버 코드는 여기서 그대로 가져다 쓴다
export { PLATFORM_LABELS, PLATFORMS, type Platform } from './platform';
import type { Platform } from './platform';

interface TextSlotDef {
  required: boolean;
  lang: string;
  description: string;
  example: string;
}

interface BadgeSlotDef {
  requiresProof: boolean;
  proofFields: string[];
  template: string;
  legalNote: string;
}

export interface StyleCategory {
  id: StyleId;
  slug: string;
  nameKo: string;
  nameJa: string;
  description: string;
  platformFit: string[];
  bestFor: string;
  promptTemplate: string;
  textSlots: Record<string, TextSlotDef>;
  conditionalBadgeSlots: Record<string, BadgeSlotDef>;
  constraints: string[];
  negativeConstraints: string[];
}

interface PromptPack {
  version: string;
  targetModel: string;
  inputCleanupNote: { when: string; template: string };
  commonConstraints: string[];
  commonNegativeConstraints: string[];
  styleCategories: StyleCategory[];
  selectionGuide: { byPlatform: Record<string, StyleId[]>; tieBreakRules: string[] };
}

/** 가격·특가 계열 슬롯 — v1은 입력 UI가 없어 LLM이 지어낼 여지를 원천 차단한다 */
export const PRICE_LOCKED_SLOTS = ['priceBlock', 'giftInsetParagraph'] as const;

let cachedPack: PromptPack | null = null;

/** 프롬프트 팩 로드(프로세스 캐시) — 저장소 루트 기준 상대 경로(grounding 로더 관례) */
export function getPromptPack(): PromptPack {
  if (!cachedPack) {
    cachedPack = JSON.parse(
      readFileSync(path.join(process.cwd(), 'data/processed/thumbnail-style-prompts.json'), 'utf8'),
    ) as PromptPack;
  }
  return cachedPack;
}

/** 스타일 정의 조회 — 미지 ID는 즉시 실패(스펙 §2-⑤) */
export function getStyle(styleId: string): StyleCategory {
  const cat = getPromptPack().styleCategories.find((c) => c.id === styleId);
  if (!cat) throw new Error(`unknown style category: ${styleId}`);
  return cat;
}

/** {{key}} 플레이스홀더 치환 — 미제공 키는 빈 문자열(미증빙 배지 문단 제거와 동일 규칙) */
function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

/**
 * requiresProof 배지 문단 산출 — proof 3필드(실적명·부문·집계일) 전부 있을 때만 template을 채운다.
 * 수상 스택형(E·F의 awards)은 v1에서 proof 3필드를 메달 1개로 매핑한다(다건 수상 입력은 추후 기획).
 */
export function badgeParagraphs(style: StyleCategory, proof: ThumbnailProof | null): Record<string, string> {
  const out: Record<string, string> = {};
  const complete = Boolean(proof && proof.rankTitle.trim() && proof.genre.trim() && proof.aggregationDate.trim());

  for (const [key, def] of Object.entries(style.conditionalBadgeSlots)) {
    if (!def.requiresProof || !complete || !proof) {
      out[key] = ''; // 기본값 = 배지 없음(팩 usageNotes)
      continue;
    }
    out[key] = fillTemplate(def.template, {
      rankTitle: proof.rankTitle,
      genre: proof.genre,
      aggregationDate: proof.aggregationDate,
      awardCount: '1',
      awardsRendered: `medal 1: a classic Japanese ribbon medal reading '${proof.rankTitle}' with a ribbon strip reading '${proof.genre}'`,
      awardFootnoteJa: `※${proof.rankTitle}（${proof.genre}・${proof.aggregationDate}）`,
    });
  }
  return out;
}

/**
 * 프로모 입력(HOME-05b) → G 슬롯 결정적 조립 — 입력값만 자단위로, LLM 개입 없음.
 * priceBlock: 판매가부터 시작 → 통상가는 실적 확인(normalPriceVerified)일 때만 취소선 프리펜드(有利誤認 방지) → 할인율 접미.
 * 통화 기호·세금 표기·쉼표는 코드가 재가공하지 않는다(입력 문자열 그대로).
 */
export function promoSlots(promo: PromoInput): Record<string, string> {
  let priceBlock = `¥${promo.salePrice}`;
  if (promo.normalPriceVerified && promo.normalPrice.trim()) {
    priceBlock = `通常¥${promo.normalPrice}（取り消し線） → ${priceBlock}`;
  }
  if (promo.discountRate.trim()) {
    priceBlock = `${priceBlock} ${promo.discountRate}%OFF`;
  }
  return {
    setTitleJa: promo.setTitle,
    priceBlock,
    giftInsetParagraph: promo.gift.trim() ? `GIFT: ${promo.gift}` : '',
    qualifierChipsJa: promo.qualifierChips.join(' / '),
    footnoteJa: promo.footnote,
  };
}

/**
 * LLM 슬롯 산출을 스타일 정의에 맞춰 정리한다 — 미지 슬롯 제거, 배지 문단 병합.
 * 가격 계열 슬롯은 코드가 소유한다: 프로모 입력이 있으면 입력값으로 조립(promoSlots),
 * 없으면 공란(현 안전 기본값 — 지어내기 차단). LLM이 낸 가격 값은 어느 경우에도 채택하지 않는다.
 */
export function assembleSlots(
  style: StyleCategory,
  llmSlotValues: { key: string; value: string }[],
  proof: ThumbnailProof | null,
  promoInput: PromoInput | null = null,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const { key, value } of llmSlotValues) {
    if (key in style.textSlots) merged[key] = value;
  }
  Object.assign(merged, badgeParagraphs(style, proof));
  if (promoInput) {
    for (const [key, value] of Object.entries(promoSlots(promoInput))) {
      if (key in style.textSlots) merged[key] = value;
    }
  } else {
    for (const locked of PRICE_LOCKED_SLOTS) {
      if (locked in style.textSlots) merged[locked] = '';
    }
  }
  return merged;
}

/**
 * 최종 프롬프트 결정적 조립(스펙 §2-⑤ 코드 그대로) —
 * [프로모 입력이면 cleanup] → 템플릿(슬롯 치환) → Strict requirements(제약 4계층 연결).
 */
export function buildPrompt(styleId: string, slots: Record<string, string>, isPromoInput: boolean): string {
  const pack = getPromptPack();
  const cat = getStyle(styleId);
  // 가격 슬롯 공란/조립은 assembleSlots가 최종 권한 — 여기서 다시 덮어쓰지 않는다(프로모 입력값 보존)
  const body = fillTemplate(cat.promptTemplate, slots);
  const constraints = [
    ...cat.constraints,
    ...pack.commonConstraints,
    ...cat.negativeConstraints,
    ...pack.commonNegativeConstraints,
  ];
  const cleanup = isPromoInput ? pack.inputCleanupNote.template + '\n\n' : '';
  return `${cleanup}${body}\n\nStrict requirements:\n- ${constraints.join('\n- ')}`;
}

/** 플랫폼별 추천 스타일(팩 selectionGuide) — 'unset'은 추천·부적합 표기 없음 */
export function recommendedStyles(platform: Platform): StyleId[] {
  if (platform === 'unset') return [];
  return getPromptPack().selectionGuide.byPlatform[platform] ?? [];
}

/** 화면용 스타일 메타 — 내부 ID는 값으로만 쓰고 라벨은 평문(라벨 정책, ② HOME-01) */
export interface StyleUiMeta {
  id: StyleId;
  slug: string;
  nameKo: string;
  description: string;
  platformFit: string[];
  /** E — 실적 3필드 필수(HOME-04a) */
  needsProof: boolean;
  /** F — 브랜드 보유 모델컷 1장 + 사용 권한 동의 필수(HOME-02b·04a) */
  needsModel: boolean;
  /** G — 프로모 입력(세트명·판매가) 필수(HOME-05b·04a) */
  needsPromo: boolean;
}

export function styleUiMetas(): StyleUiMeta[] {
  return getPromptPack().styleCategories.map((c) => ({
    id: c.id,
    slug: c.slug,
    nameKo: c.nameKo,
    description: c.description,
    platformFit: c.platformFit,
    needsProof: c.id === 'E',
    needsModel: c.id === 'F',
    needsPromo: c.id === 'G',
  }));
}
