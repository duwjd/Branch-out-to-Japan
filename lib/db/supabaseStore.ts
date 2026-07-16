/**
 * Supabase 저장 구현 — 08 §6 엔티티의 테이블 매핑(스키마: supabase/schema.sql).
 * 서버 전용(service role 키 사용 — 클라이언트 번들에 절대 노출 금지).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DiagnosisRequestRecord, ReportRecord, Store } from './store';
import type { BlocksJson, ReportStatus, TierInput } from '../engine/types';
import type { LlmCallLogEntry } from '../engine/llm/client';

interface RequestRow {
  id: string;
  tier_input: TierInput;
  precision_limited: boolean;
  status: ReportStatus;
  stage: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportRow {
  request_id: string;
  blocks_json: BlocksJson;
  overall_score: number | null;
  group_scores: ReportRecord['groupScores'];
  top3: ReportRecord['top3'];
  published_at: string | null;
  created_at: string;
}

function toRequestRecord(row: RequestRow): DiagnosisRequestRecord {
  return {
    id: row.id,
    tierInput: row.tier_input,
    precisionLimited: row.precision_limited,
    status: row.status,
    stage: row.stage,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toReportRecord(row: ReportRow): ReportRecord {
  return {
    requestId: row.request_id,
    blocksJson: row.blocks_json,
    overallScore: row.overall_score,
    groupScores: row.group_scores,
    top3: row.top3,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

/** Supabase 스토어 생성 — 호출 전 env 존재는 getStore()가 보장 */
export function createSupabaseStore(): Store {
  const client: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  );

  /** supabase 오류를 명시적으로 던진다(원인 파악용) */
  function must<T>(result: { data: T | null; error: { message: string } | null }, op: string): T {
    if (result.error) throw new Error(`supabase ${op} 실패: ${result.error.message}`);
    return result.data as T;
  }

  return {
    kind: () => 'supabase',

    async createRequest(input: TierInput) {
      const result = await client
        .from('diagnosis_requests')
        .insert({ tier_input: input, status: 'submitted' })
        .select()
        .single<RequestRow>();
      return toRequestRecord(must(result, 'createRequest'));
    },

    async getRequest(id) {
      const result = await client.from('diagnosis_requests').select().eq('id', id).maybeSingle<RequestRow>();
      if (result.error) throw new Error(`supabase getRequest 실패: ${result.error.message}`);
      return result.data ? toRequestRecord(result.data) : null;
    },

    async updateRequest(id, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.stage !== undefined) row.stage = patch.stage;
      if (patch.error !== undefined) row.error = patch.error;
      if (patch.precisionLimited !== undefined) row.precision_limited = patch.precisionLimited;
      const result = await client.from('diagnosis_requests').update(row).eq('id', id);
      if (result.error) throw new Error(`supabase updateRequest 실패: ${result.error.message}`);
    },

    async saveReport(report: ReportRecord) {
      const result = await client.from('reports').upsert(
        {
          request_id: report.requestId,
          blocks_json: report.blocksJson,
          overall_score: report.overallScore,
          group_scores: report.groupScores,
          top3: report.top3,
          published_at: report.publishedAt,
        },
        { onConflict: 'request_id' },
      );
      if (result.error) throw new Error(`supabase saveReport 실패: ${result.error.message}`);
    },

    async getReport(requestId) {
      const result = await client.from('reports').select().eq('request_id', requestId).maybeSingle<ReportRow>();
      if (result.error) throw new Error(`supabase getReport 실패: ${result.error.message}`);
      return result.data ? toReportRecord(result.data) : null;
    },

    async saveLlmLog(requestId, entry: LlmCallLogEntry) {
      const result = await client.from('llm_call_logs').insert({
        request_id: requestId,
        call_name: entry.callName,
        model: entry.model,
        mode: entry.mode,
        request_summary: entry.requestSummary,
        response_body: entry.responseBody,
        usage: entry.usage,
        status: entry.status,
        duration_ms: entry.durationMs,
      });
      if (result.error) throw new Error(`supabase saveLlmLog 실패: ${result.error.message}`);
    },
  };
}
