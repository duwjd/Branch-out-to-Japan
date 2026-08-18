/**
 * 해설(ExplanationJson) 읽기 정규화 — 화면과 저장 포맷 사이의 완충재.
 *
 * 2026-08-18 결과 화면 개편으로 계약이 바뀌었다(`productName`·`beforeSummary` 추가,
 * `krIntent` → `krSource`). 이미 저장된 explanation_json 행은 옛 모양 그대로 남아 있고
 * 되돌려 쓸 수도 없으므로(생성 시점 산출물), **읽을 때** 새 모양으로 맞춘다.
 * 마이그레이션이 필요 없는 이유가 여기 있다 — 저장은 새 모양으로만 하고, 옛 행은 이 함수가 덮는다.
 */

import type { ExplanationJson } from '../db/store';

/** 옛 저장 모양 — krIntent 를 쓰고 productName·beforeSummary 가 없다 */
interface LegacyCopySlot {
  slotKey?: unknown;
  ja?: unknown;
  krIntent?: unknown;
  krSource?: unknown;
  rationale?: unknown;
  footnote?: unknown;
}

/** 문자열이 아니면 빈 문자열 — 옛 행에 없는 키를 그대로 렌더하지 않기 위한 방어 */
function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * 저장된 해설 → 현재 계약. null 이면 null 그대로(아직 해설이 없는 생성중 상태).
 * @param raw 저장소에서 읽은 explanation_json (옛 모양일 수 있다)
 */
export function normalizeExplanation(raw: unknown): ExplanationJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const slots = Array.isArray(src.copySlots) ? (src.copySlots as LegacyCopySlot[]) : [];
  const map = Array.isArray(src.krElementMap) ? (src.krElementMap as Record<string, unknown>[]) : [];
  return {
    styleReason: str(src.styleReason),
    productName: str(src.productName),
    beforeSummary: str(src.beforeSummary),
    copySlots: slots.map((slot) => ({
      slotKey: str(slot.slotKey),
      ja: str(slot.ja),
      // 옛 행은 krIntent 에 "원문·의도"가 섞여 있다 — 새 필드가 없을 때만 그대로 승계한다
      krSource: str(slot.krSource) || str(slot.krIntent),
      rationale: str(slot.rationale),
      footnote: str(slot.footnote),
    })),
    krElementMap: map.map((row) => ({
      element: str(row.element),
      action: (['유지·정제', '재설계', '제거'] as const).includes(row.action as never)
        ? (row.action as ExplanationJson['krElementMap'][number]['action'])
        : '재설계',
      reason: str(row.reason),
    })),
  };
}
