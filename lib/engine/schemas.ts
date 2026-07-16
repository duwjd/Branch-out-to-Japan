/**
 * LLM 콜 출력 JSON 스키마 — 08 §4.1~4.5 계약의 구현.
 * 전 스키마 additionalProperties:false + required 전 필드(구조화 출력 안정성).
 */

import type { RubricItemId } from './types';

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
          evidenceQuote: { type: 'string', description: '고객 원문에서 판정 근거 문장 인용. 없으면 빈 문자열' },
          criterionRef: { type: 'string', description: '적용한 통과기준 요약' },
          corpusRef: { type: 'string', description: '대비한 코퍼스 관례 근거 — 사전집계 안의 표현만 인용' },
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
          reason: { type: 'string', description: '왜 — 재설계 관점 설명' },
          clauseRefs: { type: 'array', items: { type: 'string' }, description: '규정 요약의 조항 id만 사용' },
          altTextJa: { type: 'string', description: '소구 유지 합법 대체표현(JP). 가능 판정이면 빈 문자열' },
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
        name: { type: 'string' },
        ageRange: { type: 'string' },
        skinConcerns: { type: 'array', items: { type: 'string' } },
        buyingMotive: { type: 'string' },
        checkBehaviors: { type: 'array', items: { type: 'string' } },
        priceSensitivity: { type: 'string' },
        trustTriggers: { type: 'array', items: { type: 'string' } },
      },
    },
    journey: {
      type: 'object',
      additionalProperties: false,
      required: ['stages', 'finalConfidencePoint'],
      properties: {
        stages: { type: 'array', items: { type: 'string' } },
        finalConfidencePoint: { type: 'string' },
      },
    },
    objections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'why'],
        properties: { question: { type: 'string' }, why: { type: 'string' } },
      },
    },
    uspTable: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['krAppeal', 'jpReading', 'redefinedUsp'],
        properties: {
          krAppeal: { type: 'string' },
          jpReading: { type: 'string', description: '일본 고객에게 읽히는 방식(리스크)' },
          redefinedUsp: { type: 'string', description: '재정의된 일본향 구매이유' },
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
          infoGap: { type: 'string' },
          distrustSignal: { type: 'string' },
          dropOff: { type: 'string' },
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
      properties: { summary: { type: 'string', description: '진단 총평 3~4줄' } },
    },
    rewrites: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceRef', 'beforeKr', 'problem', 'afterJa', 'afterKr', 'reason', 'whatAdded', 'uspRowIndex'],
        properties: {
          sourceRef: { type: 'string', description: '루브릭 itemId 또는 문장 K번호' },
          beforeKr: { type: 'string' },
          problem: { type: 'string', description: '어느 루브릭·약기법 이슈인지 + 왜' },
          afterJa: { type: 'string' },
          afterKr: { type: 'string', description: 'After의 한국어 역문 — 일본 고객에게 전하는 의미' },
          reason: { type: 'string' },
          whatAdded: { type: 'array', items: { type: 'string' } },
          uspRowIndex: { type: 'integer', description: 'USP 표에서 실행하는 행 인덱스(0부터). 없으면 -1' },
        },
      },
    },
    sample: {
      type: 'object',
      additionalProperties: false,
      required: ['targetSection', 'afterJaBlock', 'afterKrBlock', 'isDemo'],
      properties: {
        targetSection: { type: 'string' },
        afterJaBlock: { type: 'string' },
        afterKrBlock: { type: 'string' },
        isDemo: { type: 'boolean', description: '고객 콘텐츠 빈약으로 데모 대체 시 true — "예시(데모)" 라벨 강제' },
      },
    },
    benchmarkNarrative: { type: 'string', description: '벤치마크 대비표의 요지 문장화 2~3문장' },
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
          shortHint: { type: 'string', description: '한 줄 힌트만 — 대체표현 제공 금지(유료 경계)' },
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
    heading: { type: 'string', description: '슬라이드 표제. 짧게(20자 내외)' },
    lead: { type: 'string', description: '한 줄 요지. 결재자가 이 줄만 읽어도 뜻이 통해야 함' },
    bullets: { type: 'array', items: { type: 'string' }, description: '결재 포인트 2~3개' },
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
