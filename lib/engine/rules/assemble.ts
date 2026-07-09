/**
 * 파이프라인 5단계 — 9블록 조립(규칙).
 * 각 블록의 내용 정본: docs/specs/01-report-spec.md §4. 렌더 계약: BlocksJson(types.ts).
 * 고정가 퍼널·면책 문구 등 상수는 스펙 문구를 그대로 옮긴다(임의 창작 금지).
 */

import type {
  AggregateResult,
  AuditResult,
  BenchmarkData,
  BlocksJson,
  NormalizedContent,
  PersonaResult,
  RewriteResult,
  ScoredItem,
  TierInput,
} from '../types';
import { CATEGORY_LABELS } from '../types';
import { GROUP_WEIGHTS } from '../rubric';
import { toBlock5Items } from './aggregate';
import { getRegulatory } from '../grounding';
import { LLM_MODEL, currentLlmMode } from '../llm/client';

const ENGINE_VERSION = '0.1.0';

/** 블록9 고정가 퍼널(스펙 블록9-4 — 견적 왕복 제거) */
const FUNNEL = [
  { step: '① 진단 리포트', price: '30만 원 (1회 고정가)', note: '이 리포트 — 방향 확인' },
  { step: '② 마케팅 스튜디오', price: '월 20만 원', note: '첫 달 진단비 공제 · 콘텐츠 제작' },
  { step: '③ 운영', price: '② 구독 내 확장', note: '시즌 대응 · 일본 기업 매칭' },
];

const AUDIT_DISCLAIMER =
  '본 감사는 공개 규정·업계 가이드라인에 근거한 문장 재설계 관점의 1차 스크리닝이며 법적 확정 판정이 아닙니다. 최종 적법성은 배합 성분·승인 구분·문맥 전체에 따라 달라지므로 상시(上市) 전 약무 전문가·행정 확인을 권고합니다.';

export interface AssembleInput {
  tierInput: TierInput;
  content: NormalizedContent;
  scored: ScoredItem[];
  aggregate: AggregateResult;
  audit: AuditResult;
  persona: PersonaResult;
  benchmark: BenchmarkData;
  rewrite: RewriteResult;
}

/** 전 단계 산출물을 Report.blocksJson으로 조립한다 */
export function assembleBlocks(input: AssembleInput): BlocksJson {
  const { tierInput, content, scored, aggregate, audit, persona, benchmark, rewrite } = input;
  const regulatory = getRegulatory();
  const issuedAt = new Date().toISOString().slice(0, 10);
  const productClassAssumed = tierInput.productClass === '미상';
  const productClassLabel = productClassAssumed ? '화장품(가정 — 분류 미확인)' : tierInput.productClass;

  const textById = new Map(content.sentences.map((s) => [s.id, s.text]));

  return {
    meta: {
      engineVersion: ENGINE_VERSION,
      llmMode: currentLlmMode(),
      model: LLM_MODEL,
      generatedAt: issuedAt,
      precisionLimited: content.precisionLimited,
      category: tierInput.category,
      productClass: tierInput.productClass,
      productClassAssumed,
    },
    block0: {
      brandName: tierInput.brandName?.trim() || '(브랜드명 미기재)',
      productName: tierInput.productName?.trim() || '(제품명 미기재 — 콘텐츠에서 추론)',
      categoryLabel: CATEGORY_LABELS[tierInput.category],
      productClassLabel,
      priceLabel: '진단 리포트 · 고정가 30만 원',
      scope: `4카테고리 진단 엔진 중 ${CATEGORY_LABELS[tierInput.category]} · 티어 입력 기반(문장 ${content.sentences.length}건 전수 감사)`,
      limitSummary: '약기법 감사 = 1차 스크리닝(법률 자문 아님) · 코퍼스 = 라쿠텐 단일 채널 표본 · 리뷰 서사 = 카테고리 일반형',
      issuedAt,
    },
    block1: {
      overallScore: aggregate.overallScore,
      groupScores: aggregate.groupScores,
      top3: aggregate.top3,
      summaryText: rewrite.headline.summary,
      trustBadges: ['채점 기준 공개', `라쿠텐 상세 ${benchmark.sampleCount || '—'}건 코퍼스 기준`, '약기법 1차 스크리닝(실명 검수)'],
    },
    block2: persona,
    block3: {
      gradeNote: regulatory.gradeFrame.note,
      gradeRows: regulatory.gradeFrame.grades,
      sentences: audit.sentences.map((s) => ({ ...s, originalText: textById.get(s.sentenceId) ?? '' })),
      summary: audit.summary,
      disclaimer: AUDIT_DISCLAIMER,
    },
    block4: { ...benchmark, narrative: rewrite.benchmarkNarrative },
    block5: {
      items: toBlock5Items(tierInput.category, scored),
      groupScores: aggregate.groupScores,
      weights: GROUP_WEIGHTS[tierInput.category],
    },
    block6: {
      narrative: persona.reviewNarrative,
      generalNote:
        '카테고리 코퍼스 리뷰 패턴 "일반형" 산출입니다(개별 리뷰 미크롤링 — 가짜 리뷰 생성 금지 원칙). 리뷰 URL을 입력하면 v2에서 이 제품 실측 리뷰로 정밀화됩니다.',
    },
    block7: { rewrites: rewrite.rewrites },
    block8: rewrite.sample,
    block9: {
      actions: [
        `오늘 당장: 약기법 【불가】 ${audit.summary.ngCount}건 문장 교체 (블록 3·7)`,
        `이번 주: 저점 Top3(${aggregate.top3.map((t) => t.itemId).join('·')}) 정보 구조 재설계 (블록 5·7)`,
        '다음 단계: 근거 라벨·각주·제3자 지표를 상세 전체에 시스템으로 심기 (블록 4·8)',
      ],
      sources: regulatory.clauses.map((c) => ({ id: c.id, title: c.title, source: c.source, url: c.url })),
      limits: [
        '약기법 감사 = 1차 스크리닝 — 상시(上市) 전 약무 전문가·행정 확인 권고',
        '코퍼스 = 라쿠텐 단일 채널 표본(채널 편중·OCR 노이즈 존재)',
        '리뷰 서사 = 카테고리 일반형(실측 리뷰 분석은 v2)',
        ...(content.precisionLimited ? ['입력 콘텐츠 200자 미만 — 일부 블록이 카테고리 일반형으로 산출됨(정밀도 제한)'] : []),
      ],
      funnel: FUNNEL,
    },
  };
}
