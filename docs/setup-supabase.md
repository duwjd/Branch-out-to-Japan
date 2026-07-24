# Supabase 셋업 (4단계 · 약 7분)

> 저장 계층 기본안(08 §8-D1). **키를 채우기 전까지는 `.data/` 로컬 파일 스토어로 자동 폴백**되며, 화면에 "로컬 저장(dev)" 배지가 표시된다. 배포(프로덕션)에서는 폴백이 동작하지 않으므로 필수([[11-deploy-spec]] §1).

## 1. 프로젝트 생성
1. https://supabase.com → 로그인 → **New project**
2. 이름 자유(예: `japan-growth-studio`), 리전 `Northeast Asia (Seoul)` 권장, DB 비밀번호는 보관.

## 2. 스키마 실행
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
NEXT_PUBLIC_SUPABASE_ANON_KEY= ← anon public 키
SUPABASE_SERVICE_ROLE_KEY=     ← service_role 키 (서버 전용 — 절대 커밋·공유 금지)
```

`.env`는 gitignore 되어 있다. 키 이름 정본: [`.env.example`](../.env.example).

완료 후 `npm run dev` 재시작 → 화면의 "로컬 저장(dev)" 배지가 사라지면 Supabase 모드다.
