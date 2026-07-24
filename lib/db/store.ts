/**
 * 저장 계층 인터페이스 — 엔티티 계약은 08 §6 (이번 범위 간소화: AuditSentence는 blocksJson 내 포함).
 * 구현 선택: SUPABASE_URL 있으면 Supabase(supabaseStore), 없으면 .data/ 파일 스토어(dev 폴백).
 */

import type { BlocksJson, Category, ReportStatus, RubricGroup, RubricItemId, TierInput } from '../engine/types';
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

/** 브랜드 관리 화면의 제품분류 — 진단 엔진의 ProductClass(3종)보다 넓다(08 §6.1 ER) */
export type BrandProductClass = '화장품' | '의약외품' | '건강식품' | '미상';

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
  checks: { key: string; label: string; note: string }[];
}

/** 콜⑥ studioCopy 산출 — RESULT-02·03 / DETAIL-02 해설 렌더 계약(08 §4.7) */
export interface ExplanationJson {
  styleReason: string;
  copySlots: { slotKey: string; ja: string; krIntent: string; rationale: string; footnote: string }[];
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

export interface GeneratedAssetRecord {
  id: string;
  /** 소속 브랜드(제출 시점 활성 브랜드 스냅샷) */
  brandProfileId: string;
  kind: 'thumbnail';
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
  createdAt: string;
  updatedAt: string;
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
  listReports(brandProfileId: string): Promise<ReportRecord[]>;
  createAsset(input: Omit<GeneratedAssetRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<GeneratedAssetRecord>;
  getAsset(id: string): Promise<GeneratedAssetRecord | null>;
  updateAsset(
    id: string,
    patch: Partial<
      Pick<
        GeneratedAssetRecord,
        'status' | 'stage' | 'error' | 'imagePath' | 'promptUsed' | 'gateResult' | 'explanationJson'
      >
    >,
  ): Promise<void>;
  listAssets(brandProfileId: string): Promise<GeneratedAssetRecord[]>;
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
    const { createFileStore } = await import('./fileStore');
    storeInstance = createFileStore();
  }
  return storeInstance;
}
