/**
 * 저장 계층 인터페이스 — 엔티티 계약은 08 §6 (이번 범위 간소화: AuditSentence는 blocksJson 내 포함).
 * 구현 선택: SUPABASE_URL 있으면 Supabase(supabaseStore), 없으면 .data/ 파일 스토어(dev 폴백).
 */

import type { BlocksJson, Category, ReportStatus, RubricGroup, RubricItemId, TierInput } from '../engine/types';
import type { LlmCallLogEntry } from '../engine/llm/client';

export interface DiagnosisRequestRecord {
  id: string;
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

/** 브랜드 프로필 — 싱글턴(id='default', 다중 브랜드 미정). 편집 정본은 /app/brand */
export interface BrandProfileRecord {
  id: 'default';
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

export interface GeneratedAssetRecord {
  id: string;
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
  /** 제출 시점 브랜드명 물질화 — 킷 수정 불소급(tierInput 스냅샷 원칙과 동일) */
  brandNameSnapshot: string;
  createdAt: string;
  updatedAt: string;
}

export type MatchStatus = 'submitted' | 'reviewing' | 'proposed' | 'cancelled';

/** 기업 매칭 신청 — 컨시어지형(상태 갱신은 운영팀 수동, MATCH-04) */
export interface MatchRequestRecord {
  id: string;
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

export interface Store {
  /** 어떤 구현이 동작 중인지 — UI에 "로컬 저장(dev)" 배지 표시용 */
  kind(): 'supabase' | 'file';
  createRequest(input: TierInput): Promise<DiagnosisRequestRecord>;
  getRequest(id: string): Promise<DiagnosisRequestRecord | null>;
  updateRequest(
    id: string,
    patch: Partial<Pick<DiagnosisRequestRecord, 'status' | 'stage' | 'error' | 'precisionLimited'>>,
  ): Promise<void>;
  saveReport(report: ReportRecord): Promise<void>;
  getReport(requestId: string): Promise<ReportRecord | null>;
  saveLlmLog(requestId: string | null, entry: LlmCallLogEntry): Promise<void>;

  // ── 스프린트 2 (최신순 목록 조회는 라이브러리·매칭 카운트·마이페이지가 사용)
  listRequests(): Promise<DiagnosisRequestRecord[]>;
  listReports(): Promise<ReportRecord[]>;
  getBrandProfile(): Promise<BrandProfileRecord | null>;
  saveBrandProfile(profile: BrandProfileRecord): Promise<void>;
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
  listAssets(): Promise<GeneratedAssetRecord[]>;
  createMatchRequest(
    input: Omit<MatchRequestRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ): Promise<MatchRequestRecord>;
  /** 취소되지 않은 최신 신청 1건 — 화면·사이드바 배지의 단일 소스 */
  getActiveMatchRequest(): Promise<MatchRequestRecord | null>;
  cancelMatchRequest(id: string): Promise<void>;
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
