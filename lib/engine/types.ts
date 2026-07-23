/**
 * ① 진단 리포트 엔진 공용 타입.
 * 정본: docs/specs/01-report-spec.md §3(브랜드 우선 2단 입력 · v4)·§10(슬라이드) · docs/08-data-flow.md §4(콜 계약)·§6(엔티티).
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

/** 브랜드 포지셔닝 — 택소노미 태그 + 자유 서술 (스펙 §3.1 v4). 콜③(페르소나·USP 재정의)의 핵심 입력 */
export interface Positioning {
  /** rules/positioning.ts POSITIONING_TAGS의 value — 1~5개 */
  tags: string[];
  /** 자유 서술 0~500자 — "이 브랜드가 무엇을 지향하는가" */
  note: string;
}

/**
 * 진단 입력 스냅샷 — DiagnosisRequest.tierInput 로 저장되는 원본 (08 §6).
 * 이름의 "tier"는 v2 티어 스키마의 역사적 잔재 — v4에서 브랜드(필수)/제품(선택) 2단 구조로 재편됐다(스펙 §3).
 */
interface TierInputBase {
  // 브랜드 섹션 (필수 3종 + 선택 1)
  brandName: string;
  positioning: Positioning;
  category: Category;
  targetMemo?: string;
  // 제품 섹션 — 콘텐츠 없이 제출돼도 입력된 사실은 스냅샷에 담는다(§3.3)
  productName?: string;
  keyIngredients?: string[];
  priceJpy?: number;
  /** 데드필드 — v4에서 폼 제거(소비처 0). v2 리뷰 실측용 키만 예약(§3.4) */
  reviewSourceUrl?: string;
}

/** 브랜드 진단 — 상세페이지 콘텐츠 없음. 블록 1·3·5·7·8은 데이터 잠금(스펙 §3.3) */
export interface BrandOnlyInput extends TierInputBase {
  mode: 'brand';
}

/** 브랜드+제품 진단 — 상세페이지 콘텐츠 제출. 9블록 전부 산출 */
export interface BrandProductInput extends TierInputBase {
  mode: 'brandProduct';
  /** v7: 이미지 업로드(기본) 또는 텍스트 붙여넣기. URL은 제거됨(데드필드) */
  sourceType: 'image' | 'text';
  /** 이미지 모드 — 상세페이지 캡처 fileId 배열(위→아래 순서, 1~10장). 콜⓪ 비전 추출 입력 */
  sourceImages?: string[];
  sourceText?: string;
  /** 데드필드 — v7에서 URL 입력 제거(소비처 0). 스키마 키만 예약 */
  sourceUrl?: string;
  /** 약기법 감사 판정 프레임 키 — 미입력은 라우트가 '미상'으로 정규화(§3.2) */
  productClass: ProductClass;
}

/**
 * mode는 제출 경계(라우트)에서 한 번 판정해 물질화한다 — 발행된 리포트의 입력 스냅샷은
 * 자기 서술적이어야 한다(왜 점수가 없는지 입력만 보고 알 수 있게 · §3.3).
 */
export type TierInput = BrandOnlyInput | BrandProductInput;

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

/** 리포트 상태 머신 (08 §3.3) — 파이프라인 성공 = 발행. 검수 단계 없음(2026-07-16 재결정) */
export type ReportStatus = 'submitted' | 'processing' | 'published' | 'failed';

/** 진단 모드 (스펙 §3.3) — 렌더러·슬라이드가 참조하는 단일 판별자 */
export type ReportMode = 'brand' | 'brandProduct';

/**
 * 9블록 조립 결과 — Report.blocksJson (렌더 계약).
 * 브랜드 진단(mode='brand')에서는 고객 문장이 없어 블록 3·5·7·8이 null(데이터 잠금),
 * block1은 scored:false다. null은 "산출 안 함"이지 "0건"이 아니다 — 빈 값으로 채우면 증거 원칙 위반.
 */
export interface BlocksJson {
  meta: {
    engineVersion: string;
    llmMode: 'real' | 'mock';
    model: string;
    generatedAt: string;
    precisionLimited: boolean;
    mode: ReportMode;
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
  /**
   * 요약 헤더 — 판별 유니온(scored). 옵셔널 필드가 아닌 이유: `overallScore?: number`는
   * 옵셔널 체이닝으로 조용히 흡수돼 0이 렌더될 수 있다. 유니온은 컴파일러가 모든 읽기
   * 지점에 분기를 강제한다. meta.mode와 중복 판별자지만 TS는 형제 프로퍼티로 좁히지
   * 못하므로 자체 태그가 필요하다(writer는 assemble 한 곳뿐).
   */
  block1:
    | {
        scored: true;
        overallScore: number;
        groupScores: Record<RubricGroup, number>;
        top3: { itemId: RubricItemId; title: string; score: number }[];
        summaryText: string;
        trustBadges: string[];
      }
    | {
        scored: false;
        /** 왜 점수가 없는가 — "고객 문장이 없어 산출 불가" */
        lockedReason: string;
        /** 무엇을 넣으면 열리는가 — "상세페이지 카피 입력" */
        unlockHint: string;
        summaryText: string;
        trustBadges: string[];
      };
  block2: PersonaResult;
  /** null = 브랜드 진단(감사 대상 문장 없음 — 데이터 잠금) */
  block3: {
    gradeNote: string;
    gradeRows: { grade: string; canSay: string; cannotSay: string }[];
    sentences: (AuditSentenceResult & { originalText: string })[];
    summary: AuditResult['summary'];
    disclaimer: string;
  } | null;
  block4: BenchmarkData & { narrative: string };
  /** null = 브랜드 진단(채점할 "내 문장" 없음 — 데이터 잠금) */
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
  } | null;
  block6: { narrative: PersonaResult['reviewNarrative']; generalNote: string };
  /** null = 브랜드 진단(재작성할 원문 없음). rewrites:[]는 풀 모드의 콜④ 실패 폴백 — 의미가 다르다 */
  block7: { rewrites: RewriteResult['rewrites'] } | null;
  /** null = 브랜드 진단 */
  block8: RewriteResult['sample'] | null;
  block9: {
    actions: string[];
    sources: { id: string; title: string; source: string; url: string }[];
    limits: string[];
    funnel: { step: string; price: string; note: string }[];
  };
}

/**
 * 보고용 슬라이드 덱 (스펙 §10.4 v4) — 골격은 코드가 소유하는 모드별 고정 키다.
 * 브랜드 진단 덱에는 결론·점수·리스크·비포애프터 장이 **존재하지 않는다** — 잠긴 장을
 * "측정 못 했습니다"로 채우지 않고, 없는 수치를 렌더할 경로 자체를 없앤다.
 */
export const SLIDE_KEYS_FULL = [
  'cover',
  'conclusion',
  'score',
  'risk',
  'benchmark',
  'beforeAfter',
  'nextStep',
] as const;

export const SLIDE_KEYS_BRAND = ['cover', 'positioning', 'benchmark', 'nextStep'] as const;

export type SlideKey = (typeof SLIDE_KEYS_FULL)[number] | (typeof SLIDE_KEYS_BRAND)[number];

/** 모드 → 덱 골격 (스펙 §10.4) */
export function slideKeysFor(mode: ReportMode): readonly SlideKey[] {
  return mode === 'brand' ? SLIDE_KEYS_BRAND : SLIDE_KEYS_FULL;
}

/** 슬라이드 1장의 카피 — 콜⑤가 채우는 유일한 것. 숫자는 여기 들어오지 않는다(렌더러가 blocksJson에서 인용) */
export interface SlideCopy {
  /** 슬라이드 표제 */
  heading: string;
  /** 한 줄 요지 — 결재자가 이 줄만 읽어도 뜻이 통해야 한다 */
  lead: string;
  /** 결재 포인트 2~3개 */
  bullets: string[];
}

/**
 * 콜⑤ 출력 — 카피 전용. 슬라이드 목록·순서·수치는 코드가 소유한다(스펙 §10.3).
 * Partial인 이유: 모드마다 키 집합이 다르다 — 완전성은 콜⑤ validate와 렌더러가 모드 키로 강제한다.
 */
export type DeckSpec = Partial<Record<SlideKey, SlideCopy>>;
