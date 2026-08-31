---
title: 11 · 배포 스펙 (Vercel Hobby + Supabase Free)
space: 설계·개발
status: 정본
phase: Phase 0
updated: 2026-08-31
owner:
tags: [배포, 인프라]
---

# 11 · 배포 스펙 (Vercel Hobby + Supabase Free)

> **상태(Phase 0 종료 · 2026-08-31)**: ✅ 배포 완료 — `https://branch-out-to-japan.vercel.app` 에서 3축 전부가 작동하며, **AI 에이전트 UT 를 이 배포본에서 실행**했다(생성 60/60 · [[research/ut-agent/results/UT-리포트]]).
> **목적**: 실사용자가 접속 가능한 무료 배포를 완성한다(08 §8-D1 "UT까지 배포 필요").
> **범위**: [[04-roadmap]] **Phase 0 의 배포 스택**이다 — 비상업 Hobby 한정이라 유료 고객이 생기면 Pro 전환이 트리거된다(§감수).
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
   ├─ after() 백그라운드 잡: 진단 파이프라인(LLM 5~6콜 + 윤문 콜⑩) · 썸네일·상세 생성
   │      ├─ Anthropic API (① 리포트 콜 = claude-opus-5 / ② 스튜디오 콜 = claude-sonnet-5 — 2026-08-19 상향)
   │      └─ OpenAI API (gpt-image — 썸네일 이미지)
   ▼
Supabase Free
   ├─ Postgres: 스토어 11테이블 (supabase/schema.sql — diagnosis_requests·reports·users …)
   └─ Storage: private 버킷 `files` (업로드 원본·생성 이미지 — fileId만 DB 기록)
```

- **앱 호스팅 = Vercel Hobby**: main 브랜치 push → 자동 프로덕션 배포(GitHub 연동). Next.js 16 + `after()` 네이티브 지원.
- **저장 = Supabase Free**: 코드는 env 유무로 자동 선택(`lib/db/store.ts:getStore()` — env 없으면 로컬 `.data/` 폴백이라 로컬 dev는 무설정 그대로). 파일 저장도 동일 기준(`lib/files/storage.ts` — env 있으면 Storage 버킷 `files`, 없으면 `.data/files/`).
- 로컬 `.data/`는 서버리스에서 비영속·인스턴스 간 비공유 — **프로덕션은 반드시 Supabase env 3종을 설정**해야 한다(§4).

### 1-1. 함수 리전 = `icn1`(서울) — `vercel.json` (2026-08-22)

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "regions": ["icn1"] }
```

**왜 명시하나**: Vercel 신규 프로젝트의 기본 함수 리전은 `iad1`(워싱턴DC)이다. 반면 Supabase는
`Northeast Asia (Seoul)`로 만든다(런북 §1-A). `vercel.json`이 없던 동안 배포본은 **함수는 미국 동부,
DB는 서울**이었고, 응답 헤더에 그대로 찍혔다 — `x-vercel-id: icn1::iad1::…`(엣지는 서울, 실행은 iad1).

실측한 대가:

| 구간 | `iad1` | `icn1` |
|---|---|---|
| 브라우저(한국) → 함수 왕복 | ~250ms (`/login` TTFB 8회 240~256ms — 편차가 거의 없어 콜드스타트가 아니라 순수 거리) | ~10~30ms |
| 함수 → Supabase 쿼리 1회 | ~200ms | ~5~15ms |

`/app` 이하는 세션 → 브랜드 → 본문 데이터가 **의존 관계 때문에 직렬로** 3회 왕복하므로
왕복 1회 비용이 그대로 3배로 곱해진다. UT 실측 중앙값이 `/app/studio/thumbnail` 3,136ms ·
`/app/report/[id]` 2,794ms인데 DB를 안 보는 `/login`은 456ms였던 이유가 이것이다.

주의:
- **Hobby는 리전 1개만 허용**한다. 배열에 2개 이상 적으면 빌드 **전에** 배포가 실패한다.
- 대시보드의 Function Region 설정보다 `vercel.json`이 우선한다 — 저장소에 남는 쪽으로 관리한다.
- LLM 호출(`/api/report` · `/api/studio/*`)은 미국 API를 향하므로 +200ms가 붙지만, 이 라우트들은
  원래 22초~3분짜리다(§3). 같은 라우트가 Supabase도 두드리므로 순증은 이득이다.

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

- 진단 파이프라인(콜⓪ 비전 + ①②③ 병렬 + ④) ≈ 2~3분, 썸네일(카피 1콜 + 이미지 1콜) ≈ 1~2분, **상세페이지(카피 1콜 + 윤문 1콜 + 배경컷 최대 6콜 동시성 6 = 1웨이브 + satori 15블록 + sharp 결합·분할) ≈ 150~185초**(추정 — 실측 2026-08-11 의 130~155초에 콜⑨과 이미지 6장 반영. 장수가 아니라 **웨이브 수**가 소요를 정하므로 4→6장은 소요를 늘리지 않는다), 슬라이드 동기 ~20초 — **전부 300초 예산 안**. 08 §6.2의 큐 fallback("지연 길어지면 도입")은 발동 조건 미충족 → 실행 모델 무변경, 프런트 폴링 구조 그대로.
- ⚠ **300초는 플랫폼 상한이라 올릴 수 없다**(Hobby + Fluid Compute). 파이프라인이 예산에 닿으면 늘리는 게 아니라 **예산 안에서 줄인다** — 상세페이지는 `lib/studio/detail/budget.ts` 가 이미지 웨이브 직전에 남은 시간을 재고 우선순위 낮은 컷부터 강등한다(02 §2-12). 300초를 넘기면 함수가 통째로 죽어 **모든 블록**이 스테일 가드로 실패한다.
- `export const maxDuration = 300` 명시: `app/api/report/route.ts` · `app/api/studio/thumbnail/route.ts` · `app/api/studio/detail/route.ts` · `app/api/studio/detail/[id]/blocks/[blockId]/route.ts`. 슬라이드는 기존 60 유지.
- **`app/api/studio/detail/plan/route.ts` = 60** (2026-08-11 추가). 콜⑧ inputTranslate 가 붙으면서 이 라우트가 LLM을 부르게 됐다 — 필드가 많은 최악 케이스 **실측 22초**다. 선언이 없으면 로컬은 제한이 없어 통과하고 **프로덕션에서만 타임아웃**난다. 300이 아니라 60인 이유: `after()` 배경 파이프라인이 아니라 사용자가 화면 앞에서 기다리는 요청 경로 콜이므로, 멈춘 호출이 함수를 5분 붙잡게 두지 않는다.
- **이 라우트는 게스트에게 LLM을 태우지 않는다.** 원래 결정적 계산뿐이라 인증이 없었고, 콜⑧이 붙으면서 미인증 LLM 엔드포인트가 될 뻔했다(저장소에 레이트리밋 없음 · 리포·배포 공개). 블록 구성(무료)은 게스트에게 그대로 주고 **변환 콜만 로그인 뒤로** 옮겨 «비회원 열람 + 실행 직전 게이트»(2026-07-23)를 유지한다. 게스트 경로 실측 0.03초·콜 0.
- **상세페이지는 순차 실행이 불가능하다.** 배경컷 1장이 40~90초라 4장을 순차로 돌리면 그것만으로 예산을 넘긴다 — `IMAGE_CONCURRENCY = 4` 와 `MAX_AI_BLOCKS = 4` 가 예산 안에 묶어두는 장치이므로 임의로 올리지 않는다.
- **① 리포트 잡 예산 가드**(2026-08-21 구현 — `lib/engine/reportBudget.ts`): ② 상세 잡의 `budget.ts` 대응물이다. `REPORT_BUDGET_MS = 270_000`(=`JOB_BUDGET_MS`와 같은 규칙)으로 마감을 잡고, LLM 단계마다 남은 시간 기반 벽시계 상한을 건다. **왜 필요한가**: 리포트 잡은 저장이 맨 마지막이라 함수가 죽으면 5콜과 실비를 다 쓰고도 남는 게 없다. 또 파이프라인의 기존 폴백(콜① 0점·콜③ 일반형·콜④ 축소·콜⑩ 원문 유지)은 **콜이 실패로 끝나야** 발동하는데, SDK 기본 타임아웃(10분)이 함수 상한보다 길어 폴백에 닿기 전에 함수가 죽었다. 시간이 모자라면 윤문(콜⑩)만 건너뛰고 **발행은 반드시 한다**(`reports.humanize_skipped`에 사유 기록). 근거 실측: `docs/research/ut-agent/results/P0-리포트-파이프라인-예산초과.md`
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

키 이름 정본은 [[09-dev-spec]] §1과 동일. `NEXT_PUBLIC_*` 외에는 서버 전용.

**스코프가 곧 환경이다**(2026-08-22 브랜치 축 도입). Vercel 프로젝트는 하나이고
`Production` = **prd**(`main` 브랜치), `Preview` = **stg**(`stg` 브랜치 및 그 외 브랜치).
dev 환경은 배포하지 않고 각자 로컬에서 돈다(`.data/` 파일 스토어).

> ⚠️ **DB 분리는 보류 중이다.** 아래 표에서 Supabase 2종은 현재 **두 스코프가 같은 값**이며,
> 즉 stg 에서 만든 데이터가 실 DB 에 쌓인다. 분리하려면 Supabase 프로젝트를 하나 더 만들어
> Preview 스코프에만 그 값을 넣으면 된다 — **코드 변경은 필요 없다**(값 3개만 갈아끼우는 일).
> `AUTH_SECRET` 분리는 DB 공유 상태에서도 지금 바로 유효하다.

| 키 | Production (prd) | Preview (stg) | 미설정 시 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 운영 프로젝트 URL | **현재 동일**(분리 시 stg URL) | `.data/` 파일 폴백 — 서버리스에서 저장 유실 |
| `SUPABASE_SERVICE_ROLE_KEY` | 운영 service_role (**서버 전용 — 절대 노출 금지**) | **현재 동일**(분리 시 stg 키) | 〃 |
| `ANTHROPIC_API_KEY` | 필수 | 동일 키 사용 가능 | LLM 목 모드(가짜 리포트) |
| `OPENAI_API_KEY` | 필수 | 동일 키 사용 가능 | 이미지 목 모드(샘플 이미지) |
| `AUTH_SECRET` | 필수 — **한 번 정하면 바꾸지 않는다**(바꾸면 전원 로그아웃) | **stg 전용 신규 값** | 하드코딩 dev 시크릿 — **누구나 세션 위조 가능** |
| `AUTH_MAIL_MODE` | `devlink` | `devlink` | 운영에서 인증 링크 미전달 → **가입 전원 차단**(실메일 미구현 — `lib/server/mailer.ts`) |
| `OPENAI_IMAGE_QUALITY` | `medium`(기본) 또는 `low`(비용 절약) | 선택 | 코드 기본값 medium |

> **`AUTH_SECRET`을 환경마다 다르게 두는 이유**: 같은 시크릿이면 stg 에서 발급된 세션 토큰이
> 운영에서도 검증을 통과한다. 단 **운영 값은 로테이션하지 않는다.**
>
> **`NEXT_PUBLIC_SUPABASE_ANON_KEY`는 넣지 않는다.** 예전 표에 "필수"로 적혀 있었으나
> 코드가 이 키를 읽는 곳이 하나도 없다 — `lib/db/supabaseClient.ts`의 `hasSupabaseEnv()`는
> URL + service_role 2종만 본다(2026-08-22 확인·정정).
>
> 어느 DB 를 보는지는 `GET /api/report` 의 `supabaseRef` 로 확인한다. **DB 분리 후에는**
> stg 와 prd 가 서로 다른 ref 를 답해야 하고, 같으면 분리가 안 된 것이다.
> (지금은 공유 중이라 같게 나오는 것이 정상이다.)

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
| 진단이 `processing` 고착 → 10분 후 `failed` | 함수 300초 초과(파이프라인 지연) 또는 Fluid off(60초) | Fluid on 확인(§5-B4). **2026-08-21부터 예산 가드가 이 고착을 막는다**(`lib/engine/reportBudget.ts`) — 그래도 고착이면 가드보다 앞단이 문제다. 로그 `단계`·`잡 완료 — 발행`의 `elapsedMs`로 콜별 소요를 보고, `LLM 콜 예산 소진 — 시도 중단`이 찍혔다면 어느 콜이 상한을 먹었는지 확인한다. 상한 자체가 실측과 어긋나면 `STAGE_CEILING_MS`를 갱신한다(큐 도입은 08 §6.2 대안) |
| `/api/report`가 `storeKind:"file"` 또는 `misconfigured:true` | Supabase env 3종 미설정·오타 | §4 재확인 후 Redeploy |
| **가입/로그인이 500** (프로덕션) | Supabase env 미설정 → 저장 팩토리가 명시적 throw(파일 폴백 차단, `lib/db/store.ts`) | Vercel **로그**에 "Supabase 환경변수 미설정…" 메시지 확인 → §4 설정 후 Redeploy |
| 가입 500 + 로그 `Invalid path specified in request URL` | `NEXT_PUBLIC_SUPABASE_URL` 형식 오류(끝슬래시·공백·개행·대시보드 URL·경로 포함) | 값을 `https://<ref>.supabase.co`로 교정(§4) → Redeploy. 코드는 끝슬래시·공백 자동 정리(`lib/db/supabaseClient.ts`) |
| 업로드·이미지 표시 실패 | Storage 버킷 `files` 미생성 / 이름 불일치 | setup-supabase.md 4단계 |
| **상세페이지 생성 버튼이 눌리지 않음 + 붉은 배너** | 프리플라이트가 막은 것 — 배너에 원인과 조치가 적혀 있다 | 배너의 "고치는 법" 그대로. 대부분 **마이그레이션 미적용**(§3-1) 또는 Supabase env 미설정 |
| 상세페이지 POST 가 **503** + `readiness` 응답 | 위와 같은 원인(폼을 우회해 직접 호출한 경우) | 응답 `readiness.checks` 의 `fix` 참조 |
| 상세페이지 **일본어가 전부 두부(□)** | `app/fonts/jp/*.otf` 가 배포본에 없음(트레이싱 누락 또는 미커밋) | §3-1 · `next.config.ts` 확인 후 Redeploy. 프리플라이트 `fonts` 항목이 먼저 잡아준다 |
| 상세페이지가 `blocks` 단계에서 고착 → 10분 후 `failed` | 배경컷 콜 지연으로 300초 초과 또는 Fluid off | Fluid on 확인(§5-B4). **`MAX_AI_BLOCKS`·`IMAGE_CONCURRENCY` 는 현행 각 6이 정상값이다**(2026-08-18 상향) — 둘이 **같은 값**인지부터 본다. 어긋나면 2웨이브가 되어 예산을 넘긴다. 로그 `이미지 예산 배분` 의 `waves` 로 확인. 마감 가드(`budget.ts`)가 도는데도 고착이면 앞단(콜⑧·⑦·⑨) 지연을 본다 |
| 상세페이지 블록에 「남은 생성 시간이 부족해…」 사유가 붙는다 | 마감 예산 가드가 발동 — 앞단 LLM 콜이 오래 끌어 이미지 웨이브가 예산 밖으로 밀렸다 | **정상 동작이다**(잡 전체가 죽는 대신 사진 몇 장을 포기한 것). 반복되면 LLM 콜 소요를 로그에서 확인 |
| 배경컷에 429(요청 제한)가 잦다 | 동시성 6이 OpenAI images 분당 제한에 닿았다 | `IMAGE_CONCURRENCY` 만 5로 내린다 — `MAX_AI_BLOCKS` 는 6으로 두고 `budget.ts` 가 2웨이브를 흡수한다 |
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
- 2026-08-22 **페이지 이동 속도 개선**: 배포본 내비게이션 2~3초 대기 대응. **[설정]** `vercel.json` 신설 — 함수 리전 `iad1`→`icn1`(§1-1, 왕복 지연의 대부분) · `next.config.ts`에 `experimental.staleTimes { dynamic: 30, static: 180 }`(Next 15부터 dynamic 기본값 0초라 사이드바 왕복마다 서버 재요청). **[코드]** `loading.tsx` 4종 추가(`app/app/` 공통 + 썸네일·상세·리포트) — App Router는 대상 트리에 loading 경계가 없으면 **프리페치를 조기 종료**해(UT 로그: `/app?_rsc=… ERR_ABORTED` 153회) 클릭 후 RSC 왕복이 끝날 때까지 전환 표시가 전혀 없었다.
