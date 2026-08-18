/**
 * 저장 계층 인터페이스 — 엔티티 계약은 08 §6 (이번 범위 간소화: AuditSentence는 blocksJson 내 포함).
 * 구현 선택: SUPABASE_URL 있으면 Supabase(supabaseStore), 없으면 .data/ 파일 스토어(dev 폴백).
 */

import type { BlocksJson, BrandProductClass, Category, ReportStatus, RubricGroup, RubricItemId, TierInput } from '../engine/types';
import type { LlmCallLogEntry } from '../engine/llm/client';
import type { LeadKind, TrackEventType } from '../lead';

/**
 * 레거시 단일 브랜드 id — 멀티 브랜드 이전에 만들어진 레코드(brandProfileId 없음)와
 * 마이그레이션된 첫 브랜드 프로필이 공유한다. 신규 브랜드는 uuid를 받는다.
 * 스코핑 필터는 `record.brandProfileId ?? LEGACY_BRAND_ID` 로 구 데이터를 이 브랜드에 귀속시킨다.
 */
export const LEGACY_BRAND_ID = 'default';

/** 레거시 유저 id — 목 소셜 세션의 데모 유저이자, userId 없는 구 데이터의 귀속 대상.
 *  DEMO_USER.id 와 동일 문자열이라 세션 도입 후 교체해도 동작이 바뀌지 않는다. */
export const LEGACY_USER_ID = 'demo-user';

/** 유저(실 인증 — 08 §6 USER). id는 레거시 'demo-user' 또는 uuid. */
export interface UserRecord {
  id: string;                    // 'demo-user'(레거시) 또는 uuid
  email: string;                 // 소문자 정규화된 값으로 저장
  passwordHash: string | null;   // null = 소셜(목) 계정
  name: string;                  // 표시명(AppShell·마이페이지)
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 이메일 검증·비밀번호 재설정 토큰 — 원문은 저장하지 않고 sha256 해시만 보관한다. */
export interface AuthTokenRecord {
  tokenHash: string;             // sha256(원문 토큰) hex — PK, 원문은 저장 안 함
  userId: string;
  kind: 'verify' | 'reset';
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface DiagnosisRequestRecord {
  id: string;
  /** 소속 브랜드(스냅샷 원칙 — 제출 시점 활성 브랜드에 귀속) */
  brandProfileId: string;
  tierInput: TierInput;
  precisionLimited: boolean;
  status: ReportStatus;
  /** processing 중 화면 표시용 현재 단계 */
  stage: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRecord {
  requestId: string;
  /** 소속 브랜드 — 요청에서 물질화(브랜드별 스코핑용 비정규화) */
  brandProfileId: string;
  blocksJson: BlocksJson;
  /** null = 브랜드 진단(점수 없음 — reports.overall_score nullable, 스펙 §3.3) */
  overallScore: number | null;
  /** 브랜드 진단은 {} — "채점 안 함"이지 0점이 아니다 */
  groupScores: Partial<Record<RubricGroup, number>>;
  top3: { itemId: RubricItemId; title: string; score: number }[];
  /** 파이프라인 완료 시각 — 잡이 직접 세팅한다(발행 = 파이프라인 성공) */
  publishedAt: string | null;
  createdAt: string;
}

// ── 스프린트 2 엔티티 (08 §6.1 스프린트 2 델타) ──────────────────────────────
// userId는 어디에도 두지 않는다 — 목 세션(데모 유저 1명), Auth 도입 시 일괄 마이그레이션.

/** 브랜드 관리 화면의 제품분류 — 정본은 engine/types(클라이언트 안전). 기존 import 경로 유지용 재수출 */
export type { BrandProductClass } from '../engine/types';

export interface BrandKit {
  productNamesJa: { kr: string; ja: string }[];
  forbiddenTerms: { term: string; reason: string }[];
  toneGuide: string;
}

/** 브랜드 프로필 — 복수 지원(id=uuid, 레거시 마이그레이션분만 'default'). 편집 정본은 /app/brand */
export interface BrandProfileRecord {
  id: string;
  /** 소속 유저 — 목 세션 데모 유저 또는 가입 유저 */
  userId: string;
  brandName: string;
  category: Category;
  productClass: BrandProductClass;
  positioningTags: string[];
  targetMemo: string;
  productInfoMemo: string;
  /** 상세페이지 문서 fileId + 원본 파일명(화면 표시용) */
  detailDocPath: string | null;
  detailDocName: string | null;
  channels: { krUrl: string; jp: { channel: string; url: string }[] };
  brandKit: BrandKit;
  createdAt: string;
  updatedAt: string;
}

export type GeneratedAssetStatus = 'generating' | 'done' | 'failed';

/** 검수 게이트 v1 — 구조적 보증 기록(비전 자동검수 없음, 09 §4b M6) */
export interface GateResult {
  passed: boolean;
  /** pass 생략 = 통과(기존 썸네일 게이트 호환). 명시적 false 만 화면에 ✕ 로 뜬다 */
  checks: { key: string; label: string; note: string; pass?: boolean }[];
}

/**
 * 콜⑥ studioCopy 산출 — RESULT-02·03 / DETAIL-02 해설 렌더 계약(08 §4.7).
 * 2026-08-18 결과 화면 개편으로 3가지가 붙었다 — 화면이 그리는 순서 그대로다:
 * 제품명 → 원본 한 줄 진단(beforeSummary) → 카피 해설 카드(일본어 / 대응 한국어 원문 / 근거).
 */
export interface ExplanationJson {
  /** 왜 이 문법이 이 제품·플랫폼에 맞는지(1~2문장) */
  styleReason: string;
  /** 결과 헤드라인의 제품명 — 원본 이미지에 인쇄돼 읽히는 값만. 못 읽으면 빈 문자열 */
  productName: string;
  /** 원본(Before) 한 줄 진단 — 한국 원본이 무엇에 기대고 있었는지 */
  beforeSummary: string;
  /** 카피 해설 카드 — ja(일본어) / krSource(대응 한국어 원문) / rationale(재설계 근거) / footnote(※각주) */
  copySlots: { slotKey: string; ja: string; krSource: string; rationale: string; footnote: string }[];
  krElementMap: { element: string; action: '유지·정제' | '재설계' | '제거'; reason: string }[];
}

/** 실적 배지 proof 3필드(HOME-05) — 전부 있을 때만 배지 문단이 프롬프트에 들어간다 */
export interface ThumbnailProof {
  rankTitle: string;
  genre: string;
  aggregationDate: string;
}

/**
 * 프로모션 강조형(G) 입력(HOME-05b) — 가격·특전은 지어낼 수 없는 값이라 사용자 입력만 받는다.
 * 통상가 취소선은 normalPriceVerified가 true일 때만 렌더한다(실적 없는 이중가격 = 有利誤認 리스크).
 */
export interface PromoInput {
  setTitle: string;            // 세트명(필수)
  salePrice: string;           // 판매가(필수, 숫자 문자열)
  normalPrice: string;         // 통상가(선택)
  normalPriceVerified: boolean;// "실제 판매 실적 있음" 체크 — true여야 통상가 취소선 반영(有利誤認 방지)
  discountRate: string;        // 할인율(선택)
  gift: string;                // GIFT(선택)
  qualifierChips: string[];    // 한정 칩(선택)
  footnote: string;            // ※각주(선택)
}

/** 상세페이지 상품 카테고리 — 무드 프로파일·템플릿 선택의 축(② DETAIL-03) */
export type DetailProductCategory = 'skincare' | 'suncare' | 'makeup' | 'cleansing' | 'haircare' | 'etc';

/** 옵션 축 — 색상이면 컬러 블록, 그 외면 라인업 비교 블록이 붙는다 */
export type DetailOptionAxis = 'color' | 'size' | 'set' | 'variant';

/**
 * 상세페이지 생성 입력(② DETAIL-02~06d) — 시퀀스 결정에 쓰이는 **사실**들.
 * LLM이 아니라 사용자·브랜드가 제공하며, 근거가 비면 해당 블록이 통째로 빠진다.
 * spec 은 약기법 표시 의무 영역이라 원문 그대로 저장하고 재가공하지 않는다.
 */
export interface DetailInput {
  productCategory: DetailProductCategory;
  /** 업로드 원본 fileId(위→아래 순서, 1~10장) — 첫 장이 제품 대표컷, 나머지는 KR 상세 원본 */
  sourceImagePaths: string[];
  /** 확인 화면에서 사용자가 끈 블록. 필수 블록은 끌 수 없다 */
  disabledBlocks: string[];
  spec: { volume: string; category: string; manufacturer: string; origin: string; fullIngredients: string };
  ingredients: { name: string; percent: string; purpose: string }[];
  freeOf: string[];
  specs: { label: string; value: string }[];
  howToSteps: string[];
  options: { axis: DetailOptionAxis; name: string; swatchHex?: string; sku?: string }[];
  cautions: string[];
  proof: ThumbnailProof | null;
  sales: { count: string; period: string; reviewCount?: string; rating?: string } | null;
  test: { name: string; condition: string; institution: string; date: string; sampleSize: string } | null;
  reviews: { text: string; rating: string; age: string }[];
  promo: PromoInput | null;
  modelConsent: boolean;

  // ── 콜⑧ inputTranslate 스냅샷 (08 §4.8) ────────────────────────────────────
  // 전부 optional 이다. regenerateBlock 이 **구 자산의 detail_input 을 그대로** 읽으므로,
  // required 로 두면 이 기능 이전에 만든 자산의 블록 재생성이 죽는다.

  /** 변환 전 한국어 원문(감사·되돌리기). 위 필드들에는 이미 일본어가 들어가 있다 */
  sourceKo?: { path: string; kr: string }[];
  /** 「추가 요청」의 영어 변환 — AI 배경컷 프롬프트에 들어간다(한국어 원문은 promptUsed 가 보관) */
  artDirectionEn?: string;
  /** 생성 시점의 브랜드킷 스냅샷 — 브랜드 프로필을 나중에 바꿔도 블록 재생성이 흔들리지 않는다 */
  brandKit?: BrandKit;
  /** 변환에 실패해 한국어가 남은 필드(게이트 기록용) */
  translationIssues?: { path: string; label: string; problem: string }[];
}

/** 블록 상태 — 자산 상태와 별개로 블록별로 진행·실패가 기록된다 */
export type AssetBlockStatus = 'pending' | 'generating' | 'done' | 'failed' | 'skipped';

/**
 * 상세페이지 블록 1개(② asset_blocks).
 * jsonb 컬럼이 아니라 **행 단위**인 이유: AI 블록이 동시에 완료되므로 read-modify-write 로는
 * lost update 가 나고, 파일 스토어 구현에서는 원자적 부분 갱신이 불가능하다.
 */
export interface AssetBlockRecord {
  id: string;
  assetId: string;
  /** 세로 순서(0부터). 재정렬은 이 값만 갱신 */
  seq: number;
  /** 블록 타입(팩 blockCatalog.id) */
  blockType: string;
  /** 'text' | 'ai-visual' | 'hybrid' */
  renderKind: string;
  status: AssetBlockStatus;
  error: string | null;
  /** 게이트를 통과해 확정된 슬롯 */
  slots: Record<string, string>;
  /** ai-visual·hybrid 만 */
  promptUsed: string | null;
  /** AI 배경컷 fileId — 카피만 바꿔 재생성할 때 재사용 */
  visualPath: string | null;
  /** 최종 블록 PNG fileId */
  imagePath: string | null;
  /** 센티넬로 실측한 블록 높이(px) — 결합 시 오프셋 계산 */
  height: number | null;
  version: number;
  /** 되돌리기용 이전 버전 기록 */
  history: { version: number; imagePath: string | null; visualPath: string | null; at: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedAssetRecord {
  id: string;
  /** 소속 브랜드(제출 시점 활성 브랜드 스냅샷) */
  brandProfileId: string;
  kind: 'thumbnail' | 'detail';
  /** 내부 스타일 ID A~H — 화면 비노출(라벨 정책), 표시는 styleName */
  styleCategory: string;
  styleName: string;
  platform: string;
  status: GeneratedAssetStatus;
  /** generating 중 화면 표시용 단계 */
  stage: string | null;
  error: string | null;
  originalImagePath: string;
  imagePath: string | null;
  promptUsed: string | null;
  gateResult: GateResult | null;
  explanationJson: ExplanationJson | null;
  proof: ThumbnailProof | null;
  modelImagePath: string | null;   // F 모델컷 fileId (F 아니면 null)
  modelConsent: boolean;           // 모델 사용 권한 동의(F 필수, 미체크 생성 불가)
  promoInput: PromoInput | null;   // G 프로모 입력(G 아니면 null)
  /** 제출 시점 브랜드명 물질화 — 킷 수정 불소급(tierInput 스냅샷 원칙과 동일) */
  brandNameSnapshot: string;
  // ── kind='detail' 전용 ────────────────────────────────────────────────
  /** 상세페이지 입력 스냅샷(kind='detail' 아니면 null) */
  detailInput: DetailInput | null;
  /** 블록 진행률 — 비정규화 카운터라 블록 배열 없이도 화면이 "3/12"를 그릴 수 있다 */
  blockTotal: number;
  blockDone: number;
  /** 몰 업로드용 분할 fileId 목록(결합본은 imagePath 재사용) */
  slicePaths: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 목록용 자산 요약 — 카드·배지가 실제로 쓰는 필드만. 무거운 jsonb(detailInput·explanationJson·
 * gateResult·proof·promoInput·slicePaths)와 promptUsed 는 **빠져 있다**.
 *
 * 왜 별도 타입인가: `listAssets`가 전체 행을 끌어오면 상세페이지 자산이 쌓일수록 목록 화면 비용이
 * 선형 증가한다(detailInput 은 sourceKo 원문 18슬롯 + brandKit 스냅샷을 통째로 안는다).
 * 상세 화면은 `getAsset(id)`로 전체 레코드를 따로 받는다.
 */
export type GeneratedAssetSummary = Omit<
  GeneratedAssetRecord,
  'detailInput' | 'explanationJson' | 'gateResult' | 'proof' | 'promoInput' | 'promptUsed' | 'slicePaths'
>;

/** 목록용 리포트 요약 — 9블록 본문(blocksJson)이 빠져 있다. 본문은 getReport(requestId)로 받는다 */
export type ReportSummary = Omit<ReportRecord, 'blocksJson'>;

/**
 * 폴링용 자산 상태 스냅샷 — 진행률 표시와 소유 가드에 필요한 최소 필드만.
 * 2.5초마다 도는 경로라 전체 레코드(detailInput·explanationJson·gateResult)를 실으면 안 된다.
 */
export interface AssetStatusSnapshot {
  id: string;
  brandProfileId: string;
  kind: GeneratedAssetRecord['kind'];
  status: GeneratedAssetStatus;
  stage: string | null;
  error: string | null;
  blockTotal: number;
  blockDone: number;
  updatedAt: string;
}

/** 폴링용 블록 상태 — 변경 감지(재생성 완료 등)에 필요한 최소 필드만 */
export interface BlockStatusSnapshot {
  id: string;
  status: AssetBlockStatus;
  version: number;
}

/** 제품 이미지 — fileId + 대표 여부(BRAND-03b). 첫 장이 자동 대표, 대표 삭제 시 첫 장 승계 */
export interface ProductImage {
  fileId: string;
  isPrimary: boolean;
}

/** 제품 자산(BRAND-03) — 브랜드 하위 제품 단위. ② 스튜디오 브랜드 자산 피커(HOME-02)의 소스 */
export interface ProductRecord {
  id: string;
  brandProfileId: string;
  /** 제품명 KR(필수) */
  nameKr: string;
  /** 제품명 JA(선택) */
  nameJa: string;
  /** 카테고리 라벨(선택, 자유 문자열) */
  category: string;
  memo: string;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export type MatchStatus = 'submitted' | 'reviewing' | 'proposed' | 'cancelled';

/** 기업 매칭 신청 — 컨시어지형(상태 갱신은 운영팀 수동, MATCH-04) */
export interface MatchRequestRecord {
  id: string;
  /** 소속 브랜드(신청 시점 활성 브랜드) */
  brandProfileId: string;
  partnerTypes: string[];
  channels: string[];
  timing: string;
  memo: string;
  status: MatchStatus;
  /** 신청 시점 자산 요약 물질화(MATCH-02a) */
  snapshot: { reportCount: number; thumbnailCount: number; latestScore: number | null };
  createdAt: string;
  updatedAt: string;
}

// ── 검증 랜딩(/lp) 리드·트래킹 엔티티 ────────────────────────────────────────

/** 검증 랜딩 리드 — consultation(주 지표)/resource(보조) 공용 레코드 */
export interface LeadRecord {
  id: string;
  kind: LeadKind;
  brandName: string;
  /** resource는 '' 허용 */
  contactName: string;
  /** 이메일 또는 전화(둘 다 문자열 하나로) */
  contact: string;
  /** LEAD_CHANNELS value들 */
  channels: string[];
  /** LEAD_STAGES value | '' */
  stage: string;
  /** PAIN_POINTS 문자열들 */
  painPoints: string[];
  memo: string;
  /** 유입 소스 태그(utm_source/src/referrer) */
  source: string;
  createdAt: string;
}

/** 전환 퍼널 이벤트 — 방문→CTA클릭→영상재생→신청 */
export interface TrackEventRecord {
  id: string;
  type: TrackEventType;
  /** cta_click일 때 어떤 CTA 버튼인지 */
  cta: string | null;
  source: string;
  path: string;
  createdAt: string;
}

/** 브랜드 생성 입력 — id·타임스탬프는 스토어가 부여 */
export type NewBrandProfile = Omit<BrandProfileRecord, 'id' | 'createdAt' | 'updatedAt'>;

export interface Store {
  /** 어떤 구현이 동작 중인지 — UI에 "로컬 저장(dev)" 배지 표시용 */
  kind(): 'supabase' | 'file';
  createRequest(input: TierInput, brandProfileId: string): Promise<DiagnosisRequestRecord>;
  getRequest(id: string): Promise<DiagnosisRequestRecord | null>;
  updateRequest(
    id: string,
    patch: Partial<Pick<DiagnosisRequestRecord, 'status' | 'stage' | 'error' | 'precisionLimited'>>,
  ): Promise<void>;
  saveReport(report: ReportRecord): Promise<void>;
  getReport(requestId: string): Promise<ReportRecord | null>;
  saveLlmLog(requestId: string | null, entry: LlmCallLogEntry): Promise<void>;

  // ── 유저·인증 토큰(실 인증 — 08 §6 USER) ──
  /** id로 유저 조회 — 세션 복원·마이페이지 */
  getUserById(id: string): Promise<UserRecord | null>;
  /** email로 유저 조회 — 로그인·중복 가입 검사. email은 내부에서 소문자 정규화 비교 */
  getUserByEmail(email: string): Promise<UserRecord | null>;
  /** 유저 생성 — id 생략 시 uuid 발급, email은 내부에서 소문자 정규화 저장 */
  createUser(input: {
    id?: string;
    email: string;
    passwordHash: string | null;
    name: string;
    emailVerified: boolean;
  }): Promise<UserRecord>;
  /** 유저 갱신 — 비밀번호 해시·이메일 검증 여부·표시명만 패치 */
  updateUser(id: string, patch: Partial<Pick<UserRecord, 'passwordHash' | 'emailVerified' | 'name'>>): Promise<void>;
  /** 인증 토큰 발급 — 원문 해시(sha256 hex)만 저장 */
  createAuthToken(input: { tokenHash: string; userId: string; kind: 'verify' | 'reset'; expiresAt: string }): Promise<void>;
  /** 토큰 원자적 소비 — 미사용·미만료면 usedAt 마킹 후 레코드 반환, 아니면(없음/사용됨/만료) null */
  consumeAuthToken(tokenHash: string, kind: 'verify' | 'reset'): Promise<AuthTokenRecord | null>;
  /** 재발송 쿨다운용 — 해당 유저·kind의 최신 토큰 1건(사용 여부 무관) */
  getLatestAuthToken(userId: string, kind: 'verify' | 'reset'): Promise<AuthTokenRecord | null>;

  // ── 브랜드 프로필(복수 지원 · MAIN-01 스위처/추가/삭제) ──────────────────────
  /** 해당 유저의 브랜드 목록(최신순) — 스위처·마이페이지 브랜드 목록 */
  listBrandProfiles(userId: string): Promise<BrandProfileRecord[]>;
  /** id로 브랜드 조회 — 활성 브랜드 해석은 lib/server/activeBrand.ts */
  getBrandProfile(id: string): Promise<BrandProfileRecord | null>;
  /** 브랜드 생성(온보딩·추가 모달) — uuid 발급 */
  createBrandProfile(input: NewBrandProfile): Promise<BrandProfileRecord>;
  /** 브랜드 갱신(편집·문서 업로드) — profile.id 기준 upsert */
  saveBrandProfile(profile: BrandProfileRecord): Promise<void>;
  /** 브랜드 삭제(BRAND-10) — 종속 요청·리포트·자산·매칭 cascade */
  deleteBrandProfile(id: string): Promise<void>;

  // ── 스프린트 2 (최신순 목록 조회는 라이브러리·매칭 카운트·마이페이지가 사용)
  //    목록·활성 매칭은 브랜드별 스코핑 — 구 데이터(brandProfileId 없음)는 LEGACY_BRAND_ID로 귀속
  listRequests(brandProfileId: string): Promise<DiagnosisRequestRecord[]>;
  /** 목록용 리포트(최신순) — 9블록 본문 제외. 본문이 필요하면 getReport(requestId) */
  listReports(brandProfileId: string): Promise<ReportSummary[]>;
  createAsset(input: Omit<GeneratedAssetRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<GeneratedAssetRecord>;
  getAsset(id: string): Promise<GeneratedAssetRecord | null>;
  updateAsset(
    id: string,
    patch: Partial<
      Pick<
        GeneratedAssetRecord,
        | 'status' | 'stage' | 'error' | 'imagePath' | 'promptUsed' | 'gateResult' | 'explanationJson'
        | 'blockTotal' | 'blockDone' | 'slicePaths'
      >
    >,
  ): Promise<void>;
  /** 목록용 자산(최신순) — 무거운 jsonb 제외. 전체 레코드가 필요하면 getAsset(id) */
  listAssets(brandProfileId: string): Promise<GeneratedAssetSummary[]>;
  /** 폴링용 상태 스냅샷 — 진행률·소유 가드 필드만. 2.5초 주기 경로 전용 */
  getAssetStatus(id: string): Promise<AssetStatusSnapshot | null>;

  // ── ② 상세페이지 블록(asset_blocks) ────────────────────────────────────
  /** 시퀀스 확정 직후 블록 행을 일괄 생성한다(seq 순서 그대로) */
  createBlocks(
    assetId: string,
    blocks: Omit<AssetBlockRecord, 'id' | 'assetId' | 'createdAt' | 'updatedAt'>[],
  ): Promise<AssetBlockRecord[]>;
  /** seq 오름차순 */
  listBlocks(assetId: string): Promise<AssetBlockRecord[]>;
  /** 폴링용 블록 상태 목록 — slots·history 없이 변경 감지 필드만 */
  listBlockStatuses(assetId: string): Promise<BlockStatusSnapshot[]>;
  getBlock(blockId: string): Promise<AssetBlockRecord | null>;
  updateBlock(
    blockId: string,
    patch: Partial<
      Pick<
        AssetBlockRecord,
        'seq' | 'status' | 'error' | 'slots' | 'promptUsed' | 'visualPath' | 'imagePath' | 'height' | 'version' | 'history'
      >
    >,
  ): Promise<void>;
  /** 완료 블록 수를 원자적으로 1 증가시킨다 — 동시 완료에서도 카운터가 유실되지 않는다 */
  incrementBlockDone(assetId: string): Promise<void>;
  createMatchRequest(
    input: Omit<MatchRequestRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ): Promise<MatchRequestRecord>;
  /** 취소되지 않은 최신 신청 1건(브랜드별) — 화면·사이드바 배지의 단일 소스 */
  getActiveMatchRequest(brandProfileId: string): Promise<MatchRequestRecord | null>;
  cancelMatchRequest(id: string): Promise<void>;

  // ── 검증 랜딩(/lp) 리드·트래킹 ─────────────────────────────────────────────
  createLead(input: Omit<LeadRecord, 'id' | 'createdAt'>): Promise<LeadRecord>;
  /** 최신순 */
  listLeads(): Promise<LeadRecord[]>;
  createTrackEvent(input: Omit<TrackEventRecord, 'id' | 'createdAt'>): Promise<TrackEventRecord>;
  /** 최신순 */
  listTrackEvents(): Promise<TrackEventRecord[]>;
  // ── 제품 자산(BRAND-03) — 브랜드별 스코핑 ────────────────────────────────────
  listProducts(brandProfileId: string): Promise<ProductRecord[]>;
  getProduct(id: string): Promise<ProductRecord | null>;
  createProduct(input: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductRecord>;
  updateProduct(
    id: string,
    patch: Partial<Pick<ProductRecord, 'nameKr' | 'nameJa' | 'category' | 'memo' | 'images'>>,
  ): Promise<void>;
  deleteProduct(id: string): Promise<void>;
}

let storeInstance: Store | null = null;

/** 환경에 따라 저장 구현을 선택한다(프로세스 캐시) */
export async function getStore(): Promise<Store> {
  if (storeInstance) return storeInstance;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createSupabaseStore } = await import('./supabaseStore');
    storeInstance = createSupabaseStore();
  } else {
    // 프로덕션(서버리스)에서 파일 저장(.data/)은 읽기전용 FS(EROFS)라 가입·저장이 500으로 죽고,
    // 인스턴스 간 비공유라 폴백해도 데이터가 유실된다. 조용히 폴백하면 "가입/로그인 안 됨"의
    // 원인을 추적하기 어려우므로, 요청 시점에는 즉시 명시적 에러로 승격한다(11 §4·§8 가드).
    // 빌드 프리렌더(NEXT_PHASE)에서는 데이터를 쓰지 않으므로 폴백을 허용해 빌드를 깨지 않는다.
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
      throw new Error(
        'Supabase 환경변수 미설정 — 프로덕션은 Supabase 저장이 필수입니다. ' +
          'Vercel 환경변수에 NEXT_PUBLIC_SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY를 설정하고 Redeploy 하세요 ' +
          '(docs/deploy-runbook.md §1-B·§5). 파일 저장(.data/)은 서버리스 읽기전용 FS에서 동작하지 않습니다.',
      );
    }
    const { createFileStore } = await import('./fileStore');
    storeInstance = createFileStore();
  }
  return storeInstance;
}
