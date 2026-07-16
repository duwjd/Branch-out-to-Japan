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
  /** null = 브랜드 진단(점수 없음 — reports.overall_score nullable, 스펙 §3.3) */
  overallScore: number | null;
  /** 브랜드 진단은 {} — "채점 안 함"이지 0점이 아니다 */
  groupScores: Partial<Record<RubricGroup, number>>;
  top3: { itemId: RubricItemId; title: string; score: number }[];
  /** 파이프라인 완료 시각 — 잡이 직접 세팅한다(발행 = 파이프라인 성공) */
  publishedAt: string | null;
  createdAt: string;
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
