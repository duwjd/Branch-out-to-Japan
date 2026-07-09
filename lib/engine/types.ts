/**
 * ① 진단 리포트 엔진 공용 타입.
 * 정본: docs/specs/01-report-spec.md §3(티어 입력) · docs/08-data-flow.md §4(콜 계약)·§6(엔티티).
 */

export type Category = 'skincare' | 'makeup' | 'suncare' | 'cleansing';

/** 제품 분류 — 미상 시 화장품 가정 + 경고(스펙 §3.1) */
export type ProductClass = '화장품' | '의약외품' | '미상';

export const CATEGORY_LABELS: Record<Category, string> = {
  skincare: '스킨케어',
  makeup: '메이크업',
  suncare: '선케어',
  cleansing: '클렌징',
};

/** 티어 입력 스냅샷 — DiagnosisRequest.tierInput 로 저장되는 원본 (08 §6) */
export interface TierInput {
  category: Category;
  productClass: ProductClass;
  sourceType: 'url' | 'text';
  sourceUrl?: string;
  sourceText?: string;
  // Tier 1 (선택)
  brandName?: string;
  productName?: string;
  keyIngredients?: string[];
  priceJpy?: number;
  targetMemo?: string;
  // Tier 2 (선택 — MVP는 수집만, 실측 분석 v2)
  reviewSourceUrl?: string;
}

/** 문장 단위 분해 결과 — ID는 규칙 코드가 부여(K1..Kn), LLM에 분해를 맡기지 않는다 */
export interface Sentence {
  id: string;
  text: string;
}

/** 정규화 산출물 (파이프라인 1단계) */
export interface NormalizedContent {
  plainText: string;
  sentences: Sentence[];
  charCount: number;
  /** 50~199자 — 생성은 되나 "정밀도 제한" 배지 (스펙 §3.1) */
  precisionLimited: boolean;
}

/** 사전 신호 (파이프라인 2단계 — 정규식 기반) */
export interface PreSignals {
  hasNumericClaim: boolean;
  hasSpfPa: boolean;
  hasFootnoteMark: boolean;
  hasFreeLabel: boolean;
  hasThirdPartyProof: boolean;
  hasIngredientPercent: boolean;
  notes: string[];
}

export type RubricGroup = 'A' | 'B' | 'C' | 'D' | 'E';

export type RubricItemId =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5'
  | 'B1' | 'B2'
  | 'C1' | 'C2' | 'C3'
  | 'D1' | 'D2' | 'D3' | 'D4'
  | 'E1' | 'E2' | 'E3' | 'E4';

/** 콜① 산출 — 항목별 판정(점수 합산은 코드가 한다) */
export interface ScoredItem {
  itemId: RubricItemId;
  score: 0 | 1 | 2;
  evidenceQuote: string;
  criterionRef: string;
  corpusRef: string;
}

/** 3단계 집계 산출 — 결정적(단위 테스트 대상) */
export interface AggregateResult {
  groupScores: Record<RubricGroup, number>;
  overallScore: number;
  top3: { itemId: RubricItemId; title: string; score: number }[];
}

export type AuditVerdict = '불가' | '조건부' | '가능';

/** 콜② 산출 — 문장별 약기법 판정 */
export interface AuditSentenceResult {
  sentenceId: string;
  verdict: AuditVerdict;
  reason: string;
  clauseRefs: string[];
  altTextJa: string;
}

export interface AuditResult {
  sentences: AuditSentenceResult[];
  summary: { ngCount: number; conditionalCount: number; okCount: number; highestRiskId: string };
}

/** 콜③ 산출 — 페르소나·USP·리뷰 서사 */
export interface PersonaResult {
  persona: {
    name: string;
    ageRange: string;
    skinConcerns: string[];
    buyingMotive: string;
    checkBehaviors: string[];
    priceSensitivity: string;
    trustTriggers: string[];
  };
  journey: { stages: string[]; finalConfidencePoint: string };
  objections: { question: string; why: string }[];
  uspTable: { krAppeal: string; jpReading: string; redefinedUsp: string }[];
  reviewNarrative: { infoGap: string; distrustSignal: string; dropOff: string }[];
}

/** 콜④ 산출 — 총평 + NG/OK 재작성 + 샘플 + 벤치마크 문장화 */
export interface RewriteResult {
  headline: { summary: string };
  rewrites: {
    sourceRef: string;
    beforeKr: string;
    problem: string;
    afterJa: string;
    afterKr: string;
    reason: string;
    whatAdded: string[];
    uspRowIndex: number;
  }[];
  sample: { targetSection: string; afterJaBlock: string; afterKrBlock: string; isDemo: boolean };
  benchmarkNarrative: string;
}

/** 4단계 벤치마크(규칙) 산출 */
export interface BenchmarkData {
  sampleCount: number;
  corpusQuotes: { device: string; quote: string }[];
  comparisonRows: { device: string; corpusExample: string; customerStatus: string; gapNote: string }[];
  searchTermRows: { term: string; reading: string; frequency: number }[];
}

/** 리포트 상태 머신 (08 §3.3) */
export type ReportStatus =
  | 'submitted'
  | 'processing'
  | 'needsReview'
  | 'published'
  | 'failed'
  | 'rejected';

/** 9블록 조립 결과 — Report.blocksJson (렌더 계약) */
export interface BlocksJson {
  meta: {
    engineVersion: string;
    llmMode: 'real' | 'mock';
    model: string;
    generatedAt: string;
    precisionLimited: boolean;
    category: Category;
    productClass: ProductClass;
    productClassAssumed: boolean;
  };
  block0: {
    brandName: string;
    productName: string;
    categoryLabel: string;
    productClassLabel: string;
    priceLabel: string;
    scope: string;
    limitSummary: string;
    issuedAt: string;
  };
  block1: {
    overallScore: number;
    groupScores: Record<RubricGroup, number>;
    top3: { itemId: RubricItemId; title: string; score: number }[];
    summaryText: string;
    trustBadges: string[];
  };
  block2: PersonaResult;
  block3: {
    gradeNote: string;
    gradeRows: { grade: string; canSay: string; cannotSay: string }[];
    sentences: (AuditSentenceResult & { originalText: string })[];
    summary: AuditResult['summary'];
    disclaimer: string;
  };
  block4: BenchmarkData & { narrative: string };
  block5: {
    items: {
      itemId: RubricItemId;
      group: RubricGroup;
      title: string;
      criterion: string;
      score: number;
      evidenceQuote: string;
      corpusRef: string;
    }[];
    groupScores: Record<RubricGroup, number>;
    weights: Record<RubricGroup, number>;
  };
  block6: { narrative: PersonaResult['reviewNarrative']; generalNote: string };
  block7: { rewrites: RewriteResult['rewrites'] };
  block8: RewriteResult['sample'];
  block9: {
    actions: string[];
    sources: { id: string; title: string; source: string; url: string }[];
    limits: string[];
    funnel: { step: string; price: string; note: string }[];
  };
}
