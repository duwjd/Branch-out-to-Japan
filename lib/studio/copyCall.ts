/**
 * 콜⑥ studioCopy — 파이프라인 ①입력분석+③카피재설계+④슬롯채움을 Claude 비전 1콜로 통합(08 §4.7).
 * 콜②(문장 감사)를 재사용하지 않는다 — 대신 같은 약기법 grounding을 시스템 프롬프트에 재주입하고,
 * 배지·가격은 코드 게이트(promptPack)가 최종 방어선이다.
 */

import { runStructuredCall, type LlmCallLogEntry } from '../engine/llm/client';
import { buildStableGrounding } from '../engine/grounding';
import type { ExplanationJson } from '../db/store';
import { getStyle, PRICE_LOCKED_SLOTS, type Platform, type StyleId, PLATFORM_LABELS } from './promptPack';
import { mockStudioCopy } from './fixtures';

export interface StudioCopyResult {
  /** 입력이 오버레이 있는 프로모 썸네일인가 — ⑤ 조립 시 cleanup 프리펜드 판단 */
  isPromoInput: boolean;
  /** 결과 화면 헤드라인의 제품명 — 이미지에서 읽히는 값만. 못 읽으면 빈 문자열(화면이 브랜드명으로 폴백) */
  productName: string;
  /** 원본(Before) 한 줄 진단 — 한국 원본이 무엇에 기대 설득하고 있었는지 */
  beforeSummary: string;
  styleReason: string;
  /** 스타일 textSlots 채움 값(배지·가격 슬롯 제외 — 코드 소유) */
  slotValues: { key: string; value: string }[];
  copySlots: ExplanationJson['copySlots'];
  krElementMap: ExplanationJson['krElementMap'];
}

const STUDIO_COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isPromoInput', 'productName', 'beforeSummary', 'styleReason', 'slotValues', 'copySlots', 'krElementMap'],
  properties: {
    isPromoInput: { type: 'boolean' },
    productName: { type: 'string' },
    beforeSummary: { type: 'string' },
    styleReason: { type: 'string' },
    slotValues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'value'],
        properties: { key: { type: 'string' }, value: { type: 'string' } },
      },
    },
    copySlots: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slotKey', 'ja', 'krSource', 'rationale', 'footnote'],
        properties: {
          slotKey: { type: 'string' },
          ja: { type: 'string' },
          krSource: { type: 'string' },
          rationale: { type: 'string' },
          footnote: { type: 'string' },
        },
      },
    },
    krElementMap: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['element', 'action', 'reason'],
        properties: {
          element: { type: 'string' },
          action: { type: 'string', enum: ['유지·정제', '재설계', '제거'] },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

export interface StudioCopyOptions {
  styleId: StyleId;
  platform: Platform;
  brandName: string;
  hasProof: boolean;
  image: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string };
  onLog?: (entry: LlmCallLogEntry) => Promise<void> | void;
}

/** 스타일 정의에서 LLM이 채울 슬롯 목록(배지·가격 제외)을 페이로드용으로 요약 */
function slotSpecLines(styleId: StyleId): { lines: string; requiredKeys: string[] } {
  const style = getStyle(styleId);
  const lockedKeys = new Set<string>(PRICE_LOCKED_SLOTS);
  const entries = Object.entries(style.textSlots).filter(([key]) => !lockedKeys.has(key));
  const lines = entries
    .map(([key, def]) => `- ${key} (${def.required ? '필수' : '선택'} · ${def.lang}): ${def.description} — 예: ${def.example}`)
    .join('\n');
  const requiredKeys = entries.filter(([, def]) => def.required).map(([key]) => key);
  return { lines, requiredKeys };
}

/**
 * 응답 검증 — 화면이 대체할 수 없는 것만 재시도로 되돌린다(재시도는 총 1회뿐).
 * productName 은 비어도 통과시킨다 — 안 읽히는 이름을 지어내는 것보다 브랜드명 폴백이 낫다.
 * @param data 콜⑥ 응답
 * @param requiredKeys 스타일 정의상 반드시 채워야 하는 슬롯 키
 * @returns 교정 지시 문자열(문제 있음) 또는 null(통과)
 */
export function validateStudioCopy(data: StudioCopyResult, requiredKeys: string[]): string | null {
  const got = new Set(data.slotValues.map((s) => s.key));
  const missing = requiredKeys.filter((k) => !got.has(k) || !data.slotValues.find((s) => s.key === k)?.value.trim());
  if (missing.length) return `필수 슬롯 누락/공란: [${missing.join(',')}] — 슬롯 정의대로 전부 채워라.`;

  if (!data.beforeSummary.trim()) {
    return 'beforeSummary가 비었다 — 한국 원본이 무엇에 기대 설득하고 있었는지 2~3문장으로 채워라.';
  }
  const brokenSlots = data.copySlots
    .filter((slot) => !slot.ja.trim() || !slot.krSource.trim() || !slot.rationale.trim())
    .map((slot) => slot.slotKey);
  if (brokenSlots.length) {
    return `카피 해설 누락/공란: [${brokenSlots.join(',')}] — ja·krSource·rationale 은 화면에 그대로 노출되므로 전부 채워라.`;
  }
  return null;
}

/** 콜⑥ 실행 — 목 모드는 결정적 픽스처(runStructuredCall이 판단) */
export async function runStudioCopy(opts: StudioCopyOptions): Promise<StudioCopyResult> {
  const style = getStyle(opts.styleId);
  const { lines, requiredKeys } = slotSpecLines(opts.styleId);

  const payload = [
    `[작업] 첨부된 한국 썸네일/제품컷 1장을 "${style.nameKo}(${style.nameJa})" 문법으로 재설계하기 위한 분석·카피·슬롯 채움.`,
    `[스타일 정의]\n설명: ${style.description}\n적합: ${style.bestFor}`,
    `[채울 텍스트 슬롯 — 아래 키만 slotValues로 산출(필수 슬롯은 반드시 채울 것). 실적 배지·가격 슬롯은 코드가 소유하므로 산출 금지]\n${lines}`,
    `[메타] 타깃 플랫폼: ${PLATFORM_LABELS[opts.platform]} · 브랜드명: ${opts.brandName} · 실적 근거 입력: ${opts.hasProof ? '있음(배지는 코드가 조립)' : '없음(배지 미생성이 기본값)'}`,
    `[요청]`,
    `1. isPromoInput — 입력이 오버레이(카피·뱃지·가격·테두리) 있는 프로모 썸네일인지 판정.`,
    `2. krElementMap — 이미지 속 KR 요소를 유지·정제/재설계/제거로 분류하고 근거를 한 줄씩.`,
    `3. slotValues — 위 슬롯 정의대로. lang=ja 슬롯은 번역이 아니라 의도 재설계(고민 어휘·관례어), lang=en 슬롯은 이미지 관찰에 근거한 영어 구도·비주얼 지시.`,
    `4. copySlots — lang=ja 카피 슬롯 각각에 대해 ja(재설계한 일본어 카피) / krSource(그 카피가 대체하는 이미지 속 한국어 문구를 글자 그대로. 대응하는 문구가 없으면 원본 의도를 한 줄로) / rationale(재설계 근거) / footnote(없으면 빈 문자열).`,
    `5. styleReason — 왜 이 문법이 이 제품·플랫폼에 맞는지 1~2문장(화면 해설용, 한국어).`,
    `6. productName — 이미지의 패키지·라벨에서 읽히는 제품명. 읽히지 않으면 빈 문자열(추정·창작 금지).`,
    `7. beforeSummary — 한국 원본이 무엇에 기대 설득하고 있었는지 2~3문장(한국어). 결과 화면의 원본 요약 문단에 그대로 들어간다.`,
  ].join('\n\n');

  return runStructuredCall<StudioCopyResult>({
    callName: 'studioCopy',
    system: buildStableGrounding('studioCopy', 'suncare', '화장품'),
    userPayload: payload,
    schema: STUDIO_COPY_SCHEMA as unknown as object,
    maxTokens: 4000,
    image: opts.image,
    mockData: mockStudioCopy(opts.styleId, opts.brandName),
    onLog: opts.onLog,
    validate: (data) => validateStudioCopy(data, requiredKeys),
  });
}
