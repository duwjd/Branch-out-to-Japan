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
  BrandOnlyInput,
  BrandProductInput,
  NormalizedContent,
  PersonaResult,
  RewriteResult,
  ScoredItem,
} from '../types';
import { CATEGORY_LABELS } from '../types';
import { GROUP_WEIGHTS } from '../rubric';
import { toBlock5Items } from './aggregate';
import { getRegulatory } from '../grounding';
import { LLM_MODEL, currentLlmMode } from '../llm/client';

const ENGINE_VERSION = '0.1.0';

/** 블록9 고정가 퍼널(스펙 블록9-4 — 견적 왕복 제거) — 브랜드+제품 진단용 */
const FUNNEL = [
  { step: '① 진단 리포트', price: '30만 원 (1회 고정가)', note: '이 리포트 — 방향 확인' },
  { step: '② 마케팅 스튜디오', price: '월 20만 원', note: '첫 달 진단비 공제 · 콘텐츠 제작' },
  { step: '③ 운영', price: '② 구독 내 확장', note: '시즌 대응 · 일본 기업 매칭' },
];

/** 브랜드 진단용 퍼널 — 다음 단계 = 콘텐츠 제출로 풀 진단 열기. 브랜드 진단 가격은 미정(DECISIONS 🔴) */
const FUNNEL_BRAND = [
  { step: '① 브랜드 진단', price: '(가격 미정)', note: '이 리포트 — 페르소나·USP 재설계' },
  { step: '② 브랜드+제품 진단', price: '30만 원 (1회 고정가)', note: '상세페이지 카피 제출 시 — 약기법 전수 감사·문법 점수·재작성' },
  { step: '③ 마케팅 스튜디오', price: '월 20만 원', note: '첫 달 진단비 공제 · 콘텐츠 제작' },
];

const AUDIT_DISCLAIMER =
  '본 감사는 공개 규정·업계 가이드라인에 근거한 문장 재설계 관점의 1차 스크리닝이며 법적 확정 판정이 아닙니다. 최종 적법성은 배합 성분·승인 구분·문맥 전체에 따라 달라지므로 상시(上市) 전 약무 전문가·행정 확인을 권고합니다.';

export interface AssembleInput {
  /** 풀 파이프라인 전용 — 브랜드 진단 조립은 assembleBrandBlocks(P4)가 맡는다 */
  tierInput: BrandProductInput;
  content: NormalizedContent;
  scored: ScoredItem[];
  aggregate: AggregateResult;
  audit: AuditResult;
  persona: PersonaResult;
  benchmark: BenchmarkData;
  rewrite: RewriteResult;
}

/** 브랜드 진단 조립 입력 — 콜③ + 벤치마크(코퍼스 측)만 존재한다(스펙 §3.3) */
export interface AssembleBrandInput {
  tierInput: BrandOnlyInput;
  persona: PersonaResult;
  benchmark: BenchmarkData;
}

/**
 * 브랜드 진단 blocksJson 조립 — 블록 3·5·7·8은 null(데이터 잠금).
 * 없는 산출을 빈 값·0건으로 위장하지 않는다(증거 원칙). block1은 scored:false.
 */
export function assembleBrandBlocks(input: AssembleBrandInput): BlocksJson {
  const { tierInput, persona, benchmark } = input;
  const issuedAt = new Date().toISOString().slice(0, 10);
  const categoryLabel = CATEGORY_LABELS[tierInput.category];

  return {
    meta: {
      engineVersion: ENGINE_VERSION,
      llmMode: currentLlmMode(),
      model: LLM_MODEL,
      generatedAt: issuedAt,
      precisionLimited: false, // 200자 소프트선은 콘텐츠 개념 — 브랜드 진단에는 해당 없음
      mode: 'brand',
      category: tierInput.category,
      productClass: '미상', // 브랜드 진단은 분류를 묻지 않는다 — 표기는 productClassLabel이 담당
      productClassAssumed: false,
    },
    block0: {
      brandName: tierInput.brandName.trim(),
      productName: tierInput.productName?.trim() || '(제품 정보 미입력)',
      categoryLabel,
      productClassLabel: '—(제품 정보 미입력)',
      priceLabel: '브랜드 진단 (가격 미정)',
      scope: `4카테고리 진단 엔진 중 ${categoryLabel} · 브랜드 진단 — 제품 콘텐츠 미제출(블록 1·3·5·7·8 데이터 잠금)`,
      limitSummary: '약기법 감사·문법 점수 미산출(제품 콘텐츠 미제출) · 코퍼스 = 라쿠텐 단일 채널 표본 · 리뷰 서사 = 카테고리 일반형',
      issuedAt,
    },
    block1: {
      scored: false,
      lockedReason: '고객 문장이 없어 종합점수를 산출하지 않았습니다(브랜드 진단).',
      unlockHint: '상세페이지 카피를 넣으면 薬機法 전수 감사·A~E 문법 점수·NG/OK 재작성이 열립니다.',
      // 판단이 아니라 사실 안내만 — 창작 총평(콜④)은 이 모드에서 돌지 않는다
      summaryText: `${tierInput.brandName.trim()}의 포지셔닝을 일본 고객 관점으로 진단했습니다. 페르소나·USP 재정의(블록 2), 카테고리 벤치마크(블록 4), 리뷰 인과 서사(블록 6)를 확인하세요.`,
      trustBadges: [`라쿠텐 상세 ${benchmark.sampleCount || '—'}건 코퍼스 기준`, '포지셔닝 기반 진단'],
    },
    block2: persona,
    block3: null,
    block4: { ...benchmark, narrative: '' }, // 문장화(콜④)는 풀 모드 전용 — 빈 서술은 뷰가 생략한다
    block5: null,
    block6: {
      narrative: persona.reviewNarrative,
      generalNote:
        '카테고리 코퍼스 리뷰 패턴 "일반형" 산출입니다(개별 리뷰 미크롤링 — 가짜 리뷰 생성 금지 원칙). 리뷰 URL을 입력하면 v2에서 이 제품 실측 리뷰로 정밀화됩니다.',
    },
    block7: null,
    block8: null,
    block9: {
      actions: [
        '지금: 블록 2의 USP 재정의를 상세페이지·SNS 카피 방향에 반영',
        '다음: 상세페이지 카피를 제출해 약기법 전수 감사·문법 점수 받기 (블록 3·5·7·8 열림)',
      ],
      sources: [], // 규정 각주는 약기법 감사(블록 3)의 근거 — 감사가 없으므로 출처도 없다
      limits: [
        '약기법 감사 미실시 — 제품 콘텐츠 미제출. 카피 확정 전 감사(브랜드+제품 진단)를 권고',
        '코퍼스 = 라쿠텐 단일 채널 표본(채널 편중·OCR 노이즈 존재)',
        '리뷰 서사 = 카테고리 일반형(실측 리뷰 분석은 v2)',
      ],
      funnel: FUNNEL_BRAND,
    },
  };
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
      mode: 'brandProduct',
      category: tierInput.category,
      productClass: tierInput.productClass,
      productClassAssumed,
    },
    block0: {
      brandName: tierInput.brandName.trim(), // v4: 필수 입력 — 미기재 폴백 없음
      productName: tierInput.productName?.trim() || '(제품명 미기재 — 콘텐츠에서 추론)',
      categoryLabel: CATEGORY_LABELS[tierInput.category],
      productClassLabel,
      priceLabel: '진단 리포트 · 고정가 30만 원',
      scope: `4카테고리 진단 엔진 중 ${CATEGORY_LABELS[tierInput.category]} · 티어 입력 기반(문장 ${content.sentences.length}건 전수 감사)`,
      limitSummary: '약기법 감사 = 1차 스크리닝(법률 자문 아님) · 코퍼스 = 라쿠텐 단일 채널 표본 · 리뷰 서사 = 카테고리 일반형',
      issuedAt,
    },
    block1: {
      scored: true,
      overallScore: aggregate.overallScore,
      groupScores: aggregate.groupScores,
      top3: aggregate.top3,
      summaryText: rewrite.headline.summary,
      trustBadges: ['채점 기준 공개', `라쿠텐 상세 ${benchmark.sampleCount || '—'}건 코퍼스 기준`, '약기법 1차 스크리닝'],
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
