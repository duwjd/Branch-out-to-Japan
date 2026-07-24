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
| Storage | 1GB · 파일당 50MB | 앱 업로드 제한 10MB(HOME-02)와 호환 |
| Egress | 5GB/월 | 이미지 서빙이 `/api/files/[id]` 경유(함수 대역폭도 소모) — UT 규모 OK |
| **자동 pause** | **7일 무활동 시 프로젝트 일시정지** | 데이터 보존되나 수동 restore 필요. **UT 직전(7/30~31) 접속 확인**(§6) |

## 3. 실행 모델 — `after()` + maxDuration 300 (큐 미도입)

- 진단 파이프라인(콜⓪ 비전 + ①②③ 병렬 + ④) ≈ 2~3분, 썸네일(카피 1콜 + 이미지 1콜) ≈ 1~2분, 슬라이드 동기 ~20초 — **전부 300초 예산 안**. 08 §6.2의 큐 fallback("지연 길어지면 도입")은 발동 조건 미충족 → 실행 모델 무변경, 프런트 폴링 구조 그대로.
- `export const maxDuration = 300` 명시: `app/api/report/route.ts` · `app/api/studio/thumbnail/route.ts`. 슬라이드는 기존 60 유지.
- **스테일 잡 가드**(2026-07-24 구현): 함수가 300초에서 죽으면 비터미널 상태가 영구 고착 → 폴링 라우트가 `updatedAt` 10분 초과 + 비터미널이면 `failed`로 전환(`app/api/report/[id]/status/route.ts` · `app/api/studio/thumbnail/[id]/route.ts`). 사용자는 재시도 안내를 받는다.

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
7. Supabase 대시보드 — Table Editor에 행 실재, Storage `files` 버킷에 파일 실재
8. **UT 직전(7/30~31)**: 프로덕션 접속(→ pause 예방·해제) + Vercel Usage 대시보드 점검

## 7. 한도 초과 · 장애 대응

| 증상 | 원인 후보 | 대응 |
|---|---|---|
| 진단이 `processing` 고착 → 10분 후 `failed` | 함수 300초 초과(파이프라인 지연) 또는 Fluid off(60초) | Fluid on 확인(§5-B4) → 재발 시 로그에서 콜별 소요 확인, 큐 도입 검토(08 §6.2 대안) |
| `storeKind: "file"` | Supabase env 3종 미설정·오타 | §4 재확인 후 Redeploy |
| 업로드·이미지 표시 실패 | Storage 버킷 `files` 미생성 / 이름 불일치 | setup-supabase.md 4단계 |
| 가입 후 인증 불가 | `AUTH_MAIL_MODE` 미설정 | §4 |
| Supabase "project paused" | 7일 무활동 | 대시보드에서 Restore(수 분) — UT 직전 접속으로 예방 |
| 대역폭·빌드 한도 경고 | Hobby 100GB 초과 등 | Vercel Usage 확인 — UT 규모에서 도달 시 원인(대용량 이미지 반복 서빙) 먼저 제거 |
| **유료 고객 발생** | Hobby 비상업 한정 위반 | **Pro 전환($20/월)** — 과금 전 팀 결정 |
| 리포 private 전환 필요 | Hobby는 private org 리포 연동 불가 | Pro 전환 또는 GitHub Actions + `vercel deploy --prebuilt` 우회 |

## 8. P1 백로그 (배포 후 개선)

- **실메일 발송**: Resend 무료(100통/일) + 커스텀 도메인 검증 → `AUTH_MAIL_MODE=devlink` 제거(`mailer.ts` 내부만 교체 — 연결 지점 단일화 유지)
- **프로덕션 가드 강화**: production에서 `AUTH_SECRET` 미설정 시 throw · Supabase env 누락 시 파일 폴백 대신 명시적 에러(침묵 실패 방지)
- **파일 서빙 서명 URL 직행**: `/api/files/[id]` 함수 경유 대신 Storage signed URL — 함수 호출·대역폭 절감
- **커스텀 도메인** 연결(Vercel 무료 지원) — UT 이후
- 실 OAuth·결제 게이트 집행 등 기능 잔여는 [[10-implementation-status]] §5 정본 유지

## 변경 이력
- 2026-07-24 신규 작성: 호스팅 확정(Vercel Hobby + Supabase Free — [[decisions/2026-07-24-호스팅-배포-결정]])에 따른 배포 스펙 정본. P0 코드 6건(Storage 전환·devlink·트레이싱·maxDuration·engines·스테일 가드)과 같은 PR.
