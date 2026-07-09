/**
 * 파이프라인 2단계 — 사전 신호 추출(규칙 · 정규식).
 * 콜①의 판정을 돕는 힌트일 뿐, 점수를 직접 만들지 않는다(판정은 LLM, 집계는 코드 — 결정성 계약).
 */

import type { NormalizedContent, PreSignals } from '../types';

/** 정규화 평문에서 신뢰 장치 관련 신호를 정규식으로 추출한다 */
export function extractPreSignals(content: NormalizedContent): PreSignals {
  const t = content.plainText;

  const hasNumericClaim = /\d+\s*(시간|일|주|개월|%|배|倍)/.test(t);
  const hasSpfPa = /SPF\s*\d+|PA\+{1,4}/i.test(t);
  const hasFootnoteMark = /[※＊*]\d?/.test(t);
  const hasFreeLabel = /(무첨가|무향료|무색소|프리|フリー|無添加|無香料|無着色)/.test(t);
  const hasThirdPartyProof = /(랭킹|1위|수상|어워드|리뷰\s*\d|ランキング|受賞|レビュー)/.test(t);
  const hasIngredientPercent = /\d+(\.\d+)?\s*%/.test(t);

  const notes: string[] = [];
  if (hasNumericClaim) notes.push('수치·기간 주장 표현 관찰(근거 라벨 필요 여부 점검 대상)');
  if (hasSpfPa) notes.push('SPF/PA 표기 관찰');
  if (hasFootnoteMark) notes.push('각주(※/＊) 기호 관찰');
  if (hasFreeLabel) notes.push('무첨가/프리 계열 표현 관찰');
  if (hasThirdPartyProof) notes.push('제3자 지표(랭킹·리뷰·수상) 계열 표현 관찰');
  if (hasIngredientPercent) notes.push('성분 % 수치 관찰');
  if (notes.length === 0) notes.push('신뢰 장치 신호 미관찰(근거 라벨·각주·제3자 지표 전무 가능성)');

  return {
    hasNumericClaim,
    hasSpfPa,
    hasFootnoteMark,
    hasFreeLabel,
    hasThirdPartyProof,
    hasIngredientPercent,
    notes,
  };
}
