# Supabase 셋업 (4단계 · 약 7분)

> 저장 계층 기본안(08 §8-D1). **키를 채우기 전까지는 `.data/` 로컬 파일 스토어로 자동 폴백**되며, 화면에 "로컬 저장(dev)" 배지가 표시된다. 배포(프로덕션)에서는 폴백이 동작하지 않으므로 필수([[11-deploy-spec]] §1).
> 배포 전체 절차(Vercel 포함)·정지 복구는 [deploy-runbook.md](deploy-runbook.md).

## 1. 프로젝트 생성
1. https://supabase.com → 로그인 → **New project**
2. 이름 자유(예: `japan-growth-studio`), 리전 `Northeast Asia (Seoul)` 권장, DB 비밀번호는 보관.

## 2. 스키마 실행

두 가지 방법이 있다. **§5를 먼저 세팅했다면 `npm run db:push` 한 줄이면 끝난다.**

**A. 명령 한 줄 (권장)**
```
npm run db:push
```
`supabase/schema.sql` 전체를 DB에 적용하고, 코드가 기대하는 테이블·컬럼이 실제로 생겼는지까지 확인한다.
스키마 파일이 멱등하게 쓰여 있어(`create table if not exists` · `alter table ... add column if not exists`)
**몇 번을 다시 실행해도 안전**하다. 적용 없이 상태만 보려면 `npm run db:check`.

**B. 대시보드 (§5 없이)**
1. 대시보드 좌측 **SQL Editor** → New query
2. 저장소의 [`supabase/schema.sql`](../supabase/schema.sql) 내용 전체를 붙여넣고 **Run**
3. Table Editor에서 `diagnosis_requests` · `reports` · `llm_call_logs` 3개 테이블 확인

## 3. Storage 버킷 생성 (파일 업로드·생성 이미지용)
1. 대시보드 좌측 **Storage** → **New bucket**
2. 이름 **`files`** (코드 고정값 — `lib/files/storage.ts`), **Public bucket 체크 해제**(private — 서빙은 `GET /api/files/[id]`가 담당)
3. 나머지 옵션 기본값으로 **Create**

## 4. .env 채우기
대시보드 **Settings → API** 에서 값 복사 → 저장소 루트 `.env` 파일에:

```
NEXT_PUBLIC_SUPABASE_URL=      ← Project URL
SUPABASE_SERVICE_ROLE_KEY=     ← service_role 키 (서버 전용 — 절대 커밋·공유 금지)
```

`.env`는 gitignore 되어 있다. 키 이름 정본: [`.env.example`](../.env.example).

완료 후 `npm run dev` 재시작 → 화면의 "로컬 저장(dev)" 배지가 사라지면 Supabase 모드다.

## 5. (선택) 마이그레이션 자동화 — `SUPABASE_DB_URL`

`npm run db:push` 로 스키마를 적용하려면 **DB 접속 문자열**이 하나 더 필요하다.
위 3종(API 키)과는 다른 값이다 — service_role 키로는 DDL을 실행할 수 없다.

1. 대시보드 **Project Settings → Database → Connection string** → **Session pooler** 탭
2. URI 를 복사하고 `[YOUR-PASSWORD]` 를 §1에서 보관한 DB 비밀번호로 치환
3. `.env` 에 추가:

```
SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

이 값은 **DB 전권**이다. `.env` 전용이며 Vercel 런타임 환경변수에 넣지 않는다 —
앱은 이 값을 읽지 않고, 마이그레이션은 요청 경로가 아니라 배포 절차이기 때문이다
(서버리스는 콜드 스타트가 동시에 여러 개 떠서 런타임 DDL이 병렬 실행된다).

넣지 않아도 앱은 정상 동작한다. `db:push` 대신 §2-B 대시보드 방법을 쓰면 된다.
