-- ① 진단 리포트 저장 스키마 (기능 검증 빌드)
-- 정본 엔티티: docs/08-data-flow.md §6.
-- 이번 범위 간소화: audit_sentences 는 reports.blocks_json(블록3) 안에 포함(별도 테이블은 ②축·체커 재사용 시 분리).
-- 인증 생략 단계라 users/brand_profiles 테이블도 아직 없음 — 온보딩 구현 시 추가.
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣기 → Run.

create table if not exists diagnosis_requests (
  id uuid primary key default gen_random_uuid(),
  tier_input jsonb not null,
  precision_limited boolean not null default false,
  status text not null default 'submitted', -- submitted|processing|needsReview|published|failed|rejected (08 §3.3)
  stage text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references diagnosis_requests(id) on delete cascade,
  blocks_json jsonb not null,
  overall_score int not null,
  group_scores jsonb not null,
  top3 jsonb not null,
  reviewer_name text,
  reviewer_signed_at timestamptz,
  rejected_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists llm_call_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references diagnosis_requests(id) on delete set null,
  call_name text not null,
  model text not null,
  mode text not null, -- real|mock
  request_summary jsonb,
  response_body jsonb,
  usage jsonb,
  status text not null, -- ok|retried|failed
  duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists idx_requests_status on diagnosis_requests(status);
create index if not exists idx_llm_logs_request on llm_call_logs(request_id);

-- 서버(service role)만 접근하므로 RLS는 켜두고 정책 없이 둔다(anon 접근 차단).
alter table diagnosis_requests enable row level security;
alter table reports enable row level security;
alter table llm_call_logs enable row level security;
