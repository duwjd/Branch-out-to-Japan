# 배포 운영 가이드 (Deploy Runbook)

> **무엇**: KGLOW를 실제로 배포·업데이트·복구하는 **손에 잡히는 절차서**.
> **관계**: 설계·근거·한도는 [[11-deploy-spec]](정본), Supabase 셋업 상세는 [setup-supabase.md](setup-supabase.md), 이 문서는 "그래서 뭘 클릭하나"를 다룬다.
> **호스팅**: Vercel Hobby(앱) + Supabase Free(DB·파일). 결정 [[decisions/2026-07-24-호스팅-배포-결정]].
> **최초 배포 성공**: 2026-07-24.

## 0. 상황별 바로가기

| 지금 상황 | 어디로 |
|---|---|
| 처음부터 새로 배포한다(다른 계정·새 프로젝트) | §1 첫 배포 |
| 코드/문서를 고쳐서 **운영에 반영**하고 싶다 | §2 업데이트 |
| 방금 배포가 잘못됐다, **되돌리고** 싶다 | §3 롤백 |
| 사이트가 안 뜬다 / **Supabase가 정지**됐다 | §4 리셋·정지 복구 |
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
2. **스키마 실행** — 좌측 **SQL Editor** → New query → 저장소 `supabase/schema.sql` 전체 복사 → 붙여넣기 → **Run** → "Success" → **Table Editor**에 테이블 11개 확인
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
5. Supabase **Table Editor**·**Storage**에 데이터·파일 실재 확인

전체 체크리스트 정본: [[11-deploy-spec]] §6.

---

## 2. 배포 버전 업데이트 (일상 배포)

### 핵심 원리 — main에 들어가면 자동 배포
Vercel이 GitHub와 연결돼 있어, **`main` 브랜치에 커밋이 들어오는 순간 자동으로 프로덕션 빌드·배포**된다. 별도의 "배포 버튼"은 없다. 즉 **배포 = main에 머지**다.

### 표준 흐름 (권장 — 협업 규칙 준수)
`main`은 보호 브랜치이므로 직접 push하지 않고 PR로 병합한다(CLAUDE.md 협업 규칙).

```bash
# 1) 최신 main에서 작업 브랜치 분기
git fetch origin
git checkout -b feat/무엇을-바꾸는지 origin/main

# 2) 코드 수정 → 로컬 검증(반드시)
npm run typecheck && npm test && npm run build

# 3) 커밋·푸시
git add -A
git commit -m "feat: ..."   # Conventional Commits
git push -u origin feat/무엇을-바꾸는지

# 4) GitHub에서 PR 생성 → 리뷰 1인 → main 머지
```

- **머지되면 자동으로 프로덕션 배포** 시작 → Vercel **Deployments** 탭에서 진행/성공 확인.
- 배포 후에는 §1-C 스모크 중 최소 1번(`/api/report` 응답)만이라도 확인한다.

### 프리뷰 배포 — 머지 전에 실물로 테스트
PR을 열거나 `main`이 아닌 브랜치를 push하면, Vercel이 **그 브랜치용 미리보기 URL(Preview Deployment)** 을 자동 생성한다(PR 화면에 Vercel 봇이 링크를 댓글로 남김). 프로덕션에 영향 없이 실제 배포본을 눌러볼 수 있으니, **위험한 변경은 프리뷰에서 먼저 확인 후 머지**한다.

> ⚠️ 프리뷰도 **같은 프로덕션 Supabase·API 키**를 쓴다(별도 스테이징 DB 없음). 프리뷰에서 만든 데이터가 실 DB에 쌓이므로 파괴적 테스트는 주의.

### 문서만 바꿨을 때
`docs/` 변경도 커밋되면 빌드가 돌지만 사용자 화면에는 영향 없다. 같은 PR 흐름으로 처리하면 된다(이 runbook도 그렇게 올라감).

---

## 3. 롤백 (되돌리기)

방금 배포가 잘못됐을 때 **코드를 되돌리지 않고 Vercel에서 즉시** 이전 버전으로 복구한다.

1. Vercel → 프로젝트 → **Deployments** 탭
2. 마지막으로 정상이던 배포 항목의 **⋯ 메뉴 → Instant Rollback**(또는 **Promote to Production**)
3. 수 초 내 이전 버전이 프로덕션으로 복귀

> 이건 **응급 복구**다. 근본 수정은 코드에서 고쳐 새 PR로 다시 배포한다(롤백 상태로 방치하지 말 것). git에서 되돌리려면 문제 커밋을 `git revert`한 PR을 올린다.

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
2. 값 수정/추가/삭제
3. ⚠️ **환경변수만 바꾸면 자동 반영되지 않는다** — 반드시 **Deployments → 최신 배포 ⋯ → Redeploy**로 재배포해야 새 값이 적용된다.

주의:
- `AUTH_SECRET`을 바꾸면 **기존 로그인 세션이 전부 무효화**된다(재로그인 필요). 웬만하면 유지.
- 새 키를 코드에서 쓰기 시작했다면 `.env.example`에 **키 이름만** 추가하고(값 없음), 정본은 [[09-dev-spec]] §1 표에 문서화한다. (이 개발 머신은 `.env*` 편집이 차단돼 있어 사용자가 수동 반영)
- 실메일(Resend)을 붙이면 `AUTH_MAIL_MODE=devlink`를 제거한다([[11-deploy-spec]] §8).

---

## 6. DB 스키마 변경 (테이블·컬럼 추가/수정)

이 셋업에는 **자동 마이그레이션이 없다.** 코드가 새 테이블·컬럼을 기대하도록 바뀌면, 사람이 Supabase에 SQL을 직접 실행해야 한다.

순서(중요 — 스키마 먼저, 코드 나중):
1. 변경 SQL을 `supabase/schema.sql`에 반영(정본 유지)
2. Supabase → **SQL Editor**에서 **변경분만** 실행(예: `alter table ... add column ...`). 기존 테이블이 있으므로 전체 재실행이 아니라 델타만.
3. 그 다음 코드 변경을 §2 흐름으로 배포.
- 순서가 뒤바뀌면(코드가 먼저 배포) 새 컬럼을 못 찾아 런타임 에러가 난다.
- 파괴적 변경(컬럼 삭제·타입 변경)은 프리뷰/사본에서 먼저 검증.

---

## 7. 정기 점검 체크리스트

| 주기 | 확인 |
|---|---|
| 중요한 날 전날 | Supabase 프로젝트 접속(정지 예방, §4-A) · `/api/report`가 `supabase`/`real`인지 |
| 배포할 때마다 | Vercel Deployments 성공 · 스모크 최소 1항(§1-C 1번) |
| 월 1회 | Vercel **Usage**(대역폭·함수 시간) · Supabase **Usage**(DB·Storage 용량)가 무료 한도 내인지([[11-deploy-spec]] §2) |
| 유료 고객 발생 시 | Vercel **Pro 전환**(Hobby 비상업 한정 — [[11-deploy-spec]] §7) |

---

## 변경 이력
- 2026-07-24 신규 작성: 최초 배포 성공 직후. 첫 배포 튜토리얼(§1)·일상 업데이트 흐름(§2)·롤백(§3)·리셋/정지 복구(§4)·환경변수(§5)·스키마 변경(§6)·정기 점검(§7). 설계 정본 [[11-deploy-spec]]의 실전 동반 문서.
