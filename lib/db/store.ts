/**
 * 저장 계층 인터페이스 — 엔티티 계약은 08 §6 (이번 범위 간소화: AuditSentence는 blocksJson 내 포함).
 * 구현 선택: SUPABASE_URL 있으면 Supabase(supabaseStore), 없으면 .data/ 파일 스토어(dev 폴백).
 */

import type { BlocksJson, ReportStatus, RubricGroup, RubricItemId, TierInput } from '../engine/types';
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
  overallScore: number;
  groupScores: Record<RubricGroup, number>;
  top3: { itemId: RubricItemId; title: string; score: number }[];
  reviewerName: string | null;
  reviewerSignedAt: string | null;
  rejectedReason: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ReviewQueueItem {
  request: DiagnosisRequestRecord;
  report: ReportRecord;
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
  listByStatus(status: ReportStatus): Promise<ReviewQueueItem[]>;
  signReport(requestId: string, reviewerName: string): Promise<void>;
  rejectReport(requestId: string, reason: string): Promise<void>;
  saveLlmLog(requestId: string | null, entry: LlmCallLogEntry): Promise<void>;
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
