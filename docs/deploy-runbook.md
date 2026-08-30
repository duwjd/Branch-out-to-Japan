---
title: 배포 운영 가이드 (Deploy Runbook)
space: 설계·개발
status: 정본
phase: Phase 0
updated: 2026-08-24
owner:
tags: [배포, 런북, 절차]
---

# 배포 운영 가이드 (Deploy Runbook)

> **무엇**: YOAKE를 실제로 배포·업데이트·복구하는 **손에 잡히는 절차서**.
> **관계**: 설계·근거·한도는 [[11-deploy-spec]](정본), Supabase 셋업 상세는 [setup-supabase.md](setup-supabase.md), 이 문서는 "그래서 뭘 클릭하나"를 다룬다.
> **호스팅**: Vercel Hobby(앱) + Supabase Free(DB·파일). 결정 [[decisions/2026-07-24-호스팅-배포-결정]].
> **최초 배포 성공**: 2026-07-24.

## 0. 상황별 바로가기

| 지금 상황 | 어디로 |
|---|---|
| **지금 보는 배포본이 어느 환경인지** 모르겠다 | §9 환경 매트릭스 |
| 처음부터 새로 배포한다(다른 계정·새 프로젝트) | §1 첫 배포 |
| 코드/문서를 고쳐서 **운영에 반영**하고 싶다 | §2 업데이트 |
| 방금 배포가 잘못됐다, **되돌리고** 싶다 | §3 롤백 |
| 사이트가 안 뜬다 / **Supabase가 정지**됐다 | §4 리셋·정지 복구 |
| **이메일 가입/로그인이 안 된다** | §8 인증 안 될 때 |
| API 키·환경변수를 **바꿔야** 한다 | §5 환경변수 변경 |
| 테이블·컬럼 등 **DB 구조를 바꿨다** | §6 스키마 변경 |
| 주기적으로 뭘 확인해야 하나 | §7 정기 점검 |

증상별 장애 대응표는 [[11-deploy-spec]] §7에도 있다(이 문서 §4와 상호 보완).

---

## 1. 첫 배포 튜토리얼

> 이미 배포돼 있으면 이 섹션은 건너뛴다. 계정을 새로 만들거나 다른 사람이 처음 세팅할 때 본다.

큰 흐름: **① Supabase 만들기 → ② Vercel에 올리기 → ③ 확인**. 각 단계에서 얻는 값 몇 개를 마지막에 Vercel에 입력하면 끝. 30~40분.

**미리 준비**: GitHub 계정, Anthropic API 키, OpenAI API 키(각 콘솔에서 발급해 메모장에 복사).

### 1-A. Supabase (약 15분)

1. **프로젝트 생성** — https://supabase.com → GitHub 로그인 → **New project**
   - Name 자유(예: `japan-growth-studio`) · **Database Password는 메모장에 보관** · Region `Northeast Asia (Seoul)` → Create(1~2분 대기)
2. **스키마 실행** — 좌측 **SQL Editor** → New query → 저장소 `supabase/schema.sql` 전체 복사 → 붙여넣기 → **Run** → "Success" → **Table Editor**에 테이블 12개 확인(`asset_blocks` 포함 — 상세페이지 기능이 쓴다)
3. **Storage 버킷 생성** ⭐ — 좌측 **Storage** → New bucket → 이름 **`files`**(정확히 이 이름 — 코드 고정값) · **Public 체크 해제**(private) → Create
4. **연결 값 복사** — **Settings → API**에서:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **`service_role`** 키 → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 비밀 키 — Vercel에만 입력, 코드·채팅에 붙여넣지 말 것)
   - (`anon` 키는 코드가 안 쓰므로 복사 불필요)

### 1-B. Vercel (약 15분)

1. **가입·리포 가져오기** — https://vercel.com → **Continue with GitHub** → **Add New… → Project** → `duwjd/Branch-out-to-Japan` 옆 **Import**
   - 안 보이면 **Adjust GitHub App Permissions**로 duwjd 조직 접근 허용
2. **환경변수 입력**(배포 전에!) — Framework Preset이 `Next.js` 자동 감지된 상태 그대로, **Environment Variables** 섹션에 아래 6개 추가:

   | Key | Value | 출처 |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | Supabase |
   | `ANTHROPIC_API_KEY` | Anthropic 키 | 미리 준비 |
   | `OPENAI_API_KEY` | OpenAI 키 | 미리 준비 |
   | `AUTH_SECRET` | 아래 명령 출력값 | 터미널 |
   | `AUTH_MAIL_MODE` | `devlink` | 그대로 |

   - `AUTH_SECRET` 생성: 터미널에서 `openssl rand -base64 32` → 출력 문자열 통째 복사. **한 번 정하면 바꾸지 않는다**(바꾸면 모든 로그인 세션이 풀림).
   - ⚠️ `LLM_MODE`·`IMAGE_MODE`는 **넣지 않는다**(가짜 응답 강제 스위치). (선택) 이미지 비용 절감은 `OPENAI_IMAGE_QUALITY=low`.
3. **Deploy** 클릭 → 2~4분 빌드 → 배포 URL 생성
4. **Fluid Compute 확인** — Settings → Functions → **Fluid Compute = Enabled** 확인(꺼져 있으면 켠다). 이게 있어야 진단 파이프라인(2~3분)이 함수 300초 안에서 완주한다.

### 1-C. 스모크 테스트 (약 10분)

1. `https://<배포URL>/api/report` 열기 → **`{"storeKind":"supabase","llmMode":"real"}`** 확인 (가장 중요한 관문)
   - `"file"`이면 Supabase env 오타 · `"mock"`이면 `ANTHROPIC_API_KEY` 문제
2. 가입(이메일/비번) → 완료 화면의 **(dev) 인증 링크** 클릭 → 로그인
3. 브랜드 등록 → 진단 생성(텍스트 1회) → ~3분 내 발행 확인
4. 썸네일 생성 → 결과 이미지 표시 확인
5. **상세페이지** — `https://<배포URL>/api/studio/detail` 에서 `"ready": true` 확인 → 화면(`/app/studio/detail`)에 붉은 배너가 없으면 생성 1회 → 2~3분 내 결합본·분할본 표시. 일본어가 □로 보이면 폰트 문제([[11-deploy-spec]] §3-1)
6. Supabase **Table Editor**·**Storage**에 데이터·파일 실재 확인

전체 체크리스트 정본: [[11-deploy-spec]] §6.

---

## 2. 배포 버전 업데이트 (일상 배포)

### 핵심 원리 — 브랜치가 곧 환경
Vercel이 GitHub와 연결돼 있어 커밋이 들어오는 순간 자동 빌드·배포된다. 별도의 "배포 버튼"은 없다.

| 브랜치 | 환경 | 결과 |
|---|---|---|
| `stg` | **stg** (QA) | Preview 배포 — ⚠️ **운영 Supabase 를 그대로 쓴다**(§9) |
| `main` | **prd** (실사용자) | Production 배포 |

즉 **운영 배포 = `stg` 에서 확인한 것을 `main` 에 머지**다. `dev` 는 배포되지 않는다(각자 로컬).

### 표준 흐름 (권장 — 협업 규칙 준수)
`main`·`stg` 는 보호 브랜치이므로 직접 push하지 않고 PR로 병합한다([CONTRIBUTING.md](../CONTRIBUTING.md) 브랜치 전략).

```bash
# 1) 최신 dev에서 작업 브랜치 분기
git fetch origin
git checkout -b feat/무엇을-바꾸는지 origin/dev

# 2) 코드 수정 → 로컬 검증(반드시)
npm run typecheck && npm test && npm run build

# 3) 커밋·푸시
git add -A
git commit -m "feat: ..."   # Conventional Commits
git push -u origin feat/무엇을-바꾸는지

# 4) GitHub에서 PR 생성 (base = dev) → 리뷰 1인 → squash 머지
# 5) 승격: dev → stg PR (merge commit) → stg 에서 QA
# 6) 승격: stg → main PR (merge commit) → 운영 배포
```

- **`main` 에 머지되면 자동으로 프로덕션 배포** 시작 → Vercel **Deployments** 탭에서 확인.
- 배포 후에는 §1-C 스모크 중 최소 1번(`/api/report` 응답)만이라도 확인한다.
- **승격 PR 은 squash 하지 않는다** — 승격된 브랜치가 원본과 다른 SHA 를 갖게 되어 다음 승격에서 유령 충돌이 난다.
- **`main` 에 뭔가 들어가면 즉시 `main` → `stg` → `dev` 역병합한다.**

### 프리뷰 배포 — 머지 전에 실물로 테스트
`main` 이 아닌 브랜치를 push하면 Vercel이 **미리보기 URL(Preview Deployment)** 을 자동 생성한다(PR 화면에 Vercel 봇이 링크를 댓글로 남김).

> ⚠️ **프리뷰도 `stg` 도 같은 운영 Supabase·API 키를 쓴다**(별도 스테이징 DB 없음 — 도입 보류).
> 여기서 만든 데이터는 실 DB 에 그대로 쌓이므로 **파괴적 테스트는 하지 않는다.** 데이터를 험하게
> 다뤄야 하는 검증은 로컬(`.data/` 파일 스토어)에서 한다.
>
> 브랜치 축을 먼저 도입한 것은 **검증 단계를 만들기 위해서**다 — 코드가 `stg` 에서 한 번 돌아본 뒤
> 운영에 가는 것과 바로 가는 것은 다르다. 데이터 격리는 그 다음 단계다.

### 문서만 바꿨을 때
`docs/` 변경도 커밋되면 빌드가 돌지만 사용자 화면에는 영향 없다. 같은 PR 흐름으로 처리하면 된다(이 runbook도 그렇게 올라감).

---

## 3. 롤백 (되돌리기)

방금 배포가 잘못됐을 때 **코드를 되돌리지 않고 Vercel에서 즉시** 이전 버전으로 복구한다.

1. Vercel → 프로젝트 → **Deployments** 탭
2. 마지막으로 정상이던 배포 항목의 **⋯ 메뉴 → Instant Rollback**(또는 **Promote to Production**)
3. 수 초 내 이전 버전이 프로덕션으로 복귀

> 이건 **응급 복구**다. 근본 수정은 코드에서 고쳐 새 PR로 다시 배포한다(롤백 상태로 방치하지 말 것). git에서 되돌리려면 문제 커밋을 `git revert`한 PR을 올린다.

> ⚠️ **Instant Rollback 은 코드만 되돌린다 — DB 스키마는 안 돌아간다.** 그래서 §6의
> "가산 먼저(컬럼 추가는 스키마 → 코드), 파괴는 나중(컬럼 삭제는 코드 → 스키마)" 순서가 중요하다.
> 구버전 코드는 새 컬럼을 무시하면 그만이지만, 파괴 마이그레이션 뒤에 롤백하면 구버전 코드가
> 없는 컬럼에 쓰게 된다.

---

## 4. 리셋·정지 복구

### 4-A. Supabase가 정지됨 (가장 흔함 — 무료 7일 규칙)
무료 플랜은 **7일간 아무 요청도 없으면 프로젝트가 자동 일시정지**된다. 증상: 사이트에서 저장·조회 실패, `/api/report`가 `storeKind:"file"`로 뜨거나 500 에러.

**복구(데이터 보존됨 — 삭제 아님)**:
1. https://supabase.com → 해당 프로젝트 → "Project is paused" 화면의 **Restore project**(또는 Resume)
2. 수 분 내 복구. 테이블·Storage 파일·환경변수 값 모두 그대로.
3. Vercel 쪽은 손댈 것 없음(URL·키 동일).

**예방**: UT·시연 등 중요한 날 **직전(전날)에 한 번 접속**해 깨워둔다. §7 정기 점검 참고.

### 4-B. Storage 버킷이 사라짐 / 이미지가 안 뜸
버킷을 실수로 지웠거나 새 Supabase 프로젝트로 옮겼을 때. 증상: 업로드는 되는데 결과 이미지가 깨짐(`/api/files/[id]` 404).
- 복구: §1-A 3번대로 **private 버킷 `files`를 다시 생성**. 이름 오타 없이 정확히 `files`.
- 단, 이미 업로드됐던 파일 자체는 버킷 삭제 시 사라진다(재생성 후 새로 올린 것만 유효).

### 4-C. Supabase 프로젝트가 완전히 삭제됨 (장기 방치)
정지 상태가 아주 오래(수개월) 지속되면 무료 프로젝트가 삭제될 수 있다. 이때는 복구가 아니라 **재구축**:
- §1-A를 처음부터(새 프로젝트 → schema.sql → 버킷 `files`) 다시 하고, 새 **URL·service_role 키**를 §5 절차로 Vercel에 갱신.
- **이전 데이터(리포트·가입 유저 등)는 백업이 없으면 복구 불가.** 운영 데이터가 생긴 뒤에는 P1 백로그의 정기 백업을 검토([[11-deploy-spec]] §8).

### 4-D. Vercel 배포가 깨짐 / 사이트가 안 열림
- 최근 배포가 원인이면 → §3 롤백.
- 빌드 실패면 → Vercel **Deployments → 해당 배포 → 로그**에서 원인 확인(대개 타입 에러·환경변수 누락). 로컬에서 `npm run build`로 재현해 고친 뒤 재배포.
- 환경변수를 지웠거나 값이 틀어졌다면 → §5.

---

## 5. 환경변수 변경

API 키 교체, `AUTH_MAIL_MODE` 조정, 새 키 추가 등.

1. Vercel → 프로젝트 → **Settings → Environment Variables**
2. **스코프를 먼저 고른다** — `Production` = prd, `Preview` = stg. 환경 분리가 이 스코프 하나에 걸려 있다.
   운영 값을 바꿀 생각이 없다면 **Production 스코프는 아예 열지 않는 것**이 사고 예방에 좋다.
3. 값 수정/추가/삭제
4. ⚠️ **환경변수만 바꾸면 자동 반영되지 않는다** — 반드시 **Deployments → 최신 배포 ⋯ → Redeploy**로 재배포해야 새 값이 적용된다. **스코프마다 따로** 재배포해야 한다.

주의:
- **운영 `AUTH_SECRET` 은 로테이션하지 않는다** — 바꾸면 기존 로그인 세션이 전부 무효화된다(전원 재로그인). stg 는 운영과 **다른 값**을 쓴다(같으면 stg 세션 토큰이 운영에서도 통과한다).
- Supabase URL·키를 바꿨다면 재배포 후 `GET /api/report` 의 `supabaseRef` 로 **의도한 프로젝트를 보는지** 확인한다.
- 현재 Supabase 키는 Production·Preview가 **같은 값**이다(DB 분리 보류). 나중에 분리할 때 손댈 곳이 여기다.
- 새 키를 코드에서 쓰기 시작했다면 `.env.example`에 **키 이름만** 추가하고(값 없음), 정본은 [[09-dev-spec]] §1 표에 문서화한다. (이 개발 머신은 `.env*` 편집이 차단돼 있어 사용자가 수동 반영)
- 실메일(Resend)을 붙이면 `AUTH_MAIL_MODE=devlink`를 제거한다([[11-deploy-spec]] §8).

---

## 6. DB 스키마 변경 (테이블·컬럼 추가/수정)

이 셋업에는 **배포 파이프라인에 붙은 자동 마이그레이션이 없다.** 코드가 새 테이블·컬럼을 기대하도록 바뀌면 사람이 실행해야 한다 — 다만 **실행 자체는 명령 한 줄로 된다**. 대시보드 SQL Editor 경로도 그대로 유효하다.

**DB 는 운영 하나뿐이다**(stg DB 분리 보류 · §9). 즉 `npm run db:push` 는 **곧바로 운영 스키마를 바꾼다.** 실행 직전에 **대상 project ref 가 출력**되니 반드시 눈으로 확인할 것 — Session pooler URI 는 호스트에 ref 가 안 보여 `.env` 를 갈아끼우다 보면 어느 프로젝트를 때리는지 모른 채 실행하게 된다.

순서(중요):
1. 변경 SQL을 `supabase/schema.sql`에 반영(정본 유지)
2. 적용 — 둘 중 하나
   - **`npm run db:push`** — 파일 전체를 적용한다. 멱등이라 기존 테이블이 있어도 안전하고, 적용 후 기대 컬럼 존재까지 확인한다. 상태만 보려면 `npm run db:check`.
   - Supabase → **SQL Editor**에서 **변경분만** 실행(예: `alter table ... add column ...`).
3. 코드 변경을 §2 흐름으로 `stg` → `main` 까지 승격

- **가산 변경(테이블·컬럼 추가)은 스키마 먼저, 코드 나중.** 순서가 뒤바뀌면 새 컬럼을 못 찾아 런타임 에러가 난다.
- **파괴 변경(컬럼 삭제·타입 변경)은 코드 먼저, 스키마 나중.** 롤백이 코드만 되돌리기 때문이다(§3).
- DB 가 하나라 **파괴적 변경을 미리 시험해 볼 곳이 없다.** 사본을 뜨거나 스키마 분리를 먼저 검토한다.

### 6-B. 지금 실행해야 하는 마이그레이션 — ① 리포트 한국어 윤문(콜⑩)

`npm run db:push` 한 줄이면 끝난다. 대시보드로 하려면 `supabase/schema.sql` 의
**`2026-08-19 · ① 리포트 한국어 윤문(콜⑩) 기록`** 블록을 SQL Editor 에서 Run.

만드는 것: `reports` 2컬럼(`humanize_issues`·`humanize_skipped`).

**안 해도 리포트는 발행된다.** 저장 계층이 컬럼 없음을 감지하면 본문만 저장하고 진단 기록을 버리며,
서버 로그에 무엇을 실행해야 하는지 남긴다. LLM 4~5콜을 태운 리포트를 진단 기록 때문에 잃지 않도록
일부러 그렇게 했다. 다만 그 상태에서는 **윤문이 왜 반려됐는지 사후에 알 수 없다** — 루브릭을 고칠
근거가 사라지므로 UT 전에는 적용해 두는 게 좋다.

확인: `GET https://<도메인>/api/report` 의 `readiness.checks` 에서 `리포트 스키마` 가 `ok: true` 인지.

---

### 6-A. 지금 실행해야 하는 마이그레이션 — ② 상세페이지 만들기

이미 배포된 프로젝트라면 **이 SQL을 먼저 실행해야** 상세페이지 기능이 켜진다.

1. Supabase 대시보드 → **SQL Editor** → New query
2. 저장소의 `supabase/schema.sql` 을 열어 맨 아래 **`2026-08-10 · ② 마케팅 스튜디오 — 상세페이지 만들기`** 주석 블록부터 파일 끝까지 복사해 붙여넣고 Run
   - `alter table ... add column if not exists` · `create table if not exists` 로만 되어 있어 **여러 번 실행해도 안전**하다.
   - 만드는 것: `asset_blocks` 테이블 · `generated_assets` 4컬럼(`detail_input`·`block_total`·`block_done`·`slice_paths`) · `increment_block_done()` 함수
3. 확인 — Table Editor에 `asset_blocks` 가 보이면 완료
4. 코드 배포 후 `GET https://<도메인>/api/studio/detail` 의 `readiness.ready` 가 `true` 인지 확인

안 하고 배포하면 앱이 조용히 실패하지 않는다 — 상세페이지 화면에 **붉은 배너가 뜨고 생성 버튼이 잠긴다**(무엇을 실행해야 하는지 배너에 적혀 있다). 카피·이미지 비용을 태운 뒤 죽는 일이 없도록 제출 전에 막는 구조다.

---

## 7. 정기 점검 체크리스트

| 주기 | 확인 |
|---|---|
| 중요한 날 전날 | Supabase 프로젝트 접속(정지 예방, §4-A) · `/api/report`가 `supabase`/`real`인지 |
| 배포할 때마다 | Vercel Deployments 성공 · 스모크 최소 1항(§1-C 1번) |
| 월 1회 | Vercel **Usage**(대역폭·함수 시간) · Supabase **Usage**(DB·Storage 용량)가 무료 한도 내인지([[11-deploy-spec]] §2) |
| 유료 고객 발생 시 | Vercel **Pro 전환**(Hobby 비상업 한정 — [[11-deploy-spec]] §7) |

---

## 8. 이메일 가입/로그인이 안 될 때

배포본에서 회원가입·로그인이 안 되면 거의 항상 **환경변수 3개 중 하나**가 빠진 것이다(코드 문제 아님). 아래 순서로 확인한다.

**1) 저장(DB)이 붙었나 — 가장 흔한 원인**
- `https://<배포URL>/api/report` 열기 → `"storeKind":"supabase"`, `"misconfigured":false` 확인.
- `"file"` / `"misconfigured":true`이거나, **가입 시도가 500**이면 → Supabase env 미설정.
  - Vercel → 프로젝트 → **Logs**에 `Supabase 환경변수 미설정…` 메시지가 있으면 확정.
  - 해결: §5로 `NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY` 확인·입력 → **Redeploy**.

**1b) URL 값이 정확한가 — 로그에 `Invalid path specified in request URL`**
- `storeKind:"supabase"`인데 가입이 500이고 로그가 `supabase getUserByEmail 실패: Invalid path specified in request URL`이면 → `NEXT_PUBLIC_SUPABASE_URL` **형식 오류**.
- 값은 정확히 `https://<프로젝트ref>.supabase.co` 여야 한다(Supabase → **Settings → API → Project URL**). 흔한 실수:
  - 끝에 **슬래시**(`…supabase.co/`) · 붙여넣기 시 딸려온 **공백·개행**
  - **대시보드 URL**(`https://supabase.com/dashboard/project/…`)을 넣음 · 뒤에 `/rest/v1` 같은 **경로**를 붙임
- 해결: §5로 값을 `https://<ref>.supabase.co`(경로·끝슬래시 없이)로 교정 → **Redeploy**. (코드도 끝슬래시·공백을 자동 정리하도록 방어됨 — `lib/db/supabaseClient.ts`)

**2) 인증 링크가 화면에 안 뜨나 — 가입은 되는데 로그인이 "인증이 필요합니다"(403)**
- 실메일 발송은 아직 미구현이라, 가입 완료 화면에 뜨는 **인증 링크를 눌러야** 로그인이 된다.
- 링크가 안 보이면 → `AUTH_MAIL_MODE=devlink` 미설정. Vercel **Logs**에 `인증 링크 미노출(운영)…` error가 있으면 확정.
- 해결: §5로 `AUTH_MAIL_MODE`=`devlink` 입력 → **Redeploy** → 다시 가입 → 링크 클릭 → 로그인.

**3) users 테이블이 없나 — Supabase는 붙었는데 가입이 500**
- 옛 `schema.sql`을 부분 적용했을 때. Supabase → **Table Editor**에 `users`·`auth_tokens` 테이블이 있는지 확인.
- 없으면: §6 방식으로 최신 `supabase/schema.sql` **전체**를 SQL Editor에 다시 Run(멱등이라 재실행 안전).

> 이 셋(Supabase env 2종 + `AUTH_SECRET` + `AUTH_MAIL_MODE=devlink`)은 §1-B 첫 배포 때 한 번 넣으면 끝이다. `AUTH_SECRET`이 없으면 로그인은 되지만 세션 위조가 가능하니(로그에 error) 반드시 넣는다.

---

## 9. 환경 매트릭스

배포 환경은 **stg·prd 둘**이다. dev 환경은 배포하지 않고 각자 로컬에서 돈다.

| | dev (로컬) | stg | prd |
|---|---|---|---|
| 브랜치 | `dev` + 작업 브랜치 | `stg` | `main` |
| URL | `localhost:3000` | `branch-out-to-japan-git-stg-<scope>.vercel.app` | `branch-out-to-japan.vercel.app` |
| Vercel 스코프 | — | Preview | Production |
| **Supabase** | 없음 (`.data/` 파일 스토어) | ⚠️ **운영 프로젝트 (공유)** | 운영 프로젝트 |
| Storage 버킷 | `.data/files/` | ⚠️ `files` (운영과 공유) | `files` |
| 누가 쓰나 | 개발자 | QA·UT 참가자 | 실사용자 |

### 지금은 코드만 분리돼 있다 — 데이터는 공유다

브랜치·배포 축을 먼저 도입했고 **DB 분리는 보류 중**이다(별도 Supabase 프로젝트 미생성).
따라서 지금 이 구성이 주는 것과 주지 않는 것이 갈린다.

| | 얻은 것 | 아직 없는 것 |
|---|---|---|
| 코드 | `stg` 에서 한 번 돌려보고 운영에 보낸다 | — |
| 데이터 | 로컬은 완전 격리(`.data/`) | **stg 에서 만든 계정·리포트·이미지가 실 DB 에 쌓인다** |
| 스키마 | — | **마이그레이션을 미리 시험해 볼 곳이 없다**(§6) |
| 용량 | — | stg 사용분이 무료 한도(DB 500MB · Storage 1GB)를 같이 먹는다 |

**그래서 stg 에서는 읽기·정상 플로우 확인까지만 한다.** 대량 생성·삭제·스키마 실험은 로컬에서.
DB 를 분리하려면 Supabase 프로젝트를 하나 더 만들고 Vercel Preview 스코프에 그 값을 넣으면 된다
(§5) — 코드 변경은 필요 없다. 근거·기각안은 [[decisions/2026-08-22-환경분리-브랜치전략]].

**지금 보는 배포본이 어느 환경인지 확인하는 법** — 한 줄이면 된다:

```bash
curl -s <URL>/api/report | jq '{vercelEnv, supabaseRef, storeKind, llmMode}'
```

| 응답 | dev(로컬) | stg | prd |
|---|---|---|---|
| `vercelEnv` | `null` | `preview` | `production` |
| `supabaseRef` | `null` | 운영 ref (**현재 prd 와 같다**) | 운영 ref |
| `storeKind` | `file` | `supabase` | `supabase` |

`vercelEnv` 로 배포 환경을, `supabaseRef` 로 **어느 DB 를 보는지** 판별한다. DB 를 분리한 뒤에는
**stg 와 prd 의 `supabaseRef` 가 달라야 하고, 같으면 분리가 깨진 것**이다. ② 축은
`/api/studio/detail` 이 같은 필드를 답한다.

---

## 변경 이력
- 2026-07-24 신규 작성: 최초 배포 성공 직후. 첫 배포 튜토리얼(§1)·일상 업데이트 흐름(§2)·롤백(§3)·리셋/정지 복구(§4)·환경변수(§5)·스키마 변경(§6)·정기 점검(§7). 설계 정본 [[11-deploy-spec]]의 실전 동반 문서.
- 2026-07-24 **§8 "인증 안 될 때" 추가**: 배포본 이메일 가입/로그인 무동작 3원인(Supabase env·`AUTH_MAIL_MODE`·users 테이블) 진단 절차. 코드측 가드 강화([[11-deploy-spec]] §8 완료)와 짝.
- 2026-08-22 **브랜치 축 도입(dev/stg/main)**: §2 "배포 = main 머지" → 브랜치가 곧 환경(`stg`→Preview, `main`→Production) · §3에 "롤백은 코드만 되돌린다, DB 스키마는 안 돌아간다" · §5 환경변수는 스코프별 · §6에 `db:push` 대상 ref 확인 · **§9 환경 매트릭스 신설**. **DB 분리는 보류** — `stg` 도 운영 Supabase 를 쓰므로 §2·§9의 경고를 그대로 유지한다. 근거 [[decisions/2026-08-22-환경분리-브랜치전략]].
- 2026-08-11 **§6-A 신설**: ② 상세페이지 만들기 마이그레이션 절차(SQL Editor에서 schema.sql 델타 블록 실행 → readiness 확인). 미적용 시 앱이 붉은 배너로 막고 생성 버튼을 잠근다.
