/**
 * 상세페이지 생성 준비 상태 점검 — "이 서버에서 지금 누르면 실제로 나오는가".
 *
 * 왜 필요한가: 상세 잡은 카피 1콜 + 이미지 최대 4콜을 **먼저 태우고** 마지막에 블록을 저장한다.
 * 마이그레이션이 안 된 서버에서는 그 돈과 2분을 다 쓴 뒤 `asset_blocks` 없음으로 죽고,
 * 화면에는 10분 뒤 스테일 가드가 붙인 `failed` 만 남는다 — 원인을 알 길이 없다.
 * 그래서 제출 전에 막고, 무엇을 어떻게 고치는지 한국어로 돌려준다.
 *
 * 배포 절차 정본: docs/11-deploy-spec.md · docs/deploy-runbook.md
 */

import { getStore } from '../db/store';
import { getSupabaseClient, hasSupabaseEnv } from '../db/supabaseClient';
import { currentLlmMode } from '../engine/llm/client';
import { currentImageMode } from '../studio/imageGen';
import { jpFonts } from '../studio/detail/fonts';
import { logger } from '../logger';

/** blocked = 생성 자체를 막는다. warn = 생성은 되지만 결과가 기대와 다르다. */
export type ReadinessLevel = 'blocked' | 'warn';

export interface ReadinessCheck {
  key: 'store' | 'schema' | 'storage' | 'fonts' | 'llm' | 'image';
  /** 화면에 그대로 쓰는 라벨 */
  label: string;
  ok: boolean;
  level: ReadinessLevel;
  /** 무엇이 잘못됐는지(ok면 정상 상태 설명) */
  detail: string;
  /** 어떻게 고치는지 — ok면 null */
  fix: string | null;
}

export interface DetailReadiness {
  /** blocked 항목이 하나도 없으면 true */
  ready: boolean;
  checks: ReadinessCheck[];
}

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/** 점검 결과 캐시 — 폼 진입마다 Supabase를 두 번씩 두드리지 않기 위해. 실패는 캐시하지 않는다. */
const CACHE_MS = 30_000;
/** 준비 미완 상태의 캐시 수명 — 복구를 빨리 반영해야 하므로 성공 캐시보다 짧다 */
const FAILED_CACHE_MS = 5_000;

let cached: { at: number; ttl: number; value: DetailReadiness } | null = null;

/**
 * 상세페이지 생성이 가능한 상태인지 점검한다.
 * @param force 캐시를 무시하고 다시 점검한다(제출 직전 경로에서 사용)
 */
export async function checkDetailReadiness(force = false): Promise<DetailReadiness> {
  if (!force && cached && Date.now() - cached.at < cached.ttl) return cached.value;

  // 원격 점검 3종은 서로 독립이다 — 직렬로 기다리면 폼 진입·제출 앞에 왕복 3회가 그대로 쌓인다
  const [store, schema, storage] = await Promise.all([checkStore(), checkSchema(), checkStorage()]);
  const checks: ReadinessCheck[] = [store, schema, storage, checkFonts(), checkLlm(), checkImage()];

  const value: DetailReadiness = {
    ready: checks.every((c) => c.ok || c.level !== 'blocked'),
    checks,
  };
  // 실패 상태도 짧게 캐시한다 — 준비 미완 서버에서 폼 진입·제출·조회가 매번 왕복 3회를 새로 내던
  // 문제를 막는다. 복구를 오래 못 알아채면 곤란하므로 성공보다 훨씬 짧은 수명을 준다.
  cached = { at: Date.now(), ttl: value.ready ? CACHE_MS : FAILED_CACHE_MS, value };
  return value;
}

/** 제출 라우트용 — blocked 사유만 한 줄로 합친다. 정상이면 null. */
export function blockingReason(readiness: DetailReadiness): string | null {
  const blocked = readiness.checks.filter((c) => !c.ok && c.level === 'blocked');
  if (blocked.length === 0) return null;
  return blocked.map((c) => `${c.label}: ${c.detail}`).join(' / ');
}

/** 저장 백엔드 — 서버리스에서 로컬 FS는 요청마다 사라지므로 프로덕션은 Supabase여야 한다. */
async function checkStore(): Promise<ReadinessCheck> {
  const kind = (await getStore()).kind();
  if (kind === 'supabase') {
    return { key: 'store', label: '저장 백엔드', ok: true, level: 'blocked', detail: 'Supabase', fix: null };
  }
  return {
    key: 'store',
    label: '저장 백엔드',
    ok: !isProduction(),
    level: 'blocked',
    detail: isProduction()
      ? '로컬 파일 저장으로 동작 중입니다. 서버리스에서는 요청이 끝나면 파일이 사라져 결과를 다시 열 수 없습니다.'
      : '로컬 파일 저장(개발 환경)',
    fix: isProduction() ? 'Vercel 환경변수에 Supabase 3종을 설정하고 Redeploy (11 §4)' : null,
  };
}

/**
 * 마이그레이션 적용 여부 — `asset_blocks` 테이블과 `generated_assets.slice_paths` 컬럼을 직접 조회한다.
 * PostgREST 는 행이 0건이어도 없는 테이블·컬럼이면 에러를 주므로 빈 DB에서도 판정이 선다.
 */
async function checkSchema(): Promise<ReadinessCheck> {
  const label = '상세페이지 스키마';
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
    const blocks = await client.from('asset_blocks').select('id').limit(1);
    if (blocks.error) missing.push(`asset_blocks 테이블(${blocks.error.message})`);
    const cols = await client
      .from('generated_assets')
      .select('id, detail_input, block_total, block_done, slice_paths')
      .limit(1);
    if (cols.error) missing.push(`generated_assets 상세 컬럼(${cols.error.message})`);
  } catch (err) {
    missing.push(String(err));
  }
  if (missing.length === 0) {
    return {
      key: 'schema',
      label,
      ok: true,
      level: 'blocked',
      detail: 'asset_blocks · generated_assets 델타 적용됨',
      fix: null,
    };
  }
  logger.error('상세페이지 스키마 미적용', { missing });
  return {
    key: 'schema',
    label,
    ok: false,
    level: 'blocked',
    detail: `마이그레이션이 적용되지 않았습니다 — ${missing.join(' / ')}`,
    fix: 'Supabase 대시보드 → SQL Editor 에서 supabase/schema.sql 의 "2026-08-10 · ② 마케팅 스튜디오 — 상세페이지 만들기" 블록을 실행하세요(멱등이라 재실행해도 안전합니다).',
  };
}

/** Storage 버킷 — 블록 PNG·분할본·결합본이 전부 여기로 간다. */
async function checkStorage(): Promise<ReadinessCheck> {
  const label = '파일 저장소';
  if (!hasSupabaseEnv()) {
    return { key: 'storage', label, ok: true, level: 'blocked', detail: '로컬 .data/files (개발 환경)', fix: null };
  }
  const { error } = await getSupabaseClient().storage.from('files').list('', { limit: 1 });
  if (!error)
    return { key: 'storage', label, ok: true, level: 'blocked', detail: 'Supabase Storage 버킷 files', fix: null };
  return {
    key: 'storage',
    label,
    ok: false,
    level: 'blocked',
    detail: `버킷 files 에 접근할 수 없습니다 — ${error.message}`,
    fix: 'Supabase 대시보드 → Storage 에서 private 버킷 `files` 를 만드세요(docs/setup-supabase.md 4단계).',
  };
}

/**
 * 일본어 폰트 — 없으면 satori 가 Google Fonts 를 런타임 fetch 하고, 실패하면 글자가 두부(□)가 된다.
 * 배포본에서 사라지는 원인은 next.config.ts 의 outputFileTracingIncludes 누락이다.
 */
function checkFonts(): ReadinessCheck {
  const label = '일본어 폰트';
  try {
    const fonts = jpFonts();
    const empty = fonts.filter((f) => !f.data || f.data.length === 0);
    if (fonts.length < 2 || empty.length > 0) throw new Error(`폰트 ${fonts.length}개 · 빈 파일 ${empty.length}개`);
    const mb = (fonts.reduce((a, f) => a + f.data.length, 0) / 1024 / 1024).toFixed(1);
    return { key: 'fonts', label, ok: true, level: 'blocked', detail: `NotoSansJP Regular·Bold (${mb}MB)`, fix: null };
  } catch (err) {
    logger.error('일본어 폰트 로드 실패', { reason: String(err) });
    return {
      key: 'fonts',
      label,
      ok: false,
      level: 'blocked',
      detail: `배포본에서 폰트를 읽을 수 없습니다 — ${String(err)}`,
      fix: 'next.config.ts 의 outputFileTracingIncludes 에 "./app/fonts/jp/**" 가 있는지 확인하고, app/fonts/jp/*.otf 가 저장소에 커밋됐는지 확인하세요.',
    };
  }
}

/** LLM 모드 — 목 모드면 카피가 고정 문구라 실사용 결과가 아니다. */
function checkLlm(): ReadinessCheck {
  const real = currentLlmMode() !== 'mock';
  return {
    key: 'llm',
    label: '카피 생성(Claude)',
    ok: real,
    level: isProduction() ? 'blocked' : 'warn',
    detail: real ? '실호출' : '목 모드 — 고정 샘플 카피가 들어갑니다.',
    fix: real ? null : 'Vercel 환경변수에 ANTHROPIC_API_KEY 를 설정하고 Redeploy (11 §4)',
  };
}

/** 이미지 모드 — 목 모드면 배경컷이 단색 그라디언트다. */
function checkImage(): ReadinessCheck {
  const real = currentImageMode() !== 'mock';
  return {
    key: 'image',
    label: '배경컷 생성(gpt-image)',
    ok: real,
    level: isProduction() ? 'blocked' : 'warn',
    detail: real ? '실호출' : '목 모드 — 배경컷이 단색으로 채워집니다.',
    fix: real ? null : 'Vercel 환경변수에 OPENAI_API_KEY 를 설정하고 Redeploy (11 §4)',
  };
}
