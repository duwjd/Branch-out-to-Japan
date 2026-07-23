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

-- ───────────────────────────────────────────────────────────────────────────
-- 스프린트 2 · 2026-07-21 — ② 실생성 + ③ 운영 엔티티 (08 §6.1 스프린트 2 델타)
-- 멱등 create. user_id 없음 — 인증은 목 세션(데모 유저 1명), Auth 도입 시 일괄 마이그레이션.
-- 파일은 로컬 .data/files/ (image_path 등은 fileId 문자열 — Supabase Storage 전환 시에도 값 불변).
-- ───────────────────────────────────────────────────────────────────────────

-- 브랜드 프로필 — 복수 지원(id=uuid 문자열, 레거시 마이그레이션분만 'default'). 텍스트 PK 유지
create table if not exists brand_profiles (
  id text primary key, -- uuid 문자열(코드가 발급) · 레거시분은 'default'
  brand_name text not null,
  category text not null, -- skincare|makeup|suncare|cleansing
  product_class text not null default '미상', -- 화장품|의약외품|건강식품|미상
  positioning_tags jsonb not null default '[]',
  target_memo text not null default '',
  product_info_memo text not null default '',
  detail_doc_path text,
  detail_doc_name text,
  channels jsonb not null default '{}', -- { krUrl, jp: [{channel, url}] }
  brand_kit jsonb not null default '{}', -- { productNamesJa[], forbiddenTerms[], toneGuide }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 생성 자산(② 썸네일) — 실패물도 status=failed로 남고 라이브러리는 done만 조회
create table if not exists generated_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'thumbnail',
  style_category text not null, -- 내부 스타일 ID A~H (화면 비노출)
  style_name text not null,
  platform text not null default 'unset',
  status text not null default 'generating', -- generating|done|failed
  stage text,
  error text,
  original_image_path text not null, -- fileId
  image_path text, -- fileId (완료 시)
  prompt_used text,
  gate_result jsonb,
  explanation_json jsonb, -- 콜⑥ studioCopy 산출 (08 §4.7)
  proof jsonb, -- 실적 3필드 스냅샷
  brand_name_snapshot text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 기업 매칭 신청 — 컨시어지형. 상태 갱신은 운영팀 수동(대시보드에서 직접 update)
create table if not exists match_requests (
  id uuid primary key default gen_random_uuid(),
  partner_types jsonb not null default '[]',
  channels jsonb not null default '[]',
  timing text not null default '',
  memo text not null default '',
  status text not null default 'submitted', -- submitted|reviewing|proposed|cancelled
  snapshot jsonb not null default '{}', -- { reportCount, thumbnailCount, latestScore }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assets_status on generated_assets(status);
create index if not exists idx_match_status on match_requests(status);

alter table brand_profiles enable row level security;
alter table generated_assets enable row level security;
alter table match_requests enable row level security;

-- ───────────────────────────────────────────────────────────────────────────
-- 마이그레이션 · 2026-07-23 — 복수 브랜드(브랜드별 스코핑, MAIN-01 스위처/추가/삭제)
-- 요청·리포트·자산·매칭에 brand_profile_id(text FK) 추가 + on delete cascade.
-- 멱등. 새 DB는 아래 add column if not exists 만으로 충분하다.
--
-- ⚠ 실행 순서: 이 블록을 애플리케이션 코드보다 먼저 돌린다(구 코드는 이 컬럼을 안 쓴다).
-- ⚠ 백필: 기존 행을 레거시 브랜드 'default'에 귀속시킨다 — 먼저 'default' 브랜드 행이
--   있어야 FK가 성립한다(아래 insert가 없으면 백필 UPDATE가 FK 위반).
-- ───────────────────────────────────────────────────────────────────────────

-- 0) 레거시 귀속용 'default' 브랜드 보장(기존 단일 브랜드가 이 id면 그대로 사용)
insert into brand_profiles (id, brand_name, category)
  select 'default', '기본 브랜드', 'skincare'
  where exists (select 1 from diagnosis_requests)
    and not exists (select 1 from brand_profiles where id = 'default');

alter table diagnosis_requests add column if not exists brand_profile_id text;
alter table reports add column if not exists brand_profile_id text;
alter table generated_assets add column if not exists brand_profile_id text;
alter table match_requests add column if not exists brand_profile_id text;

-- 1) 백필 — 구 행은 전부 레거시 브랜드 소속
update diagnosis_requests set brand_profile_id = 'default' where brand_profile_id is null;
update reports set brand_profile_id = 'default' where brand_profile_id is null;
update generated_assets set brand_profile_id = 'default' where brand_profile_id is null;
update match_requests set brand_profile_id = 'default' where brand_profile_id is null;

-- 2) FK(on delete cascade) — 브랜드 삭제 시 종속 레코드 자동 정리. 멱등 DO 가드
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_requests_brand') then
    alter table diagnosis_requests add constraint fk_requests_brand
      foreign key (brand_profile_id) references brand_profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_reports_brand') then
    alter table reports add constraint fk_reports_brand
      foreign key (brand_profile_id) references brand_profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_assets_brand') then
    alter table generated_assets add constraint fk_assets_brand
      foreign key (brand_profile_id) references brand_profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_match_brand') then
    alter table match_requests add constraint fk_match_brand
      foreign key (brand_profile_id) references brand_profiles(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_requests_brand on diagnosis_requests(brand_profile_id);
create index if not exists idx_reports_brand on reports(brand_profile_id);
create index if not exists idx_assets_brand on generated_assets(brand_profile_id);
create index if not exists idx_match_brand on match_requests(brand_profile_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 마이그레이션 · 2026-07-23 — ② 모델컷/프로모 필드 + ③ 제품 자산(BRAND-03)
-- 멱등. 자산 델타는 add column, 제품은 신규 테이블(brand_profile_id FK cascade).
-- ───────────────────────────────────────────────────────────────────────────

alter table generated_assets add column if not exists model_image_path text;
alter table generated_assets add column if not exists model_consent boolean not null default false;
alter table generated_assets add column if not exists promo_input jsonb;

-- 제품 자산 — 브랜드 하위 제품 단위(이미지는 fileId 배열 jsonb). 브랜드 삭제 시 cascade
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id text references brand_profiles(id) on delete cascade,
  name_kr text not null,
  name_ja text not null default '',
  category text not null default '',
  memo text not null default '',
  images jsonb not null default '[]', -- [{ fileId, isPrimary }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_brand on products(brand_profile_id);
alter table products enable row level security;

-- ───────────────────────────────────────────────────────────────────────────
-- 마이그레이션 · 2026-07-23 — ② 스튜디오 조건 입력 3종(모델+카피형 F · 프로모션 강조형 G)
-- 08 §6 델타: 모델컷 fileId·사용 권한 동의·프로모 입력을 자산 레코드에 함께 보존.
-- 멱등. 구 코드는 이 컬럼을 안 쓰므로 순서 무관하게 먼저 돌려도 안전하다.
-- ───────────────────────────────────────────────────────────────────────────

alter table generated_assets add column if not exists model_image_path text;
alter table generated_assets add column if not exists model_consent boolean not null default false;
alter table generated_assets add column if not exists promo_input jsonb;

-- ───────────────────────────────────────────────────────────────────────────
-- 마이그레이션 · 2026-07-23 — 실 인증(User) + 브랜드 유저 스코핑 (08 §6 USER)
-- 멱등. ⚠ 실행 순서: 이 블록을 애플리케이션 코드보다 먼저 돌린다(구 코드는 users/user_id를 안 쓴다).
-- ⚠ demo-user insert가 brand_profiles.user_id 백필·FK보다 먼저다(FK 성립 조건).
-- ───────────────────────────────────────────────────────────────────────────

-- 유저 — id는 text PK(코드가 'demo-user' 또는 uuid 문자열 발급). email은 소문자 정규화 저장
create table if not exists users (
  id text primary key, -- 'demo-user'(레거시) 또는 uuid 문자열
  email text unique not null,
  password_hash text, -- null = 소셜(목) 계정
  name text not null default '',
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 이메일 검증·비번 재설정 토큰 — 원문 미저장, sha256(hex)만 PK로 보관. 유저 삭제 시 cascade
create table if not exists auth_tokens (
  token_hash text primary key, -- sha256(원문 토큰) hex
  user_id text not null references users(id) on delete cascade,
  kind text not null, -- verify|reset
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_auth_tokens_user on auth_tokens(user_id, kind);

-- 0) 레거시 귀속용 데모 유저 보장 — user_id 백필·FK보다 먼저여야 FK가 성립한다
insert into users (id, email, name, email_verified)
  select 'demo-user', 'demo@kglow.example', '데모 사용자', true
  where not exists (select 1 from users where id = 'demo-user');

-- 1) 브랜드 프로필에 user_id 추가 + 구 브랜드를 데모 유저에 귀속
alter table brand_profiles add column if not exists user_id text;
update brand_profiles set user_id = 'demo-user' where user_id is null;

-- 2) FK(on delete cascade) — 유저 삭제 시 브랜드 자동 정리. 멱등 DO 가드
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_brands_user') then
    alter table brand_profiles add constraint fk_brands_user
      foreign key (user_id) references users(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_brands_user on brand_profiles(user_id);

-- 서버(service role)만 접근하므로 RLS는 켜두고 정책 없이 둔다(anon 접근 차단).
alter table users enable row level security;
alter table auth_tokens enable row level security;
