/**
 * LLM 콜 출력 JSON 스키마 — 08 §4.1~4.5 계약의 구현.
 * 전 스키마 additionalProperties:false + required 전 필드(구조화 출력 안정성).
 *
 * **description 의 (한국어)/(일본어) 표기는 장식이 아니라 계약이다.** 모델은 구조화 출력의
 * 필드 description 을 실제로 읽는다. 언어 표기가 없던 콜③이 전 필드를 일본어로 내는 표류를
 * 일으켰으므로(grounding 의 LANGUAGE_CONTRACT 주석 참조), 전 필드에 출력 언어를 명시한다.
 * 이 표기는 `lib/engine/llm/calls.ts` 의 `LANGUAGE_POLICY` 와 1:1로 맞춰야 한다 —
 * 한쪽만 고치면 프롬프트와 사후 검사가 서로 다른 계약을 말하게 된다.
 */

import type { RubricItemId } from './types';

// 루브릭 id 목록 — 18개를 한 줄로 두어야 rubric.ts 표와 대조된다
// prettier-ignore
const RUBRIC_ITEM_IDS: RubricItemId[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'E4',
];

/** 콜① — 루브릭 채점 */
export const CALL1_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['itemId', 'score', 'evidenceQuote', 'criterionRef', 'corpusRef'],
        properties: {
          itemId: { type: 'string', enum: RUBRIC_ITEM_IDS },
          score: { type: 'integer', enum: [0, 1, 2] },
          evidenceQuote: { type: 'string', description: '고객 원문에서 판정 근거 문장을 그대로 인용(원문 언어 유지). 없으면 빈 문자열' },
          criterionRef: { type: 'string', description: '(한국어) 적용한 통과기준 요약' },
          corpusRef: { type: 'string', description: '(일본어 인용 가능) 대비한 코퍼스 관례 근거 — 사전집계 안의 표현만 그대로 인용' },
        },
      },
    },
  },
} as const;

/** 콜② — 약기법 전수 감사 */
export const CALL2_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sentences', 'summary'],
  properties: {
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sentenceId', 'verdict', 'reason', 'clauseRefs', 'altTextJa'],
        properties: {
          sentenceId: { type: 'string' },
          verdict: { type: 'string', enum: ['불가', '조건부', '가능'] },
          reason: { type: 'string', description: '(한국어) 왜 이 판정인지 — 재설계 관점 설명. 일본어 표현을 짚을 때만 「」로 인용' },
          clauseRefs: { type: 'array', items: { type: 'string' }, description: '규정 요약의 조항 id만 사용' },
          altTextJa: { type: 'string', description: '(일본어) 소구 유지 합법 대체표현. 한글을 남기지 말 것. 가능 판정이면 빈 문자열' },
        },
      },
    },
    summary: {
      type: 'object',
      additionalProperties: false,
      required: ['ngCount', 'conditionalCount', 'okCount', 'highestRiskId'],
      properties: {
        ngCount: { type: 'integer' },
        conditionalCount: { type: 'integer' },
        okCount: { type: 'integer' },
        highestRiskId: { type: 'string' },
      },
    },
  },
} as const;

/** 콜③ — 페르소나·USP·리뷰 서사 */
export const CALL3_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['persona', 'journey', 'objections', 'uspTable', 'reviewNarrative'],
  properties: {
    persona: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'ageRange', 'skinConcerns', 'buyingMotive', 'checkBehaviors', 'priceSensitivity', 'trustTriggers'],
      properties: {
        name: { type: 'string', description: '(일본어) 일본인 페르소나의 이름. 예: ユイ' },
        ageRange: { type: 'string', description: '(한국어) 예: 20대 후반~30대 초반' },
        skinConcerns: { type: 'array', items: { type: 'string' }, description: '(일본어 어휘) 일본 고객이 실제로 쓰는 고민어. 예: 乾燥 · 肌あれ · 毛穴' },
        buyingMotive: { type: 'string', description: '(한국어) 무엇이 보일 때 사는가 — 한국 담당자가 읽는 서술' },
        checkBehaviors: { type: 'array', items: { type: 'string' }, description: '(한국어 서술 + 일본 관례어) 예: @cosme·LIPS 리뷰 확인' },
        priceSensitivity: { type: 'string', description: '(한국어) 가격 미제공이면 빈 문자열(추론 금지)' },
        trustTriggers: { type: 'array', items: { type: 'string' }, description: '(일본어 어휘) 신뢰를 만드는 일본 관례 표기. 예: 効能評価試験済み' },
      },
    },
    journey: {
      type: 'object',
      additionalProperties: false,
      required: ['stages', 'finalConfidencePoint'],
      properties: {
        stages: { type: 'array', items: { type: 'string' }, description: '(한국어) 인지→탐색→구매 3단계 서술. 일본 관례어는 그대로 섞어도 되지만 문장은 한국어' },
        finalConfidencePoint: { type: 'string', description: '(한국어) 무엇에서 최종 확신을 얻는가' },
      },
    },
    objections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'why'],
        properties: {
          question: { type: 'string', description: '(일본어) 일본 고객이 머릿속에 떠올리는 의문의 원문. 예: 「化粧品でそんな効果出るの?」' },
          why: { type: 'string', description: '(한국어) 왜 그런 의문이 생기는지 — 한국 담당자가 읽는 설명' },
        },
      },
    },
    uspTable: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['krAppeal', 'jpReading', 'redefinedUsp'],
        properties: {
          krAppeal: { type: 'string', description: '(한국어) 지금 한국식 소구가 무엇인가' },
          jpReading: { type: 'string', description: '(한국어) 그 소구가 일본 고객에게 어떻게 읽히는지(리스크)를 **한국어로 설명**. 일본어를 적는 칸이 아니다' },
          redefinedUsp: { type: 'string', description: '(한국어) 재정의된 구매이유를 **한국어로 설명**. 일본어 카피안은 블록7 afterJa 의 몫이다' },
        },
      },
    },
    reviewNarrative: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['infoGap', 'distrustSignal', 'dropOff'],
        properties: {
          infoGap: { type: 'string', description: '(한국어) 진단된 정보 공백' },
          distrustSignal: { type: 'string', description: '(한국어) 고객이 떠올리는 의문. 일본어 의문은 「」로 인용하고 문장은 한국어' },
          dropOff: { type: 'string', description: '(한국어) 어느 단계에서 이탈하는가' },
        },
      },
    },
  },
} as const;

/** 콜④ — 총평 + NG/OK 재작성 + 샘플 + 벤치마크 문장화 */
export const CALL4_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'rewrites', 'sample', 'benchmarkNarrative'],
  properties: {
    headline: {
      type: 'object',
      additionalProperties: false,
      required: ['summary'],
      properties: { summary: { type: 'string', description: '(한국어) 진단 총평 3~4줄' } },
    },
    rewrites: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceRef', 'beforeKr', 'problem', 'afterJa', 'afterKr', 'reason', 'whatAdded', 'uspRowIndex'],
        properties: {
          sourceRef: { type: 'string', description: '루브릭 itemId 또는 문장 K번호' },
          beforeKr: { type: 'string', description: '고객 원문을 그대로 인용(원문 언어 유지)' },
          problem: { type: 'string', description: '(한국어) 어느 루브릭·약기법 이슈인지 + 왜' },
          afterJa: { type: 'string', description: '(일본어) 일본향 재설계안. 한글을 남기지 말 것' },
          afterKr: { type: 'string', description: '(한국어) After의 역문 — 직역이 아니라 "이 일본어가 일본 고객에게 전하는 의미". 일본어 문장을 쓰지 말 것' },
          reason: { type: 'string', description: '(한국어) 무엇을 왜 바꿨는가' },
          whatAdded: { type: 'array', items: { type: 'string' }, description: '(한국어) 무엇을 더했는가 — 근거 라벨·각주·성분 정량 등' },
          uspRowIndex: { type: 'integer', description: 'USP 표에서 실행하는 행 인덱스(0부터). 없으면 -1' },
        },
      },
    },
    sample: {
      type: 'object',
      additionalProperties: false,
      required: ['targetSection', 'afterJaBlock', 'afterKrBlock', 'isDemo'],
      properties: {
        targetSection: { type: 'string', description: '(한국어) 어느 섹션을 통째로 재구성했는가' },
        afterJaBlock: { type: 'string', description: '(일본어) 블록 통째 재구성안. 한글을 남기지 말 것' },
        afterKrBlock: { type: 'string', description: '(한국어) 위 블록의 역해설 — 일본어 문장을 쓰지 말 것' },
        isDemo: { type: 'boolean', description: '고객 콘텐츠 빈약으로 데모 대체 시 true — "예시(데모)" 라벨 강제' },
      },
    },
    benchmarkNarrative: { type: 'string', description: '(한국어) 벤치마크 대비표의 요지 문장화 2~3문장' },
  },
} as const;

/** 무료 체커 */
export const CHECKER_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['violations', 'okCount'],
  properties: {
    violations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quote', 'verdict', 'clauseRef', 'shortHint'],
        properties: {
          quote: { type: 'string' },
          verdict: { type: 'string', enum: ['불가', '조건부'] },
          clauseRef: { type: 'string' },
          shortHint: { type: 'string', description: '(한국어) 한 줄 힌트만 — 대체표현 제공 금지(유료 경계)' },
        },
      },
    },
    okCount: { type: 'integer' },
  },
} as const;

/** 콜⑤ — 보고용 슬라이드 카피 (스펙 §10.5 · 08 §4.5) */
const SLIDE_COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['heading', 'lead', 'bullets'],
  properties: {
    heading: { type: 'string', description: '(한국어) 슬라이드 표제. 짧게(20자 내외)' },
    lead: { type: 'string', description: '(한국어) 한 줄 요지. 결재자가 이 줄만 읽어도 뜻이 통해야 함' },
    bullets: { type: 'array', items: { type: 'string' }, description: '(한국어) 결재 포인트 2~3개' },
  },
} as const;

/**
 * 콜⑤ — 모드별 고정 골격의 카피만(스펙 §10.4 v4). 숫자를 쓰지 말 것(렌더러가 blocksJson에서 인용).
 * 키·순서는 lib/engine/types.ts의 SLIDE_KEYS_FULL / SLIDE_KEYS_BRAND가 정본.
 */
export const CALL5_OUTPUT_SCHEMA_FULL = {
  type: 'object',
  additionalProperties: false,
  required: ['cover', 'conclusion', 'score', 'risk', 'benchmark', 'beforeAfter', 'nextStep'],
  properties: {
    cover: SLIDE_COPY_SCHEMA,
    conclusion: SLIDE_COPY_SCHEMA,
    score: SLIDE_COPY_SCHEMA,
    risk: SLIDE_COPY_SCHEMA,
    benchmark: SLIDE_COPY_SCHEMA,
    beforeAfter: SLIDE_COPY_SCHEMA,
    nextStep: SLIDE_COPY_SCHEMA,
  },
} as const;

/** 콜⑤ 브랜드 진단 덱(4장) — 결론·점수·리스크·비포애프터 장은 존재하지 않는다 */
export const CALL5_OUTPUT_SCHEMA_BRAND = {
  type: 'object',
  additionalProperties: false,
  required: ['cover', 'positioning', 'benchmark', 'nextStep'],
  properties: {
    cover: SLIDE_COPY_SCHEMA,
    positioning: SLIDE_COPY_SCHEMA,
    benchmark: SLIDE_COPY_SCHEMA,
    nextStep: SLIDE_COPY_SCHEMA,
  },
} as const;
