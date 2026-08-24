/**
 * ① 진단 리포트 생성 준비 상태 점검 — "이 서버에서 지금 제출하면 실제로 발행되는가".
 *
 * 왜 필요한가: 리포트 잡은 LLM 4~5콜을 **먼저 태우고** 마지막에 저장한다. `claude-opus-5` 로
 * 올린 뒤로는 풀 진단 한 건이 5분·실비다. 스키마가 안 맞는 서버에서는 그 5분을 다 쓴 뒤
 * 저장 단계에서 죽고, 화면에는 원인 없는 `failed` 만 남는다.
 *
 * ② 상세페이지 축이 같은 이유로 `detailReadiness.ts` 를 두고 있다. 이 파일은 그 ① 대응물이며
 * 구조·용어를 의도적으로 맞췄다 — 두 축의 점검이 서로 다른 모양이면 런북이 두 벌이 된다.
 *
 * 배포 절차 정본: docs/11-deploy-spec.md · docs/deploy-runbook.md
 */

import { getStore } from '../db/store';
import { getSupabaseClient, hasSupabaseEnv } from '../db/supabaseClient';
import { currentLlmMode } from '../engine/llm/client';
import { logger } from '../logger';

/** blocked = 제출 자체를 막는다. warn = 발행은 되지만 결과가 기대와 다르다. */
export type ReportReadinessLevel = 'blocked' | 'warn';

export interface ReportReadinessCheck {
  key: 'store' | 'schema' | 'llm';
  /** 화면에 그대로 쓰는 라벨 */
  label: string;
  ok: boolean;
  level: ReportReadinessLevel;
  /** 무엇이 잘못됐는지(ok면 정상 상태 설명) */
  detail: string;
  /** 어떻게 고치는지 — ok면 null */
  fix: string | null;
}

export interface ReportReadiness {
  /** blocked 항목이 하나도 없으면 true */
  ready: boolean;
  checks: ReportReadinessCheck[];
}

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/** 점검 결과 캐시 — 폼 진입마다 Supabase를 두드리지 않기 위해. 실패는 짧게만 캐시한다 */
const CACHE_MS = 30_000;
const FAILED_CACHE_MS = 5_000;

let cached: { at: number; ttl: number; value: ReportReadiness } | null = null;

/**
 * 리포트 생성이 가능한 상태인지 점검한다.
 * @param force 캐시를 무시하고 다시 점검한다(제출 직전 경로에서 사용)
 */
export async function checkReportReadiness(force = false): Promise<ReportReadiness> {
  if (!force && cached && Date.now() - cached.at < cached.ttl) return cached.value;

  const [store, schema] = await Promise.all([checkStore(), checkSchema()]);
  const checks: ReportReadinessCheck[] = [store, schema, checkLlm()];

  const value: ReportReadiness = { ready: checks.every((c) => c.ok || c.level !== 'blocked'), checks };
  cached = { at: Date.now(), ttl: value.ready ? CACHE_MS : FAILED_CACHE_MS, value };
  return value;
}

/** 제출 라우트용 — blocked 사유만 한 줄로 합친다. 정상이면 null. */
export function reportBlockingReason(readiness: ReportReadiness): string | null {
  const blocked = readiness.checks.filter((c) => !c.ok && c.level === 'blocked');
  if (blocked.length === 0) return null;
  return blocked.map((c) => `${c.label}: ${c.detail}`).join(' / ');
}

/**
 * 저장 백엔드 — 서버리스에서 로컬 FS는 요청마다 사라지므로 프로덕션은 Supabase여야 한다.
 *
 * ⚠ `getStore()` 는 **프로덕션 + Supabase 미설정이면 throw 한다**(store.ts 의 명시적 승격).
 *   여기서 그대로 새어 나가면 `GET /api/report` 가 500이 되는데, 그 라우트는 런북 §3이
 *   "오설정을 throw로 감추지 않고 드러내는 확진 관문"으로 쓰는 곳이다. 점검이 진단을 막으면 안 된다 —
 *   던진 사유를 그대로 blocked 항목의 내용으로 돌려준다. 그게 이 점검이 알려주려던 바로 그 정보다.
 */
async function checkStore(): Promise<ReportReadinessCheck> {
  const label = '저장 백엔드';
  let kind: string;
  try {
    kind = (await getStore()).kind();
  } catch (err) {
    const detail = String((err as Error)?.message ?? err);
    logger.error('저장 백엔드 점검 실패', { detail });
    return {
      key: 'store',
      label,
      ok: false,
      level: 'blocked',
      detail,
      fix: 'Vercel 환경변수에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 를 설정하고 Redeploy 하세요(docs/deploy-runbook.md §5).',
    };
  }
  if (kind === 'supabase') {
    return { key: 'store', label, ok: true, level: 'blocked', detail: 'Supabase 연결됨', fix: null };
  }
  if (!isProduction()) {
    return { key: 'store', label, ok: true, level: 'warn', detail: '로컬 파일 저장(dev)', fix: null };
  }
  return {
    key: 'store',
    label,
    ok: false,
    level: 'blocked',
    detail: '프로덕션인데 로컬 파일 저장 모드입니다 — 발행한 리포트가 다음 요청에서 사라집니다.',
    fix: 'Vercel 환경변수에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 를 설정하세요(docs/deploy-runbook.md §5).',
  };
}

/**
 * 스키마 델타 — 코드가 기대하는 컬럼이 실제로 있는지.
 *
 * PostgREST 는 모르는 컬럼을 select 하면 에러를 준다. 그 성질을 그대로 탐침으로 쓴다
 * (`detailReadiness.checkSchema` 와 같은 방식). 컬럼 목록은 `scripts/db-push.mjs` 의
 * `EXPECTED` 와 같은 계약이다 — 한쪽만 늘리면 점검이 뚫린다.
 */
async function checkSchema(): Promise<ReportReadinessCheck> {
  const label = '리포트 스키마';
  if (!hasSupabaseEnv()) {
    return {
      key: 'schema',
      label,
      ok: true,
      level: 'blocked',
      detail: '로컬 저장 모드에서는 마이그레이션이 필요 없습니다.',
      fix: null,
    };
  }
  const client = getSupabaseClient();
  const missing: string[] = [];
  try {
    const reports = await client
      .from('reports')
      .select('request_id, blocks_json, humanize_issues, humanize_skipped')
      .limit(1);
    if (reports.error) missing.push(`reports 컬럼(${reports.error.message})`);
  } catch (err) {
    missing.push(String(err));
  }
  if (missing.length === 0) {
    return { key: 'schema', label, ok: true, level: 'blocked', detail: 'reports 윤문 기록 컬럼 적용됨', fix: null };
  }
  logger.error('리포트 스키마 미적용', { missing });
  return {
    key: 'schema',
    label,
    ok: false,
    // 진단 기록용 컬럼이라 **발행 자체는 막지 않는다** — 저장 계층이 본문만 저장하는 폴백을 가진다.
    // 다만 그 상태로 두면 윤문 반려 내역이 조용히 사라지므로 화면에 남긴다.
    level: 'warn',
    detail: `마이그레이션이 적용되지 않았습니다 — ${missing.join(' / ')}. 리포트는 발행되지만 윤문 반려 내역이 저장되지 않습니다.`,
    fix: 'npm run db:push 를 실행하세요(또는 Supabase → SQL Editor 에서 supabase/schema.sql 의 "2026-08-19 · ① 리포트 한국어 윤문(콜⑩) 기록" 블록 실행 — 멱등이라 재실행해도 안전합니다).',
  };
}

/** LLM 모드 — 목 모드면 픽스처가 나온다. 진단이 아니다. */
function checkLlm(): ReportReadinessCheck {
  const label = '진단 엔진';
  const mode = currentLlmMode();
  if (mode === 'real') {
    return { key: 'llm', label, ok: true, level: 'blocked', detail: '실 LLM 연결됨', fix: null };
  }
  if (!isProduction()) {
    return { key: 'llm', label, ok: true, level: 'warn', detail: '목 모드(dev) — 고정 픽스처가 나옵니다', fix: null };
  }
  return {
    key: 'llm',
    label,
    ok: false,
    level: 'blocked',
    detail: '프로덕션인데 목 모드입니다 — 진단이 아니라 고정 픽스처가 발행됩니다.',
    fix: 'Vercel 환경변수에 ANTHROPIC_API_KEY 를 설정하세요.',
  };
}
