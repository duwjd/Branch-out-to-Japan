-- ① 진단 리포트 저장 스키마 (기능 검증 빌드)
-- 정본 엔티티: docs/08-data-flow.md §6.
-- 이번 범위 간소화: audit_sentences 는 reports.blocks_json(블록3) 안에 포함(별도 테이블은 ②축·체커 재사용 시 분리).
-- 인증 생략 단계라 users/brand_profiles 테이블도 아직 없음 — 온보딩 구현 시 추가.
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣기 → Run.

create table if not exists diagnosis_requests (
  id uuid primary key default gen_random_uuid(),
  tier_input jsonb not null,
  precision_limited boolean not null default false,
  status text not null default 'submitted', -- submitted|processing|published|failed (08 §3.3)
  stage text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references diagnosis_requests(id) on delete cascade,
  blocks_json jsonb not null,
  overall_score int, -- nullable(2026-07-16 v4): 브랜드 진단 모드는 종합점수가 없다(스펙 §3.3)
  group_scores jsonb not null, -- 브랜드 모드는 {}
  top3 jsonb not null, -- 브랜드 모드는 []
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

-- ───────────────────────────────────────────────────────────────────────────
-- 마이그레이션 · 2026-07-16 검수 단계 제거 (DECISIONS 재결정)
-- 이미 만들어진 DB를 위한 멱등 블록. 새 DB는 위 create만으로 충분하므로 아무것도 하지 않는다.
--
-- ⚠ 실행 순서: 애플리케이션 코드를 먼저 배포한 뒤 이 블록을 돌린다.
--   반대로 하면 구버전 saveReport가 방금 지운 컬럼에 쓰려다 실패한다.
-- ⚠ 백필이 drop보다 먼저다. 남은 needsReview/rejected 행은 새 코드에서 터미널 상태가
--   아니라 클라이언트가 영원히 폴링한다.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) 백필 — 완료된 리포트는 발행으로 간주(파이프라인은 이미 성공했다).
--    반려 건도 발행으로 올린다: 반려 개념이 사라졌고 본문은 이미 생성돼 있다.
update diagnosis_requests set status = 'published', updated_at = now()
 where status in ('needsReview', 'rejected');

-- 2) published_at 채우기 — 서명 없이 발행되므로 비어 있는 행을 생성 시각으로 메운다.
update reports set published_at = created_at where published_at is null;

-- 3) 컬럼 제거 — 백필 뒤에.
alter table reports drop column if exists reviewer_name;
alter table reports drop column if exists reviewer_signed_at;
alter table reports drop column if exists rejected_reason;

-- ───────────────────────────────────────────────────────────────────────────
-- 마이그레이션 · 2026-07-16 입력 브랜드 우선 재구성 (스펙 §3 v4 · DECISIONS)
-- 브랜드 진단 모드는 종합점수가 없으므로 not null 제약을 푼다. 멱등.
--
-- ⚠ 실행 순서: 검수 제거 블록과 반대다 — **이 블록을 애플리케이션 코드보다 먼저** 돌린다.
--   제약 완화는 구 코드를 깨지 않지만(구 코드는 항상 숫자를 썼다),
--   코드를 먼저 배포하면 브랜드 모드 첫 발행이 null insert로 실패한다.
--   tier_input 은 jsonb 라 mode·positioning 필드 추가에 DDL이 필요 없다.
-- ───────────────────────────────────────────────────────────────────────────

alter table reports alter column overall_score drop not null;
