/**
 * 콜⑩ specExtract — KR 상세 원본 이미지에서 폼의 스펙 7칸을 읽는다(§2-14).
 *
 * 웹 검색이 아니라 **사용자가 올린 원본**을 읽는 이유: 브랜드가 소유한 1차 자료라 정확하고,
 * 환각 위험이 낮고, 싸다(비전 1콜 · 검색 왕복 없음).
 *
 * 콜⑧ inputTranslate 와 성격이 같다 — **재설계 금지 · 값 그대로.** 다만 방향이 반대다:
 * 콜⑧은 사용자가 적은 값의 표기를 옮기고, 콜⑩은 사용자가 아직 적지 않은 값을 원본에서 찾는다.
 * 둘 다 모델이 창의를 발휘하면 표시 사실이 변조된다.
 *
 * **못 읽은 칸은 빈 값으로 남긴다.** 관통 원칙 1번이 프롬프트 진입을 막는 것과 같은 규칙이
 * 여기에도 선다 — 원본에 없는 성분명·용량·제조사를 지어내는 것이 이 서비스가 가장 하지
 * 말아야 할 일이다. 그래서 `validate` 에 "전부 채워라"를 넣지 않는다.
 */

import { runStructuredCall, type LlmCallLogEntry } from '../../engine/llm/client';

/** 추출 대상 폼 필드 — §2-14 의 7칸. `区分`(specCategory)은 대상이 아니다 */
export const EXTRACT_FIELDS = [
  'specVolume',
  'specManufacturer',
  'specOrigin',
  'specFullIngredients',
  'ingredientRows',
  'howToSteps',
  'cautions',
] as const;

export type ExtractField = (typeof EXTRACT_FIELDS)[number];

/**
 * 규정 민감 칸 — 자동으로 찼다는 사실만으로 블록을 세우지 않는다(§2-14 규정 가드).
 * 全成分은 표시 의무 항목이고 성분표는 효능 주장의 근거다. 둘 다 틀리면 되돌릴 수 없다.
 */
export const REVIEW_REQUIRED_FIELDS: ExtractField[] = ['specFullIngredients', 'ingredientRows'];

export interface SpecExtractResult {
  /** 읽어낸 칸만 담는다. 못 읽은 칸은 키 자체가 없다 */
  fields: Partial<Record<ExtractField, string>>;
  /** 못 읽은 칸의 사유 — 화면에 그대로 노출한다 */
  missing: { field: ExtractField; reason: string }[];
}

/** 화면·프롬프트가 함께 쓰는 칸 이름. 한 곳에만 둔다 */
const FIELD_LABELS: Record<ExtractField, string> = {
  specVolume: '内容量(용량)',
  specManufacturer: '販売元(판매원·제조사)',
  specOrigin: '原産国(원산지)',
  specFullIngredients: '全成分(전성분 표기 전체)',
  ingredientRows: '주요 성분표',
  howToSteps: '사용법 STEP',
  cautions: '주의사항',
};

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['fields'],
  properties: {
    fields: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'value'],
        properties: {
          field: { type: 'string', enum: [...EXTRACT_FIELDS] },
          /** 원본에서 못 찾았으면 빈 문자열. 지어내지 않는다 */
          value: { type: 'string' },
        },
      },
    },
  },
} as const;

interface RawResult {
  fields: { field: string; value: string }[];
}

export interface SpecExtractOptions {
  /** KR 상세 원본 이미지(제품컷 제외). `loadVisionImages` 산출을 그대로 받는다 */
  images: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }[];
  /** 이미 찬 칸은 콜에 싣지 않는다 — 덮지 않을 값을 읽어 올 이유가 없다 */
  wanted: ExtractField[];
  /**
   * 이 콜의 벽시계 상한(재시도 포함). **반드시 넘긴다.**
   * 생략하면 SDK 기본 10분이 라우트 상한보다 길어 콜 하나가 함수를 통째로 먹는다(§2-13).
   */
  timeoutMs: number;
  onLog?: (entry: LlmCallLogEntry) => Promise<void> | void;
}

/** 목 응답 — 실제 파이프라인을 돌리지 않고도 자동 채움 동선과 부분 성공 경로를 볼 수 있다. */
function mockResult(wanted: ExtractField[]): RawResult {
  const demo: Record<ExtractField, string> = {
    specVolume: '30mL',
    specManufacturer: '株式会社YOAKE',
    specOrigin: '韓国',
    // 전성분은 일부러 비워 둔다 — 부분 성공 경로가 목 모드에서도 재현된다
    specFullIngredients: '',
    ingredientRows: 'ナイアシンアミド|2%|整肌成分',
    howToSteps: '洗顔後、化粧水で肌をととのえます。',
    cautions: 'お肌に異常が生じないかよく注意してご使用ください。',
  };
  return { fields: wanted.map((f) => ({ field: f, value: demo[f] })) };
}

/**
 * KR 상세 원본에서 스펙 칸을 읽는다.
 *
 * 호출부가 "걸지 않을 경로"(원본 없음 · 이미 다 참 · 같은 이미지로 이미 돎)를 먼저 판정한다 —
 * 여기서는 `wanted` 가 비면 콜 없이 빈 결과를 돌려준다.
 */
export async function runSpecExtract(opts: SpecExtractOptions): Promise<SpecExtractResult> {
  if (opts.wanted.length === 0 || opts.images.length === 0) return { fields: {}, missing: [] };

  const payload = [
    '[작업] 첨부한 한국 상세페이지 원본 이미지에서 아래 칸의 값을 **그대로 찾아** 옮겨 적는다.',
    `[찾을 칸]\n${opts.wanted.map((f) => `- ${f} · ${FIELD_LABELS[f]}`).join('\n')}`,
    [
      '[출력 규칙]',
      '- 이미지에 적혀 있는 문자열을 그대로 옮긴다. 요약·의역·보정하지 마라.',
      '- **찾지 못한 칸은 value 를 빈 문자열로 둔다.** 추측해서 채우지 마라. 빈 값이 틀린 값보다 낫다.',
      '- 일반적으로 그럴 것 같다는 이유로 채우지 마라. 이 이미지에 있는 것만 적는다.',
      '- ingredientRows 는 한 줄에 하나씩 `성분명|농도|배합목적` 형식으로 적는다. 농도·목적이 없으면 비운다.',
      '- howToSteps · cautions 는 한 줄에 하나씩 적는다.',
      '- specFullIngredients 는 전성분 표기 전체를 한 줄로 적는다. 일부만 보이면 빈 값으로 둔다.',
      '- fields 에는 위에 나열한 칸만 담는다. 없는 칸을 만들지 마라.',
    ].join('\n'),
  ].join('\n\n');

  const raw = await runStructuredCall<RawResult>({
    callName: 'specExtract',
    timeoutMs: opts.timeoutMs,
    system:
      '너는 한국 화장품 상세페이지 이미지에서 표시 정보를 읽어 내는 도구다. ' +
      '읽은 것만 옮기고, 보이지 않는 값은 절대 지어내지 않는다. 빈 값을 돌려주는 것이 정상 동작이다.',
    userPayload: payload,
    images: opts.images,
    schema: EXTRACT_SCHEMA as unknown as object,
    // 전성분 한 줄이 길 수 있다. 콜⑧(6000)과 같은 자리에 둔다
    maxTokens: 6000,
    mockData: mockResult(opts.wanted),
    onLog: opts.onLog,
    // 누락을 교정으로 되돌리지 않는다 — "전부 채워라"를 넣으면 모델이 지어내도록 압박한다
    validate: (data) => {
      const unknownField = data.fields.find((f) => !(EXTRACT_FIELDS as readonly string[]).includes(f.field));
      return unknownField ? `없는 칸을 만들었다: ${unknownField.field} — 지정한 칸만 담아라.` : null;
    },
  });

  const fields: Partial<Record<ExtractField, string>> = {};
  const missing: SpecExtractResult['missing'] = [];
  const byField = new Map(raw.fields.map((f) => [f.field, f.value]));
  for (const f of opts.wanted) {
    const value = (byField.get(f) ?? '').trim();
    if (value) fields[f] = value;
    else missing.push({ field: f, reason: `원본에서 ${FIELD_LABELS[f]}을 찾지 못했습니다.` });
  }
  return { fields, missing };
}
