/**
 * 콜⑧ inputTranslate — 사용자가 한국어로 입력한 **사실 필드**를 일본 표기로 옮긴다.
 *
 * 콜⑦ detailCopy 와 성격이 정반대다:
 *  - 콜⑦은 "번역 금지 · 재설계" — 마케팅 카피를 일본 고객 관점으로 다시 쓴다.
 *  - 콜⑧은 "재설계 금지 · 표기 변환" — 가격·성분·시험 같은 **근거**를 값 그대로 옮긴다.
 *    여기서 모델이 창의를 발휘하면 표시 사실이 변조된다.
 *
 * 안전장치는 전부 **사후**에 있다(translate.ts `verifyTranslation`). `runStructuredCall` 의
 * `validate` 에 넣지 않는 이유는 client.ts 가 교정 1회 후 throw 라서, 필드 하나를 모델이
 * 두 번 고집하면 생성 전체가 죽기 때문이다. 실패한 필드는 원문을 남기고 사용자가 고친다.
 */

import { runStructuredCall, type LlmCallLogEntry } from '../../engine/llm/client';
import { buildStableGrounding } from '../../engine/grounding';
import type { BrandKit, DetailInput } from '../../db/store';
import type { Category } from '../../engine/types';
import { mockArtDirection, mockTranslate } from './fixtures';
import {
  NOTE_PATH,
  applyGlossary,
  collectForbidden,
  collectTranslatable,
  preTranslate,
  verifyTranslation,
  type TranslatableField,
  type TranslatedField,
} from './translate';

export interface InputTranslateResult {
  /** 변환된 필드 전부(결정적 확정분 + 모델 산출분). 실패분도 사유와 함께 들어 있다 */
  fields: TranslatedField[];
  /** 이미지 생성 프롬프트에 붙일 영어 아트 디렉션. 실패·미입력이면 빈 문자열 */
  artDirectionEn: string;
  /** 금지 표현 위반(게이트 기록용 — 변환을 되돌리지는 않는다) */
  forbidden: { path: string; term: string; reason: string }[];
}

interface RawResult {
  fields: { path: string; ja: string }[];
  artDirectionEn: string;
}

const TRANSLATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['fields', 'artDirectionEn'],
  properties: {
    fields: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'ja'],
        properties: { path: { type: 'string' }, ja: { type: 'string' } },
      },
    },
    artDirectionEn: { type: 'string' },
  },
} as const;

export interface InputTranslateOptions {
  input: DetailInput;
  /** 「추가 요청」 원문(한국어 가능) */
  note: string;
  brandKit?: BrandKit | null;
  /**
   * 「추가 요청」만 변환한다(블록 재생성 경로).
   * 그때 `input` 의 필드들은 이미 일본어로 확정돼 있고, 여기서 다시 바꿔도 자산에 반영되지
   * 않으므로 콜에 실을 이유가 없다.
   */
  /**
   * 이 콜의 벽시계 상한(재시도 포함). 생략하면 상한 없음 — SDK 기본(10분)이 함수 상한
   * 300초보다 길어 콜 하나가 함수를 통째로 먹을 수 있다. 값은 `budget.callTimeout()` 이 준다.
   */
  timeoutMs?: number;
  onlyNote?: boolean;
  onLog?: (entry: LlmCallLogEntry) => Promise<void> | void;
}

/** grounding 코퍼스는 4종만 집계돼 있다 — 없는 카테고리는 skincare 로 접는다(copyCall 관례). */
function groundingCategory(c: DetailInput['productCategory']): Category {
  switch (c) {
    case 'skincare':
    case 'makeup':
    case 'suncare':
    case 'cleansing':
      return c;
    default:
      return 'skincare';
  }
}

/** 목 응답 — 데모 사전으로 옮기고, 사전에 없는 표현은 한글이 남아 실패 경로가 재현된다. */
function mockResult(fields: TranslatableField[]): RawResult {
  return {
    fields: fields.filter((f) => f.path !== NOTE_PATH).map((f) => ({ path: f.path, ja: mockTranslate(f.kr) })),
    artDirectionEn: mockArtDirection(fields.find((f) => f.path === NOTE_PATH)?.kr ?? ''),
  };
}

/**
 * 입력 언어 변환 전체 — 결정적 선처리 → (필요할 때만) 콜⑧ → 사후 검사.
 *
 * **한글이 하나도 없으면 콜을 만들지 않는다.** 일본어로 입력한 사용자는 비용·지연이 0이고,
 * 기존 일본어 입력의 산출은 이 경로가 도입되기 전과 바이트 단위로 동일하다.
 */
export async function runInputTranslate(opts: InputTranslateOptions): Promise<InputTranslateResult> {
  const all = collectTranslatable(opts.input, opts.note);
  const collected = opts.onlyNote ? all.filter((f) => f.path === NOTE_PATH) : all;
  if (collected.length === 0) return { fields: [], artDirectionEn: '', forbidden: [] };

  const { resolved, remaining } = preTranslate(collected, opts.brandKit);
  if (remaining.length === 0) {
    return { fields: resolved, artDirectionEn: '', forbidden: collectForbidden(resolved, opts.brandKit) };
  }

  const glossary = (opts.brandKit?.productNamesJa ?? []).filter((p) => p.kr.trim() && p.ja.trim());
  const forbiddenTerms = (opts.brandKit?.forbiddenTerms ?? []).filter((t) => t.term.trim());

  const payload = [
    '[작업] 아래 필드의 한국어 원문을 일본 상세페이지 표기로 옮긴다. path 를 그대로 돌려주고 ja 만 채운다.',
    `[상품 카테고리] ${opts.input.productCategory}`,
    glossary.length
      ? `[브랜드 지정 표기 — 이 표기를 반드시 그대로 쓴다]\n${glossary.map((p) => `- ${p.kr} → ${p.ja}`).join('\n')}`
      : '',
    forbiddenTerms.length
      ? `[브랜드 금지 표현 — 결과에 넣지 않는다]\n${forbiddenTerms.map((t) => `- ${t.term} (${t.reason})`).join('\n')}`
      : '',
    opts.brandKit?.toneGuide?.trim() ? `[브랜드 톤 가이드]\n${opts.brandKit.toneGuide.trim()}` : '',
    `[필드 — path · 성격 · 원문]\n${remaining
      .map((f) => `- ${f.path} · ${f.kind} · ${f.label}\n  원문: ${f.kr}`)
      .join('\n')}`,
    remaining.some((f) => f.path === NOTE_PATH)
      ? '[artDirectionEn] path 가 note 인 항목은 fields 가 아니라 artDirectionEn 에 **영어로** 담는다. fields 에는 넣지 마라.'
      : '[artDirectionEn] 해당 없음 — 빈 문자열로 둔다.',
    '[출력 규칙]\n- fields 에는 위 path 를 전부 포함한다(note 제외). 없는 path 를 만들지 마라.\n- 숫자를 한 자리도 바꾸지 마라. 표기 형식만 일본식으로 바꾼다.\n- 한글을 결과에 남기지 마라.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const requiredPaths = remaining.filter((f) => f.path !== NOTE_PATH).map((f) => f.path);

  const raw = await runStructuredCall<RawResult>({
    callName: 'inputTranslate',
    timeoutMs: opts.timeoutMs,
    system: buildStableGrounding('inputTranslate', groundingCategory(opts.input.productCategory), '화장품'),
    userPayload: payload,
    schema: TRANSLATE_SCHEMA as unknown as object,
    // 필드 수십 개 + 전성분 한 줄이 길 수 있다. 콜⑦(12000)보다 작게 잡는다
    maxTokens: 6000,
    mockData: mockResult(remaining),
    onLog: opts.onLog,
    // 경로 누락만 본다 — 숫자·한글·금지표현은 전부 사후 검사다(위 파일 주석 참조)
    validate: (data) => {
      const got = new Set(data.fields.map((f) => f.path));
      const missing = requiredPaths.filter((p) => !got.has(p));
      return missing.length ? `누락된 path: [${missing.join(', ')}] — 전부 채워라.` : null;
    },
  });

  const byPath = new Map(raw.fields.map((f) => [f.path, f.ja]));
  // 브랜드 등록 표기를 산출에도 한 번 더 적용한다. 페이로드로 지시했어도 모델이 흘리면
  // 한글이 그대로 남아 그 필드가 통째로 탈락하는데, 사전 치환은 한글을 **줄이는 쪽으로만**
  // 작용하므로 덧붙여 손해가 없다(KR 키를 JA 값으로 바꾸는 것뿐이다).
  const glossaryPass = (ja: string) => (glossary.length > 0 ? applyGlossary(ja, glossary) : ja);
  const verified = remaining
    .filter((f) => f.path !== NOTE_PATH)
    .map((f) => verifyTranslation(f, glossaryPass(byPath.get(f.path) ?? '')));

  const noteField = remaining.find((f) => f.path === NOTE_PATH);
  let artDirectionEn = '';
  if (noteField) {
    const checked = verifyTranslation(noteField, raw.artDirectionEn ?? '');
    // 실패하면 아트 디렉션을 통째로 버린다 — 한국어를 영어 프롬프트에 섞는 것보다 없는 편이 낫다
    if (checked.ok) artDirectionEn = checked.ja;
    verified.push(checked);
  }

  const fields = [...resolved, ...verified];
  return { fields, artDirectionEn, forbidden: collectForbidden(fields, opts.brandKit) };
}
