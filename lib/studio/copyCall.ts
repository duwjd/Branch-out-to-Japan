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
  styleReason: string;
  /** 스타일 textSlots 채움 값(배지·가격 슬롯 제외 — 코드 소유) */
  slotValues: { key: string; value: string }[];
  copySlots: ExplanationJson['copySlots'];
  krElementMap: ExplanationJson['krElementMap'];
}

const STUDIO_COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isPromoInput', 'styleReason', 'slotValues', 'copySlots', 'krElementMap'],
  properties: {
    isPromoInput: { type: 'boolean' },
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
        required: ['slotKey', 'ja', 'krIntent', 'rationale', 'footnote'],
        properties: {
          slotKey: { type: 'string' },
          ja: { type: 'string' },
          krIntent: { type: 'string' },
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
    `4. copySlots — lang=ja 카피 슬롯 각각에 대해 JP 카피/KR 원문·의도/재설계 근거/각주(없으면 빈 문자열).`,
    `5. styleReason — 왜 이 문법이 이 제품·플랫폼에 맞는지 1~2문장(화면 해설용, 한국어).`,
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
    validate: (data) => {
      const got = new Set(data.slotValues.map((s) => s.key));
      const missing = requiredKeys.filter((k) => !got.has(k) || !data.slotValues.find((s) => s.key === k)?.value.trim());
      if (missing.length) return `필수 슬롯 누락/공란: [${missing.join(',')}] — 슬롯 정의대로 전부 채워라.`;
      return null;
    },
  });
}
