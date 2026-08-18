# 11 · 배포 스펙 (Vercel Hobby + Supabase Free)

> **목적**: UT(8/1~3) 전까지 실사용자가 접속 가능한 무료 배포를 완성한다(08 §8-D1 "UT까지 배포 필요").
> **원칙**: 간편 + 무료. 결정 근거는 [[decisions/2026-07-24-호스팅-배포-결정]], 저장 설계 정본은 [[08-data-flow]] §6.
> **실전 절차서(클릭 단위 튜토리얼·업데이트·롤백·정지 복구)**: [deploy-runbook.md](deploy-runbook.md). 이 문서는 "왜·무엇을", runbook은 "어떻게 클릭".
> 무료 티어 한도 수치는 **2026-07-24 확인** 기준 — 배포 트러블 시 공식 문서로 재확인.

## 1. 아키텍처 개요

```
사용자 브라우저
   │ HTTPS
   ▼
Vercel Hobby ─ Next.js 16 (App Router)
   ├─ 페이지·API 라우트 (서버리스 함수, Fluid Compute)
   ├─ after() 백그라운드 잡: 진단 파이프라인(LLM 4~5콜) · 썸네일 생성
   │      ├─ Anthropic API (claude-sonnet-5 — 콜⓪~⑥)
   │      └─ OpenAI API (gpt-image — 썸네일 이미지)
   ▼
Supabase Free
   ├─ Postgres: 스토어 11테이블 (supabase/schema.sql — diagnosis_requests·reports·users …)
   └─ Storage: private 버킷 `files` (업로드 원본·생성 이미지 — fileId만 DB 기록)
```

- **앱 호스팅 = Vercel Hobby**: main 브랜치 push → 자동 프로덕션 배포(GitHub 연동). Next.js 16 + `after()` 네이티브 지원.
- **저장 = Supabase Free**: 코드는 env 유무로 자동 선택(`lib/db/store.ts:getStore()` — env 없으면 로컬 `.data/` 폴백이라 로컬 dev는 무설정 그대로). 파일 저장도 동일 기준(`lib/files/storage.ts` — env 있으면 Storage 버킷 `files`, 없으면 `.data/files/`).
- 로컬 `.data/`는 서버리스에서 비영속·인스턴스 간 비공유 — **프로덕션은 반드시 Supabase env 3종을 설정**해야 한다(§4).

## 2. 무료 티어 한도 (확인일 2026-07-24)

| 항목 | Vercel Hobby | 비고 |
|---|---|---|
| 함수 실행시간 | **최대 300초** (Fluid Compute — 2025-04부터 신규 프로젝트 기본 on) | Fluid off면 60초 → 파이프라인 죽음. §5-B4에서 활성 확인 필수 |
| `after()` | 라우트 maxDuration 예산 안에서 응답 반환 후 계속 실행 | report·thumbnail 라우트에 `maxDuration = 300` 명시함 |
| 대역폭 | 100GB/월 (초과 시 과금 없이 일시정지) | UT 수십 명 규모엔 여유 |
| 상업적 사용 | **비상업·개인 용도 한정** | 무수익 폐쇄 UT는 진행 가능. **유료 고객을 받는 시점 = Pro($20/월) 전환 트리거**(§7) |
| GitHub org 리포 | private org 리포는 Hobby 연동 불가 | `duwjd/Branch-out-to-Japan`은 **public이라 가능**. private 전환 시 §7 참조 |

| 항목 | Supabase Free | 비고 |
|---|---|---|
| DB | 500MB | 리포트 JSON 수백 건 규모엔 여유 |
| Storage | 1GB · 파일당 50MB | 앱 업로드 제한 10MB(HOME-02)와 호환. **상세페이지가 최대 소비처** — 아래 표 참조 |
| Egress | 5GB/월 | 이미지 서빙이 `/api/files/[id]` 경유(함수 대역폭도 소모) — UT 규모 OK |
| **자동 pause** | **7일 무활동 시 프로젝트 일시정지** | 데이터 보존되나 수동 restore 필요. **UT 직전(7/30~31) 접속 확인**(§6) |

## 3. 실행 모델 — `after()` + maxDuration 300 (큐 미도입)

- 진단 파이프라인(콜⓪ 비전 + ①②③ 병렬 + ④) ≈ 2~3분, 썸네일(카피 1콜 + 이미지 1콜) ≈ 1~2분, **상세페이지(카피 1콜 + 배경컷 최대 4콜 동시성 4 + satori 15블록 + sharp 결합·분할) ≈ 130~155초**(실측 2026-08-11), 슬라이드 동기 ~20초 — **전부 300초 예산 안**. 08 §6.2의 큐 fallback("지연 길어지면 도입")은 발동 조건 미충족 → 실행 모델 무변경, 프런트 폴링 구조 그대로.
- `export const maxDuration = 300` 명시: `app/api/report/route.ts` · `app/api/studio/thumbnail/route.ts` · `app/api/studio/detail/route.ts` · `app/api/studio/detail/[id]/blocks/[blockId]/route.ts`. 슬라이드는 기존 60 유지.
- **`app/api/studio/detail/plan/route.ts` = 60** (2026-08-11 추가). 콜⑧ inputTranslate 가 붙으면서 이 라우트가 LLM을 부르게 됐다 — 필드가 많은 최악 케이스 **실측 22초**다. 선언이 없으면 로컬은 제한이 없어 통과하고 **프로덕션에서만 타임아웃**난다. 300이 아니라 60인 이유: `after()` 배경 파이프라인이 아니라 사용자가 화면 앞에서 기다리는 요청 경로 콜이므로, 멈춘 호출이 함수를 5분 붙잡게 두지 않는다.
- **이 라우트는 게스트에게 LLM을 태우지 않는다.** 원래 결정적 계산뿐이라 인증이 없었고, 콜⑧이 붙으면서 미인증 LLM 엔드포인트가 될 뻔했다(저장소에 레이트리밋 없음 · 리포·배포 공개). 블록 구성(무료)은 게스트에게 그대로 주고 **변환 콜만 로그인 뒤로** 옮겨 «비회원 열람 + 실행 직전 게이트»(2026-07-23)를 유지한다. 게스트 경로 실측 0.03초·콜 0.
- **상세페이지는 순차 실행이 불가능하다.** 배경컷 1장이 40~90초라 4장을 순차로 돌리면 그것만으로 예산을 넘긴다 — `IMAGE_CONCURRENCY = 4` 와 `MAX_AI_BLOCKS = 4` 가 예산 안에 묶어두는 장치이므로 임의로 올리지 않는다.
- **스테일 잡 가드**(2026-07-24 구현): 함수가 300초에서 죽으면 비터미널 상태가 영구 고착 → 폴링 라우트가 `updatedAt` 10분 초과 + 비터미널이면 `failed`로 전환(`app/api/report/[id]/status/route.ts` · `app/api/studio/thumbnail/[id]/route.ts`). 사용자는 재시도 안내를 받는다.

### 3-1. ② 상세페이지 만들기 — 배포 전제 3가지

이 기능만 추가로 요구하는 것이 있다. 하나라도 빠지면 **생성 자체가 막힌다**(막는 주체는 `lib/server/detailReadiness.ts`).

| 전제 | 왜 필요한가 | 안 되면 |
|---|---|---|
| **DB 마이그레이션 적용** — `supabase/schema.sql` 의 `2026-08-10 · ② 마케팅 스튜디오` 블록 | `asset_blocks` 테이블 + `generated_assets` 4컬럼. 블록이 동시에 끝나므로 jsonb 한 컬럼으로는 lost update 가 난다 | 카피·이미지 콜을 다 태운 뒤 저장 단계에서 실패 → 그래서 **제출 전에 차단**한다 |
| **JP 폰트가 배포본에 실릴 것** — `next.config.ts` 의 `outputFileTracingIncludes` 에 `./app/fonts/jp/**` | satori 에 Buffer 로 직접 넘기는 fs 동적 경로라 트레이싱이 자동으로 못 잡는다 | satori 가 `fonts.googleapis.com` 을 런타임 fetch → 실패 시 전 글자가 두부(□) |
| **Storage 버킷 `files`** | 블록·분할본·결합본이 전부 여기로 간다 | 업로드 예외로 잡 실패 |

> `outputFileTracingIncludes` 의 `data/processed` 는 **글롭이 아니라 런타임에 읽는 5개 파일만** 나열한다. `data/processed/**` 로 두면 분석용 원자료(`detail-ocr.jsonl` 1.8MB · `product-catalog.jsonl` 2.1MB 등)까지 22개 함수 전부에 실린다. 런타임 데이터 파일을 새로 추가하면 여기에도 추가해야 한다.

**Storage 소비량(실측 2026-08-11 · 15블록·배경컷 4장 기준)**

| 산출물 | 저장 포맷 | 건당 |
|---|---|---|
| AI 배경컷 4장(카피만 재생성할 때 재사용) | JPEG q90 | 0.42MB |
| 블록 이미지 15개 | 텍스트 블록 PNG · 사진 블록 JPEG q95 | 1.23MB |
| 결합본 + 몰 업로드용 분할본 9장 | JPEG q88 | 1.44MB |
| **합계** | | **3.09MB → 1GB 에 약 330건** |

텍스트 블록만 PNG로 남기는 이유는 벡터 글자가 전부인 이미지라 JPEG 링잉이 글자 가장자리에 바로 보이기 때문이고, 애초에 작다(23~74KB). 전부 PNG로 두면 건당 12.4MB(1GB에 82건)라 UT 3일을 못 버틴다. 포맷 결정은 `lib/studio/detail/persist.ts` 한 곳에 있다.

## 4. 환경변수 정본 (Vercel 대시보드 → Settings → Environment Variables)

키 이름 정본은 [[09-dev-spec]] §1과 동일. **전부 Production+Preview에 설정**, `NEXT_PUBLIC_*` 외에는 서버 전용.

| 키 | 값 | 필수 | 미설정 시 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | **필수** | `.data/` 파일 폴백 — 서버리스에서 저장 유실 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public 키 | **필수** | 〃 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 (**서버 전용 — 절대 노출 금지**) | **필수** | 〃 |
| `ANTHROPIC_API_KEY` | Anthropic 콘솔 발급 | **필수** | LLM 목 모드(가짜 리포트) |
| `OPENAI_API_KEY` | OpenAI 콘솔 발급 | **필수** | 이미지 목 모드(샘플 이미지) |
| `AUTH_SECRET` | `openssl rand -base64 32` 산출값 | **필수** | 하드코딩 dev 시크릿 — **누구나 세션 위조 가능** |
| `AUTH_MAIL_MODE` | `devlink` | UT 기간 필수 | 운영에서 인증 링크 미전달 → **가입 전원 차단**(실메일 미구현 — `lib/server/mailer.ts`) |
| `OPENAI_IMAGE_QUALITY` | `medium`(기본) 또는 `low`(비용 절약) | 선택 | 코드 기본값 medium |

> `AUTH_MAIL_MODE=devlink`는 **실메일 미구현 상태의 폐쇄 UT용 임시 모드** — 가입 완료 화면에 인증 링크를 직접 노출한다. 실메일(Resend) 도입 시 제거(§8).

## 5. 배포 절차

**A. 코드 (완료 — 이 스펙과 같은 PR)**: Storage 전환·devlink 플래그·파일 트레이싱·maxDuration·engines·스테일 가드 → PR `deploy` → `main`.

**B. 인프라 (사용자 수동 — 계정·API 키 소유자)**
0. **이미 배포된 프로젝트에 상세페이지를 얹는 경우 — 마이그레이션 먼저.** Supabase → SQL Editor 에서 `supabase/schema.sql` 의 `2026-08-10 · ② 마케팅 스튜디오 — 상세페이지 만들기` 블록을 실행한다(전체 재실행 아님, 델타만 · 멱등이라 반복 실행 안전). 런북 §6의 "스키마 먼저, 코드 나중" 순서를 지킨다.
1. **Supabase**: [setup-supabase.md](setup-supabase.md) 1~2단계(프로젝트 생성 · schema.sql 실행) + **4단계(Storage private 버킷 `files` 생성)** → Settings→API에서 키 3종 확보.
2. **Vercel**: 가입(GitHub 계정) → Add New… → Project → `duwjd/Branch-out-to-Japan` Import → Framework Preset `Next.js`(자동 감지) 그대로 Deploy.
3. **환경변수**: §4 표 전체를 Vercel 대시보드에 입력 → Redeploy.
4. **Fluid Compute 확인**: Project → Settings → Functions → Fluid Compute **on** 확인(신규 프로젝트 기본 on — off면 켠다).

**C. 병합·배포**: PR 리뷰 → main 머지 → 자동 프로덕션 배포 → §6 스모크.

## 6. 배포 후 스모크 테스트 체크리스트

순서대로 — 앞 단계 실패 시 §7 대응표 확인.

1. `GET https://<도메인>/api/report` → `{"storeKind":"supabase","llmMode":"real"}` (파일 폴백·목 모드가 아님을 먼저 확정)
2. 가입(이메일/비번) → 완료 화면의 **(dev) 인증 링크** 클릭 → 인증 성공 → 로그인
3. 브랜드 온보딩(첫 브랜드 캡처) → 저장 확인
4. 진단 생성 — 텍스트 모드 1회 + 이미지 업로드 모드 1회 → 폴링 ~3분 내 `published` → 8블록 뷰 열람
5. 슬라이드 HTML 다운로드(`GET /api/report/[id]/slides`)
6. 썸네일 생성 → 결과 화면 Before/After 이미지 표시(`/api/files/[id]` 200)
6-1. **상세페이지** — `GET /api/studio/detail` 의 `readiness.ready === true` 확인(false면 `checks` 의 `fix` 문구 그대로 따라간다) → `/app/studio/detail` 진입 시 붉은 경고 배너가 **없어야** 한다 → 제품컷 1장 + 템플릿 선택 → 블록 구성 확인 화면에서 제외 블록 사유 노출 → 생성 → 2~3분 내 결합본 표시 + 분할본 다운로드. **일본어가 두부(□)로 나오면 폰트 트레이싱 실패**(§3-1)
7. Supabase 대시보드 — Table Editor에 행 실재(`asset_blocks` 포함), Storage `files` 버킷에 파일 실재
8. **UT 직전(7/30~31)**: 프로덕션 접속(→ pause 예방·해제) + Vercel Usage 대시보드 점검

## 7. 한도 초과 · 장애 대응

| 증상 | 원인 후보 | 대응 |
|---|---|---|
| 진단이 `processing` 고착 → 10분 후 `failed` | 함수 300초 초과(파이프라인 지연) 또는 Fluid off(60초) | Fluid on 확인(§5-B4) → 재발 시 로그에서 콜별 소요 확인, 큐 도입 검토(08 §6.2 대안) |
| `/api/report`가 `storeKind:"file"` 또는 `misconfigured:true` | Supabase env 3종 미설정·오타 | §4 재확인 후 Redeploy |
| **가입/로그인이 500** (프로덕션) | Supabase env 미설정 → 저장 팩토리가 명시적 throw(파일 폴백 차단, `lib/db/store.ts`) | Vercel **로그**에 "Supabase 환경변수 미설정…" 메시지 확인 → §4 설정 후 Redeploy |
| 가입 500 + 로그 `Invalid path specified in request URL` | `NEXT_PUBLIC_SUPABASE_URL` 형식 오류(끝슬래시·공백·개행·대시보드 URL·경로 포함) | 값을 `https://<ref>.supabase.co`로 교정(§4) → Redeploy. 코드는 끝슬래시·공백 자동 정리(`lib/db/supabaseClient.ts`) |
| 업로드·이미지 표시 실패 | Storage 버킷 `files` 미생성 / 이름 불일치 | setup-supabase.md 4단계 |
| **상세페이지 생성 버튼이 눌리지 않음 + 붉은 배너** | 프리플라이트가 막은 것 — 배너에 원인과 조치가 적혀 있다 | 배너의 "고치는 법" 그대로. 대부분 **마이그레이션 미적용**(§3-1) 또는 Supabase env 미설정 |
| 상세페이지 POST 가 **503** + `readiness` 응답 | 위와 같은 원인(폼을 우회해 직접 호출한 경우) | 응답 `readiness.checks` 의 `fix` 참조 |
| 상세페이지 **일본어가 전부 두부(□)** | `app/fonts/jp/*.otf` 가 배포본에 없음(트레이싱 누락 또는 미커밋) | §3-1 · `next.config.ts` 확인 후 Redeploy. 프리플라이트 `fonts` 항목이 먼저 잡아준다 |
| 상세페이지가 `blocks` 단계에서 고착 → 10분 후 `failed` | 배경컷 콜 지연으로 300초 초과 또는 Fluid off | Fluid on 확인(§5-B4). `MAX_AI_BLOCKS`·`IMAGE_CONCURRENCY`(각 4)를 올리지 않았는지 확인 |
| Supabase Storage 용량 경고 | 상세페이지가 건당 약 3MB 를 쓴다(§3-1) | 오래된 자산 정리(§8 백로그의 Storage 정리 잡) |
| 가입 완료 화면에 **인증 링크가 없음** → 로그인 403 | `AUTH_MAIL_MODE` 미설정(실메일 미구현이라 링크 억제 시 아무도 인증 불가) | Vercel **로그**에 "인증 링크 미노출(운영)…" error 확인 → §4에서 `AUTH_MAIL_MODE=devlink` 설정 후 Redeploy |
| Supabase "project paused" | 7일 무활동 | 대시보드에서 Restore(수 분) — UT 직전 접속으로 예방 |
| 대역폭·빌드 한도 경고 | Hobby 100GB 초과 등 | Vercel Usage 확인 — UT 규모에서 도달 시 원인(대용량 이미지 반복 서빙) 먼저 제거 |
| **유료 고객 발생** | Hobby 비상업 한정 위반 | **Pro 전환($20/월)** — 과금 전 팀 결정 |
| 리포 private 전환 필요 | Hobby는 private org 리포 연동 불가 | Pro 전환 또는 GitHub Actions + `vercel deploy --prebuilt` 우회 |

## 8. P1 백로그 (배포 후 개선)

- **실메일 발송**: Resend 무료(100통/일) + 커스텀 도메인 검증 → `AUTH_MAIL_MODE=devlink` 제거(`mailer.ts` 내부만 교체 — 연결 지점 단일화 유지)
- ~~**프로덕션 가드 강화**~~ **(2026-07-24 완료)**: Supabase env 누락 시 **파일 폴백 대신 명시적 throw**(`lib/db/store.ts`, 빌드 페이즈 제외) · `AUTH_MAIL_MODE` 억제 시 · `AUTH_SECRET` 미설정 시 운영 **error 로그** 승격(mailer·sessionToken) · `/api/report`에 `misconfigured` 플래그. (`AUTH_SECRET`은 throw 대신 로그 — verifySession no-throw 계약 유지)
- **파일 서빙 서명 URL 직행**: `/api/files/[id]` 함수 경유 대신 Storage signed URL — 함수 호출·대역폭 절감
- **커스텀 도메인** 연결(Vercel 무료 지원) — UT 이후
- 실 OAuth·결제 게이트 집행 등 기능 잔여는 [[10-implementation-status]] §5 정본 유지

## 변경 이력
- 2026-07-24 신규 작성: 호스팅 확정(Vercel Hobby + Supabase Free — [[decisions/2026-07-24-호스팅-배포-결정]])에 따른 배포 스펙 정본. P0 코드 6건(Storage 전환·devlink·트레이싱·maxDuration·engines·스테일 가드)과 같은 PR.
- 2026-07-24 **인증 배포 가드 강화**: 배포본 이메일 가입/로그인 무동작(원인=Supabase env·`AUTH_MAIL_MODE` 미설정) 대응. **[코드]** 저장 팩토리 프로덕션 명시적 throw(침묵 파일 폴백 차단) · mailer/sessionToken 운영 error 로그 승격 · `/api/report` `misconfigured` 플래그 · `supabase/schema.sql` 상단 주석 함정(users 없음 오도) 교정. **[문서]** §7 트러블슈팅 3행 갱신 · §8 가드 항목 완료 표시. 필수 env(§4)는 코드 변경 아님 — 운영자가 Vercel에 설정(런북 §1-B).
- 2026-07-24 **URL 형식 방어**(실장애 후속): 배포본 가입 500(로그 `Invalid path specified in request URL`) 원인 = `NEXT_PUBLIC_SUPABASE_URL` 끝슬래시/공백. **[코드]** `lib/db/supabaseClient.ts`가 URL 앞뒤 공백·끝슬래시 자동 제거 + 비표준 형식 경고. **[문서]** 런북 §8-1b · §7 트러블슈팅 1행 추가.
- 2026-08-11 **② 상세페이지 만들기 배포 대응**: §3 실행모델에 상세 파이프라인 실측(130~155초)·동시성 하드캡 근거 추가 · **§3-1 신설**(배포 전제 3가지 — 마이그레이션·JP 폰트 트레이싱·Storage 버킷, Storage 소비량 실측표). **[코드]** 제출 전 프리플라이트(`lib/server/detailReadiness.ts` — 마이그레이션·폰트·키·Storage 미비를 한국어 사유+조치와 함께 차단, 폼 배너 + POST 503) · 저장 포맷 분리(`lib/studio/detail/persist.ts` — 건당 12.4MB→3.09MB, 1GB 기준 82건→331건) · 트레이싱 정밀화(`data/processed/**` → 런타임 5개 파일, 함수당 약 4MB 감축). **[운영]** §5-B0 마이그레이션 선행 단계 · §6-1 스모크 · §7 트러블슈팅 5행.
