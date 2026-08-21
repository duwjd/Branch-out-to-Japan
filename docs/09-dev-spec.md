# 09 · 개발 스펙 (어떻게 · 어떤 순서로 짓는가)

> 작성: 2026-07-09 · 최종 갱신 2026-08-21 · 상태: **개발 스프린트 종료 — M0~M11 반영 완료 · M12(UT 대응) 착수 대기**
> **이 문서는 "어떻게·어떤 순서로"만 담는다.** 무엇을 만드는지 = [[specs/01-report-spec]] · 데이터 계약(입출력·LLM 콜 스키마·엔티티) = [[08-data-flow]] · 일정 = [[04-roadmap]]. **여기에 스키마·공식·화면 명세를 재기술하지 않는다** — 충돌 시 정본(§6)을 따른다.
>
> 전제: [[08-data-flow]] §8의 **D1(저장=Supabase)·D6(재현성 전략) 기본안 채택** — ⚠ **7/11 팀 확정 필요**. 변경되면 이 문서 §1·§3만 고치면 된다.

---

## 1. 스택 · 부트스트랩

| 항목 | 내용 |
|---|---|
| 프레임워크 | Next.js(App Router) · TypeScript · Tailwind · npm — 저장소 루트 = 앱 루트 (CLAUDE.md 확정) |
| 스캐폴딩 | `create-next-app` 후 **기존 자산 병합 유지**: `package.json`의 `crawl:*`·`build:lexicon` 스크립트, `@anthropic-ai/sdk`·`playwright` devDeps, `scripts/`·`data/` 그대로 |
| 저장·인증·파일 | Supabase (Postgres + Auth + Storage) — 엔티티는 [[08-data-flow]] §6. **스프린트 2 잠정(2026-07-21):** 인증 = **목 세션**(실 OAuth·이메일 인증 미연동 — §4b M5), 파일 = **로컬 `.data/files/` 우선**(`/api/files/[id]` 서빙, DB에는 fileId만 — Supabase Storage 전환 경계 유지, 08 §6.2). **스펙(2026-07-23)은 소셜 3종 + 이메일/비밀번호 병행 · 비회원 열람 + 실행 직전 게이트로 확대**(구현 잔여 — `specs/03-account/03-account-ui-기획서` §1·§3) |
| 시크릿 | `.env`(비커밋) + `.env.example`에 키 이름 문서화: `ANTHROPIC_API_KEY` · `LLM_MODE`(mock 강제) · `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · (② 스프린트 2) `OPENAI_API_KEY`(없으면 이미지 목 모드) · `IMAGE_MODE`(mock 강제) · `OPENAI_IMAGE_MODEL`(기본값 코드 상수 — 무배포 교체용) · `OPENAI_IMAGE_QUALITY`(기본 medium — 개발 비용 절약) · (배포 2026-07-24) `AUTH_SECRET`(세션 서명 — **프로덕션 필수**, 미설정 시 dev 시크릿 폴백) · `AUTH_MAIL_MODE`(`devlink` = 운영에서도 인증 링크 화면 노출 — 폐쇄 UT용 임시, [[11-deploy-spec]] §4) · (2026-08-19) `SUPABASE_DB_URL`(**선택** — `npm run db:push` 마이그레이션 자동화용 DB 접속 문자열. Session pooler URI 이며 service_role 키와 다른 값이다. **`.env` 전용 — Vercel 런타임에 넣지 않는다**: 앱은 읽지 않고, 서버리스 콜드 스타트가 동시에 뜨면 런타임 DDL이 병렬 실행된다. 미설정 시 대시보드 SQL Editor 경로 사용 — [setup-supabase.md](setup-supabase.md) §5) |
| 배포 | **Vercel Hobby + Supabase Free** — 정본 [[11-deploy-spec]](아키텍처·한도·환경변수·절차·스모크) · 결정 [[decisions/2026-07-24-호스팅-배포-결정]] |
| 로컬 검증 | `npm run typecheck` 기본. ⚠ 한글 경로 머신은 대용량 JS 실행이 차단됨 — **영문 경로 미러(`C:\dev\jgs-run`)에서 실행** ([CONTRIBUTING 트러블슈팅](../CONTRIBUTING.md)) |
| 테스트 | **node 내장 러너**(`npm run test` = tsc 컴파일 → `node --test`) — vitest/tsx는 esbuild 네이티브가 한글 경로에서 차단되어 제외(2026-07-09 규명). typescript는 5.x 고정(7은 네이티브) |

**이미지 비용 계기(2026-08-21 · ⚠️ 모듈만 존재):** `lib/studio/imageCost.ts` 가 OpenAI 응답 `usage` 로 콜별 USD 를 계산한다(`estimateImageCostUsd`·`summarizeImageUsage`·`readImageUsage` + 단위 테스트). `usage` 가 없으면 `null` 을 반환하며 **추정하지 않는다**. 단가 override 는 `OPENAI_IMAGE_PRICE_IMAGE_INPUT` · `_CACHED_INPUT` · `_TEXT_INPUT` · `_OUTPUT`(1M 토큰당 USD, 각각 기본 8 / 2 / 5 / 30).
**⚠️ 배선이 없다 — 이 모듈은 아무도 호출하지 않는다.** 남은 일 셋: ① `supabase/schema.sql` 에 `generated_assets.image_usage jsonb` 추가 ② 썸네일·상세 두 이미지 콜에서 `usage` 를 읽어 기록 ③ `npm run db:push` → 배포. **그래서 UT 에서 이미지 실단가를 측정하지 못했다**(UT-리포트 §11). 이 머신은 `.env` 편집이 차단되어 있어 키 반영은 사용자가 직접 해야 한다.

## 2. 라우트 맵 (공통 골격 — 3축 전체)

각 라우트가 읽고 쓰는 데이터는 [[08-data-flow]] §7 표와 1:1.

| 라우트 | 화면 | 스프린트 | 와이어프레임 |
|---|---|---|---|
| `/` | 랜딩 | ① 주간(M4/stretch) | `public-onboarding` §1 |
| `/checker` | 무료 약기법 체커 | ① stretch | `public-onboarding` §2 |
| `/sample-report` | 샘플 리포트(정적) | ① stretch | `public-onboarding` §3 |
| `/pricing` | 요금(정적) | ① stretch | `public-onboarding` §4 |
| `/login` | 로그인 — 소셜 3종 + **이메일/비밀번호(가입·로그인)** **목 세션**(실 OAuth·메일 미연동 — 소셜은 스프린트 2, 이메일은 2026-07-23 스펙) | 스프린트 2 M5 | `specs/03-account/1-login.html` |
| `/verify-email` | 이메일 인증 링크 랜딩(`?token=`) — 성공/만료 (LOGIN-09) | 스프린트 2 M5 (스펙 · 구현 잔여) | `specs/03-account/1-login.html` 내 상태 |
| `/reset-password` | 비밀번호 재설정 링크 랜딩(`?token=`) — 새 비번 설정 (LOGIN-10) | 스프린트 2 M5 (스펙 · 구현 잔여) | `specs/03-account/3-reset.html` |
| `/onboarding` | 브랜드 프로필 4단계 | 보류 — `/app` no-brand firstRun(첫 브랜드 캡처)이 대체 · 편집은 `/app/brand`가 정본 | `public-onboarding` §6 |
| `/app` | 홈 — no-brand 온보딩(첫 브랜드 캡처 MAIN-13) · 첫 방문 셋업 가이드(MAIN-06) · 복귀 위젯(MAIN-10~12) 상태 변형 | 2차(M11) | `specs/00-main/1-home.html` |
| `/app/account` | 마이페이지(계정 정보·플랜 목업·브랜드 요약·로그아웃) | 스프린트 2 M8 | `specs/03-account/2-mypage.html` |
| `/app/report/new` | 진단 입력폼(브랜드 필수/제품 선택) | ① M3 | `specs/01-report/1-input.html` |
| `/app/report/[id]` | 처리 로딩(폴링) + 8블록 뷰 + 슬라이드 내보내기 버튼 | ① M3 (슬라이드 버튼 M4) | `report-wireframe` |
| `/app/studio/thumbnail` | 스튜디오 홈 = 썸네일 생성(홈=생성 · 갤러리 없음) | ② 주간 | `specs/02-studio/1-home.html` |
| `/app/studio/thumbnail/[assetId]` | 생성 결과 상세(생성중 상태로 시작 → 결과) | ② 주간 | `specs/02-studio/2-result.html` |
| `/app/studio/detail` | 상세페이지 생성 퍼널 + 블록 구성 확인(한 페이지 2단계) | ② 2026-08-10 | `specs/02-studio/3-detail-home.html` · `4-detail-confirm.html` |
| `/app/studio/detail/[assetId]` | 상세페이지 결과(블록 n/N 진행률 → 결합본·분할본·블록 재생성) | ② 2026-08-10 | `specs/02-studio/5-detail-result.html` |
| `/app/brand` | 브랜드 관리(브랜드 킷 — `BrandProfile` 편집 정본 · 일본향 용어집·톤) · **운영 클릭 착지** | ③ 주간 | `specs/04-operations/3-brand.html` |
| `/app/library` | 자산 라이브러리(보관·재열람 정본 · 타입 탭 · 기간 셀렉트 · 조회 전용) | ③ 주간 | `specs/04-operations/1-home.html` |
| `/app/library/[assetId]` | 자산 상세(썸네일 열람·다운로드·해설 / 리포트 요약 9블록 발췌) | ③ 주간 | `specs/04-operations/2-detail.html` |
| `/app/season` | 시즌 캘린더(월 이동 달력 · 시즌 구간 · 날짜/기간 메모 · 준비 추천) `?ym=YYYY-MM` | ③ 2026-08-19 | 기획서 # 5 |
| `/app/matching` | 일본 기업 매칭(신청 폼·상태 추적·제안 — 컨시어지형) | ③ 주간 | `specs/04-operations/4-matching.html` |

> `/admin/review`(검수 큐)는 **삭제**됐다 — 2026-07-16 검수 단계 제거(`decisions/DECISIONS.md`). 화면·라우트 모두 없다.

**서버 경계(①분):** 진단 제출 `POST /api/report` → **진단 모드 판정(제출 경계에서 서버가 1회: `source` 유무 → `tierInput.mode` — 08 §3.2)** → 잡 실행(성공 = 발행 · `brand` 모드는 stages `persona → benchmark → assemble`로 짧게 완주, **콜③ 실패 = 잡 실패**) · 상태 폴링 `GET /api/report/[id]/status` · PDF `GET /api/report/[id]/pdf` · **보고용 슬라이드 `GET /api/report/[id]/slides`**(동기 라우트 — 콜⑤ + 렌더 후 단일 HTML 응답, `published`만 허용·그 외 409. 08 §4.5 · 스펙 §10) · 체커 `POST /api/checker`(stretch). Server Component 기본, 폼·폴링만 `"use client"`.

**서버 경계(스프린트 2분 · 2026-07-21):** 목 세션 `POST /api/auth/login`(provider → httpOnly 쿠키 1개) · `POST /api/auth/logout` — 인증 가드는 `app/app/layout.tsx` 서버 레이아웃 1곳(middleware 없음). **스펙 개편(2026-07-23): 비로그인 `/app` 열람 허용(전역 리다이렉트 제거) + 리포트·썸네일 생성·브랜드 등록 액션에서만 로그인 유도 — 구현 시 가드를 액션 경계(생성·등록 API 401 → 프론트 게이트 모달)로 이동. 실 구현 잔여.** 파일 `POST 업로드는 각 기능 라우트의 FormData` · `GET /api/files/[id]`(로컬 `.data/files/` 서빙 — fileId만 노출, 경로 탈출 검증). ② 썸네일 `POST /api/studio/thumbnail`(FormData: 원본 이미지·플랫폼·템플릿·실적 3필드 → 잡 킥오프, `after()`) · `GET /api/studio/thumbnail`(모드 메타 + 최근 자산 — dev 배지·홈 스트립) · `GET /api/studio/thumbnail/[id]`(폴링 겸 결과 — status 전용 라우트 분리하지 않음). ③ 브랜드 `GET·PUT /api/brand` + `POST /api/brand/doc`(상세페이지 문서 업로드) · 매칭 `GET·POST·DELETE /api/matching` · **시즌 메모 `GET·POST /api/season/memo` + `PUT·DELETE /api/season/memo/[id]`**(2026-08-19 — JSON 본문, 소유 검증 후 `season_memos` CRUD. 시즌 이벤트 자체는 `lib/season.ts` 상수라 저장하지 않는다).

**서버 경계(② 상세페이지 · 2026-08-11 성능 개정):** 구성 미리보기 `POST /api/studio/detail/plan`(FormData — **이미지 바이트를 받지 않는다.** 개수·형식·크기만 쓰므로 화면은 `imageMeta` JSON만 보낸다. 옛 클라이언트의 파일 첨부도 폴백으로 받는다) · 제출 `POST /api/studio/detail`(FormData 실파일 → Storage 업로드는 `Promise.all` 병렬 → 잡 킥오프 `after()`. **2026-08-19: 필드가 `productImage`(제품컷 1장 · 필수 · `images.edit` 의 base)와 `images`(KR 상세 원본 최대 9장 · 비전 입력 전용)로 나뉜다. 저장 순서는 `[제품컷, KR 원본…]` 고정** — `originalImagePath = sourceImagePaths[0]` 계약을 UI가 보장한다) · **진행 폴링 `GET /api/studio/detail/[id]/status`**(진행률·`revision` 지문만 — 화면은 지문이 바뀔 때만 전문 라우트를 다시 부른다) · 결과 전문 `GET /api/studio/detail/[id]` · 블록 재생성 `POST /api/studio/detail/[id]/blocks/[blockId]`.

> **폴링 규약(2026-08-11):** 진행 표시는 **상태 전용 라우트**만 친다(`report/[id]/status` · `studio/detail/[id]/status`). 간격은 2.5초 고정이 아니라 백오프(2.5→5→10→15초) — 상세페이지는 실측 155초짜리 작업이라 고정 2.5초는 과했다. 결과물 전문을 폴링 응답으로 돌려주지 않는다.

## 3. 모듈 구조

```
app/                    # §2 라우트
lib/
  engine/               # ① 파이프라인 — Next 독립 순수 TS
    │                   #   이유: CLI 검증(M1~M2)·단위테스트·②의 콜② 재사용
    rules/              #   normalize · presignals · aggregate · benchmark · assemble
    │                   #   + gates.ts — 입력 게이트 단일 정의(50자/200자/URL · 단위 테스트)
    │                   #   + positioning.ts — 브랜드 포지셔닝 택소노미 16종(폼 칩 + 콜③ 공용)
    │                   #   + slides.ts — 보고용 슬라이드 렌더러(순수 함수)
    │                   #     모드별 골격(brandProduct 7장 / brand 4장)·모든 수치를 코드가 소유, blocksJson 주입 (스펙 §10.3)
    │                   #   → 결정적, 단위테스트 대상 (08 §3.2 회색 노드)
    llm/                #   call1~call4 · runCall5(슬라이드 카피) · checker — 08 §4 계약 구현
    │                   #   + anthropic 클라이언트 · LlmCallLog 기록 · 폴백
    │                   #   ※ 콜⑤는 파이프라인 밖 — /api/report/[id]/slides가 직접 호출
    grounding/          #   사전집계·규정요약·렉시콘 로더 (08 §2) — 콜⑤는 미주입
    schemas/            #   콜별 출력 JSON 스키마 + TS 타입 (08 §4.1~4.6)
  studio/               # ② 썸네일 엔진 (스프린트 2 · Next 독립 순수 TS — CLI 검증 가능)
    │                   #   promptPack.ts — 팩 v1.1.0 로드·buildPrompt(결정적 조립)·proof 게이트·가격 슬롯 강제 공란(단위 테스트)
    │                   #   copyCall.ts — 콜⑥ studioCopy(Claude 비전 1콜: 입력분석+카피 재설계+슬롯 채움 — 08 §4.7)
    │                   #   imageGen.ts — OpenAI images.edit 래퍼 + IMAGE_MODE=mock 폴백(픽스처 PNG)
    │                   #   fixtures.ts — 목 모드 결정적 슬롯·이미지 매핑
  files/                # 파일 저장 (스프린트 2) — storage.ts 함수 2개(saveFile·readStoredFile)
    │                   #   로컬 .data/files/ 저장·fileId 반환. Supabase Storage 전환 시 이 파일 내부만 교체
  server/               # session.ts(목 세션 — 데모 유저 1명 하드코딩) · reportJob.ts · studioJob.ts(reportJob 미러)
  db/                   # supabase 클라이언트 + 엔티티 접근 (08 §6)
    │                   #   스프린트 2 확장: BrandProfile(싱글턴)·GeneratedAsset·MatchRequest + listReports/listRequests/listAssets
  logger.ts             # console.log 금지 — scripts/crawl/lib/logger.mjs 패턴 이식
components/
  app/AppShell.tsx      # 사이드바 앱 셸 (스프린트 2) — 3축 내비 + 운영 하위 아코디언 + 계정 행 (⓪ MAIN-01 축약)
scripts/
  aggregate/            # 사전집계 스크립트 (08 §8-D3, 신규)
  run-report.mjs        # 엔진 CLI 러너 — 화면 없이 입력 텍스트 → blocksJson 산출
  run-thumbnail.ts      # ② 엔진 CLI 러너 (스프린트 2) — 화면 없이 목/실 파이프라인 검증
  run-detail.ts         # ② 상세페이지 CLI 러너 (`npm run detail:cli`) — 1회 실행 = 템플릿 1개
  make-mock-product.ts  # 프리뷰용 가공 제품컷 1장 (`npm run detail:mockproduct`, 1회성·산출물 커밋)
  build-detail-previews.ts # 템플릿 카드 프리뷰 6장 (`npm run detail:previews`) → public/detail-templates/
```

> `detail:previews` 는 **실 파이프라인 산출물**이라 템플릿 정의·블록 렌더 트리를 바꾸면 다시 구워야 한다. 두 키가 모두 필요하고, 전체 1회에 gpt-image-2 약 18콜 + Claude 6콜이 든다. 중간물은 `.data/detail-previews/` 에 캐시되므로 `--force` 없이 재실행하면 이미지 콜이 0이다. 자산 규약은 `docs/specs/02-studio/assets/README.md`.

## 4. ① 리포트 스프린트 마일스톤 (7/11~17 · 엔진 우선)

> 접근: **엔진(파이프라인)을 CLI로 먼저 완성·검증 → 화면 연결.** 리스크(LLM 품질·비용)가 엔진에 있으므로 M1~M2에서 확인하고, 화면(M3)은 검증된 엔진에 붙인다. 로드맵 완료 기준 = "진단 리포트 한 사이클 작동".
> **진척 스냅샷·실행 방법·검증 결과 = [[10-implementation-status]]** (2026-07-09 기능 검증 빌드로 M0~M4 대부분 선행 완료 — 실 LLM E2E 통과).

### M0 · 준비 (7/11)
- [x] `data/processed/detail-ocr.jsonl` 복구 확인 (`git restore` — 08 §2 플래그)
- [ ] D1(Supabase)·D6(재현성) 팀 확정 → `decisions/DECISIONS.md` 기록, `01-report-spec` §9-Q5 문구 갱신 *(기본안으로 구현 선행 — 기록만 잔여)*
- [x] Next 스캐폴딩 + `.env.example` + Supabase 스키마·셋업 문서 *(프로젝트 생성·키는 사용자 액션 — `setup-supabase.md`)*
- [x] `scripts/aggregate` 작성 → `data/processed/benchmark-aggregates.json` 산출·커밋
- [x] 규정 출처 요약 자산 작성 — **v0 미검토** (jp-localizer·약무 검토 잔여)
- **DoD:** `npm run typecheck` 통과 ✅ · 사전집계 파일 커밋 대기

### M1 · 엔진 코어 (7/12~13)
- [x] `rules/normalize`(문장분해 K1..Kn) · `rules/presignals`
- [x] `llm/call1` 콜① 구현 (스키마·grounding·캐싱 — 08 §4.0~4.1)
- [x] `rules/aggregate` 집계·가중·Top3 + **결정성 단위테스트**(같은 items → 같은 종합점수, AC-2.2)
- [x] `scripts/run-report.ts`로 텍스트 입력 → 점수 출력
- **DoD:** 동일 입력 2회 → 종합점수 동일(테스트 5/5) ✅ · cica 실 LLM 17/100 = 정본 샘플 18/100과 1점 차 ✅

### M2 · 엔진 완성 (7/13~15)
- [x] `llm/call2`(감사)·`llm/call3`(페르소나) — 콜①과 병렬 실행 (08 §4.8)
- [x] `rules/benchmark`(사전집계 대비) · `llm/call4`(재작성) · `rules/assemble`(블록 조립 — v6 스펙은 0~8, 코드 반영 후속)
- [x] `LlmCallLog` 기록 · 폴백 규칙(콜② 실패 = 잡 실패 — 08 §3.2 표)
- **DoD:** CLI로 blocksJson 완성 산출 ✅ · 증거원칙 육안 체크 ✅

### M3 · 화면 (7/14~16 — M2와 병행 가능)
- [ ] Supabase Auth(`/login`) + 온보딩 최소형(`/onboarding`) *(기능 검증 빌드에서 **의도적 제외**(비로그인) — 도입 시점 팀 결정)*
- [x] `/app/report/new` 티어 폼 (50자 하드게이트·200자 배지 — 프리필은 온보딩 도입 시) *("티어"는 v4 이전 어휘 — 이력 보존, 아래 v4 항목이 대체)*
- [x] 입력 브랜드 우선 재구성(v4 · 2026-07-16) — 두 진단 모드(`brand`/`brandProduct`)·`positioning` 신설(택소노미 16종)·`gates.ts` 단일화 · 테스트 30/30 (스펙 §3 v4 · 08 §3.1~3.2)
- [x] 제출 → `DiagnosisRequest` 저장 → 잡 실행 → `/app/report/[id]` 상태 폴링 로딩
- [x] 블록 뷰 렌더 (품의 표지·감사표·JP+KR 병기 카드 포함 — 코드는 구 9블록, v6 스펙=0~8 반영 후속)
- **DoD:** 웹에서 입력 → 리포트 열람 한 사이클 (AC-1.1) ✅

### M4 · 발행 체계 (7/16~17)
- [x] ~~`/admin/review` 검수 큐 — 목록·감사표 검토·실명 서명/반려 (08 §3.3 상태 머신)~~ → **폐기(2026-07-16)**: 검수 단계 제거로 화면·라우트·상태(`needsReview`·`rejected`)를 **삭제**했다. 당시 완료된 작업이나 제품에서 빠졌다 — 이력으로만 남긴다 (`decisions/DECISIONS.md` 2026-07-16 행)
- [x] **보고용 슬라이드 내보내기** — `rules/slides.ts` 렌더러(7장 골격·수치는 코드) + `llm/runCall5`(카피만) + `GET /api/report/[id]/slides` + 리포트 화면 버튼 (스펙 §10 · 08 §4.5) · `slides.test.ts` 10건 통과
- [ ] PDF 내보내기 (블록0 표지 연동 — 08 §8-D7)
- [ ] *(stretch)* 무료 체커 `/checker`(+비로그인 3회 — 08 §8-D8) — 랜딩 `/`는 완료
- **DoD(2026-07-16 개정):** ~~needsReview → 서명 → published · 서명 없는 발행 불가~~ **폐기** → **파이프라인 성공 = 발행**(`processing → published`, 사람 개입 0) ✅ · 슬라이드: `published`에서 버튼 → 외부 리소스 0건인 단일 HTML 다운로드(AC-10.1~10.3) · PDF 잔여

## 4b. 스프린트 2 마일스톤 (2026-07-21 확정 — ② 실생성 + ③ 운영 + 계정)

> 목표: **실제 API 호출로 리포트와 이미지가 생성되는 동작 서비스.** 확정 결정 4건 — (1) 이미지 생성 = OpenAI gpt-image 실호출(키 없으면 목 모드), (2) 파일 = 로컬 `.data/files/` 우선, (3) 소셜 로그인 = **목 세션**(실 OAuth 금지 — 버튼 클릭 = 로그인 가정), (4) 최대한 간단하게 — **기존 패턴 복제가 곧 설계다**(studioJob = reportJob 미러, 이미지 목 모드 = `LLM_MODE=mock` 미러, 폴링 화면 = `/app/report/[id]` 미러).
> 엔진 우선 관례는 **스튜디오(M6)에만** 적용 — 리스크(OpenAI 연동·프롬프트 품질)가 거기에만 있다. 운영·계정은 CRUD 화면이라 화면 우선.

### M5 · 기반 — 세션·셸·파일 저장·스토어 확장
- [ ] 목 로그인: `lib/server/session.ts`(데모 유저 1명 하드코딩 + `getSession()`) · `POST /api/auth/login|logout` · `/login` 화면(소셜 3종 버튼 — 클릭 = 쿠키 발급) · `app/app/layout.tsx` 가드(비로그인 → `/login`). **middleware·User 엔티티·Supabase Auth 만들지 않는다**
  - ※ **스펙(2026-07-23)은 소셜+이메일 병행 · 비회원 열람 + 실행 직전 게이트로 확대**됐다. 이 M5 목 구현 범위는 **소셜 목 세션 그대로 유지**하고, 이메일 인증·비회원 열람 게이트(전역 가드 완화 → 생성·등록 액션 게이트)는 **후속(구현 잔여)** — 스펙 정본 `specs/03-account/03-account-ui-기획서` §1·§3
- [ ] `components/app/AppShell.tsx` 사이드바 셸(3축 내비·운영 아코디언·계정 행) + `/app` → `/app/library` 리다이렉트
- [ ] `lib/files/storage.ts`(saveFile·readStoredFile 2함수) + `GET /api/files/[id]`
- [ ] `lib/db/store.ts` 인터페이스 확장(BrandProfile 싱글턴·GeneratedAsset·MatchRequest + list 조회) + fileStore·supabaseStore 구현
- [ ] `npm i openai` + `.env.example` 키 4종 추가
- **DoD:** 비로그인 `/app/*` → `/login` 리다이렉트, 로그인 → `/app/library` 진입. **기존 리포트 2화면이 셸 안에서 리그레션 없이 동작**(제출→발행 E2E). `npm run typecheck` 0오류

### M6 · 스튜디오 엔진 (CLI 검증 — 화면 없음)
- [ ] `lib/studio/promptPack.ts` — buildPrompt(스펙 §2-⑤ 그대로) + proof 게이트(3필드 전부 없으면 배지 문단 제거) + **가격 슬롯(G.priceBlock·giftInsetParagraph) v1 강제 공란**(입력 UI 없음 — 유리오인 차단) + `promptPack.test.ts`(node --test)
- [ ] `lib/studio/copyCall.ts` — 콜⑥ studioCopy: `runStructuredCall` 재사용(+`image?` 옵션 하위 호환 추가), grounding에 `'studioCopy'` 케이스(약기법+렉시콘 주입). **콜② 자체는 재사용하지 않는다** — 문장 감사 계약(K1..Kn)이 슬롯 카피와 불일치, grounding 재사용으로 §2-③ "판정 로직 재사용"을 충족
- [ ] `lib/studio/imageGen.ts` — `currentImageMode()`(키 없거나 `IMAGE_MODE=mock` → mock) · real = `openai.images.edit`(`input_fidelity:'high'`·1024×1024·모델 ID는 env 주입) · mock = `docs/specs/02-studio/assets/samples/haruon-{slug}.png` 반환
- [ ] `lib/server/studioJob.ts` — reportJob 미러: `generating → done|failed`, stage 4종(analyze→assemble→generate→gate), `after()` 킥오프. 검수 게이트 v1 = 구조적 보증 기록(`gateResult` 3체크 — 비전 자동검수 없음, 라이브러리는 `done`만 조회)
- [ ] `POST·GET /api/studio/thumbnail` + `GET /api/studio/thumbnail/[id]` + `scripts/run-thumbnail.ts`(`npm run thumbnail:cli`)
- **DoD:** 키 없이 CLI 목 E2E(레코드 `generating→done` + `.data/files/` 픽스처 PNG + promptUsed + explanationJson). 테스트 통과. **키 있으면 실호출 1장 스모크 — 모델 ID 확정(§6-Q1)이 첫 태스크**

### M7 · 스튜디오 화면
- [ ] `/app/studio/thumbnail` 생성 퍼널(드롭존→플랫폼 칩→템플릿 8종 그리드(E 실적 게이트·F 모델컷 잠금)→실적 아코디언→sticky 제출 바) — `specs/02-studio` HOME-01~08 ※ F 모델컷 잠금·최근 생성 스트립은 M10에서 해소·삭제
- [ ] `/app/studio/thumbnail/[assetId]` 결과 상세(2.5초 폴링: 생성중 shimmer+고객어 → done 이미지·게이트 배지·재설계 해설·다운로드 → failed 재시도) — RESULT-01~06
- **DoD:** 브라우저 목 E2E(업로드→선택→제출→폴링→결과→다운로드 파일명 규칙). 실 API 켜고 동일 동선 1회

### M8 · 운영 3화면 + 계정
- [ ] `/app/library` 타입 탭 [진단 리포트|썸네일] + 그리드 + 빈 상태(서버 컴포넌트 — 실시간 폴링 없음, 새로고침 반영) · `/app/library/[assetId]` 자산 상세(썸네일/리포트 요약 2모드 — 생성중 자산은 ② 결과로 리다이렉트)
- [ ] `/app/brand` 4섹션 폼(프로필·제품·채널·브랜드 킷) + `GET·PUT /api/brand` + 상세페이지 문서 업로드(`POST /api/brand/doc`) + 불소급 캡션(BRAND-02)
- [ ] `/app/matching` 신청 폼 → 상태 스테퍼(컨시어지형 — 상태 갱신 수동) + `GET·POST·DELETE /api/matching` + 사이드바 배지
- [ ] `/app/account` 마이페이지(계정 정보·provider 배지·플랜 목업·브랜드 요약·로그아웃)
- **DoD:** M7 생성 자산·기존 리포트가 탭별 조회→상세→다운로드. 브랜드 저장 후 재진입 유지 + 기존 자산 불변(스냅샷 원칙). 매칭 신청→상태→취소 왕복. 마이페이지 provider 배지·자산 카운트

### M9 · Supabase 정합 (선택·후순위)
- [ ] `supabase/schema.sql` 3테이블(brand_profiles·generated_assets·match_requests) 멱등 추가 + supabaseStore 실구현 검증
- **DoD:** Supabase 키 켠 상태에서 M7·M8 동선 재통과 (파일은 여전히 로컬)

## 4c. 2차 개발 마일스톤 (2026-07-22 확정 — 기획서·와이어프레임 선반영 완료분의 코드화)

정본: `specs/02-studio/02-studio-ui-기획서.md`(2026-07-22 개정 · HOME-02b·05b·07) · `specs/02-thumbnail-converter-spec.md` §1 입력 계약·§2-④·§2-⑥·§4 · `08-data-flow.md` §4.7·§6.1.

### M10 · 템플릿 8종 전부 생성 가능 + 홈 정리
1. **저장 계층** — `lib/db/store.ts` `GeneratedAssetRecord`에 `modelImagePath`·`modelConsent`·`promoInput` 추가 → `supabase/schema.sql` 3열 추가 → `supabaseStore` 매핑(`toAssetRecord`·`createAsset`)
2. **API** — `POST /api/studio/thumbnail`의 **`styleId === 'F'` 400 차단 삭제**, `modelImage`·`modelConsent`·프로모 필드 검증 추가(E의 proof 게이트와 같은 패턴). 클라이언트와 동일 규칙 이중 적용
3. **프롬프트 조립** — `lib/studio/promptPack.ts` `PRICE_LOCKED_SLOTS` 폐기 → `badgeParagraphs`와 같은 모양의 가격 조립 함수 신설. 취소선 통상가는 `normalPriceVerified === true`일 때만
4. **비전 콜** — `lib/engine/llm/client.ts` 이미지 첨부를 배열로 확장(기존 단일 콜 사이트 호환 유지) → `lib/studio/copyCall.ts`에 모델컷 2번째 이미지 + 프로모 입력 컨텍스트 전달
5. **이미지 생성** — `lib/studio/imageGen.ts` 입력을 이미지 배열로 확장, F만 `[제품컷, 모델컷]`으로 `images.edit` 호출
6. **잡** — `lib/server/studioJob.ts` 모델컷 로드·전달, `structuralGateResult`에 F·G 체크 항목 추가(스펙 §4 신규 2항)
7. **픽스처** — `lib/studio/fixtures.ts` F·G 목 슬롯 보강(현재 F는 clean 이미지로 폴백, G는 가격 없음), F 목 샘플 PNG 추가
8. **화면** — `StudioForm.tsx`에 모델컷 업로더·동의 체크·프로모 입력 추가 + **최근 생성 스트립 제거**(섹션·2.5초 폴링·`GET /api/studio/thumbnail`의 `recent` 필드까지. dev 배지 메타는 유지 — 유일한 소비자가 이 폼이다) · 결과 상세에 모델컷 병기
- **DoD:** 목 모드로 **8종 전부** 제출→`done` 도달. 실 API로 F(얼굴이 업로드 원본 그대로인지)·G(입력 가격 문자열 자단위 일치 · 미체크 시 취소선 없음) 각 1장 스모크. 홈에 자산 표면 0개. `npm run typecheck && npm test`

### M11 · 온보딩 · 빈 상태 · 홈 위젯 (⓪ 상태 커버리지 코드화)
정본: `specs/00-main/01-onboarding-ui-기획서.md`(ONBOARD·상태 매트릭스) · `specs/00-main/00-main-ui-기획서.md`(MAIN-06·10~13) · `lib/season.ts`.
1. **시즌 이벤트** — `lib/season.ts`에 `SEASON_EVENTS` 상수 + `upcomingEvents(now, limit=3)` 헬퍼(임박순·`dDay`·진행중 플래그). MAIN-12·KPI 단일 소스. 단위 테스트(결정성)
2. **브랜드 생성 경로** — `POST /api/brand`(create 전용 · 포지셔닝 0개 허용 · 싱글턴이면 409). 편집 `PUT`은 ≥1 포지셔닝 규칙 유지. store 인터페이스 변경 없음(`saveBrandProfile` upsert 재사용)
3. **온보딩 캡처** — `components/app/BrandOnboarding.tsx`(필수 3필드 · 필드 정본 MAIN-01b′) + `app/app/page.tsx` no-brand 분기(ONBOARD-01·MAIN-13)
4. **4단계 가이드** — `app/app/page.tsx` 셋업 가이드 3→4단계(제품 등록 신설 · 완료 판정 proxy=`productInfoMemo`/`detailDocName`) · step4 데이터 구동(`disabled = 발행 리포트 없음` · Model A)
5. **홈 위젯** — `components/app/HomeWidgets.tsx`(BrandInfoWidget MAIN-11 · ReportSummaryWidget MAIN-10 · UpcomingEventsWidget MAIN-12) + 복귀 뷰 그리드 조립. 홈은 재조회 전용 — 새 저장 없음(08 §7)
6. **리포트 프리필** — `report/new` 마운트 시 `GET /api/brand` 프로필로 빈 브랜드 필드(브랜드명·카테고리·포지셔닝) 프리필 + "이어받음" 캡션(스펙 INPUT-05 프리필 활성)
7. **셸 정합** — `AppShell` 내비 라벨 "대시보드" → "홈"(스펙 2026-07-22)
- ※ **스튜디오 빈 상태는 이 라운드 대상 아님** — 첫 사용 온보딩 = 템플릿 그리드(② HOME-04), 제품 피커 빈 상태 = ② HOME-02-0a(M10). ② HOME-07 "홈에 자산 되비추는 표면 두지 X" 정합이라 별도 갤러리 zero-state를 만들지 X
- **DoD:** `.data/` 비운 상태 로그인 → 첫 브랜드 캡처 → 4단계 가이드. 리포트 발행 → 복귀 뷰 위젯(MAIN-10/11/12) 렌더 · brand 모드 리포트 요약 "종합점수 없음" 분기. 리포트 프리필 동작. `Product` 엔티티는 범위 밖(제품 단계 proxy). `npm run typecheck && npm test` 통과

### 하지 말 것 (과설계 차단 — 스프린트 2)
middleware.ts / User 엔티티·실 OAuth·이메일 인증·비회원 열람 게이트(**스펙엔 있으나 2026-07-23 개편분은 이 스프린트 구현 대상 아님** — 목 소셜 세션 유지) / ⓪ 대시보드(KPI·히어로·브랜드 스위처 — **2차 M11에서 홈·위젯 해소**) / 하이브리드 오버레이(sharp·canvas) / 비전 자동검수 / FileStorage 추상 인터페이스 / 잡 큐 / status 전용 라우트 분리 / 결제·탈퇴 백엔드·자산 삭제·다중 브랜드·페이지네이션 / 라이브러리 실시간 폴링·시즌 타임라인 실데이터 / 기존 리포트 v6 개정 착수 / `wireframe.css` 클래스 이식(Tailwind로 재구성)

**M10 추가분** — 모델컷 계약서 업로드·사용 기간 관리(동의는 체크박스 자기 신고까지) / 모델컷 다건·배리에이션 그리드 / 쿠폰 조건부 가격 계산·검증(각주 문자열까지) / 가격 텍스트의 코드 오버레이(하이브리드) — 전부 (추후 기획)

## 4d. UT 대응 마일스톤 (2026-08-21 확정 — AI 에이전트 UT P0 해소)

> 근거 = `docs/research/ut-agent/results/UT-리포트.md`(합성 페르소나 20인 · 2세션 · 무효 응답 0건) · [이슈-백로그.md](research/ut-agent/results/이슈-백로그.md) §E(P0 14 · P1 37 · P2 20).
> P0 14건 중 **9건이 "말과 화면이 다르다" 한 가지 유형**이다. **기능을 더 만들기 전에 이미 한 말을 화면과 맞추는 것**이 이 마일스톤의 전부다.

### M12-A · 리포트 파이프라인 시간 예산 — ✅ 완료 (`c1f3d30` · 2026-08-21)
- [x] `StructuredCallOptions` 에 `timeoutMs` 추가 → `lib/engine/llm/client.ts` 의 `messages.create(p)` 를 `messages.create(p, { timeout })` 로
- [x] `lib/engine/reportBudget.ts` 신설 — `REPORT_BUDGET_MS = 270_000`(상세 잡 `lib/studio/detail/budget.ts` 의 `JOB_BUDGET_MS` 와 같은 규칙)
- [x] 한국어 윤문 콜⑩ 진입 전 잔여 시간 검사 → 부족하면 건너뛰고 `humanizeSkipped` 기록 · 콜⑩ 청크 병렬화
- **DoD 달성:** 2차 세션 재실행에서 **20/20 발행**(성공률 100% · `humanizeSkipped` 0건). 예산 초과 시 `failed` 가 아니라 **윤문만 생략된 `published`** 로 끝난다
- **근거:** 1차 세션 T3 20/20 실패 — `POST` 11초 → `llmCalls` 22초 → `call4` 124초 → `humanize` 231초 → 함수 상한 300초 → 829초에 `failed`. 원인은 폴백 부재가 아니라 **SDK 기본 타임아웃(10분)이 함수 상한보다 길어 폴백에 닿기 전에 함수가 죽은 것**
- **잔여(UT-60 · P1):** `brandProduct` 가 예산의 **77~96%** 를 쓴다(유효 n=15 · 중앙 239초 · 최소 여유 10초). 콜별 상한 재배분 또는 콜⑩ 청크 수 증가 — **"고쳐졌다"와 "아슬아슬하다"가 같은 상태다**

### M12-B · 폐루프 배선 (2차 세션 신규 P0 — 최우선)
- [ ] **UT-58** 상세 생성 폼에 **제품 선택/입력**을 넣는다. 지금은 제품명 칸이 없어 생성기가 일본어 상품명을 스스로 지어 **같은 세션 안에서 리포트와 상세가 다른 제품을 말한다**. 브랜드 킷 제품 자산이 이미 있고 리포트가 제품명을 받으므로 ① 어느 제품인지 고르게 하고 ② 그 제품 리포트가 있으면 재작성 문구를 프리필
- [ ] **UT-59** 진단 입력에 **"내 자산에서 불러오기"**를 넣는다. `generated_assets` 에 발행된 상세·썸네일 텍스트가 이미 있는데 리포트가 그것을 보지 않고 "미관찰·0점"으로 채점한다. 발행 자산을 리포트 기준으로 재감사해 **"이미 나간 콘텐츠에 이 문제가 있다"**를 표시
- **DoD:** 리포트와 상세가 같은 제품을 가리킨다 · 스튜디오가 만든 표현을 리포트가 감사 대상으로 본다
- **근거:** "한 서비스로 이어져 보이는가" **Y 4 · N 16**. 스튜디오가 만든 상세에 리포트가 「쓸 수 없다」고 판정한 표현(`鎮静`)이 그대로 살아 있는데 서비스가 못 잡는다(P11). **서비스의 유일한 차별점이 화면에서 반증되는 지점이라 나머지보다 앞선다**

### M12-C · "말과 화면이 다르다" 나머지 (문구·조건 분기 — 새 기능 없음)
- [ ] **UT-27** `/app/matching` 상단에 랜딩과 같은 고지를 둔다("MVP 검증 이후 제공을 검토하는 확장 서비스"). 버튼 "매칭 신청" → "사전 신청(MVP 이후 순차 안내)"
- [ ] **UT-25** `lib/studio/detail/templates.tsx` 아이브로우 폴백에서 한국어 `ctx.brandName` 제거 — 브랜드 킷 JA 표기 → 콜⑧ 번역 → 빈 값 순 폴백
- [ ] **UT-26** 상세 템플릿의 `signatureBlocks` 가 전부 근거 미충족이면 "추천" 배지를 붙이지 않고, 카드에 필요한 입력을 미리 표기
- [ ] **UT-28** 썸네일 템플릿 목록에서 **카피 슬롯 없는 문법(A·B)을 별도 그룹으로 분리** + 결과 화면에 "이 문법에서 우리가 한 일"(배경·조명·규정 판정) 명시 + "무엇을 채우면 카피형이 열리는가"를 그 자리에 표시
- [ ] **UT-39** `productClass` 를 표지뿐 아니라 감사 판정에도 전달
- [ ] **UT-08·09** 시즌 D-day 와 이벤트를 `brandProfile.category` · 채널 등록 여부 · 진출 단계로 분기
- **DoD:** 각 화면에서 랜딩 문구와 앱 문구가 같은 말을 한다 · 템플릿 이름과 산출물 내용이 일치한다
- **근거:** UT-27 은 **20/20 전원 지적 · 15/20 이탈 위기**로 이번 UT 최다. UT-28 은 A·B 배정 6명 **전원 차별성 2점**(카피형 14명은 4.00)

### M12-D · 지불 판단 정보
- [ ] **UT-01** 랜딩·온보딩·진단 폼에 요금 표기 또는 "이 단계는 무료" 명시
- [ ] **UT-02** 로그인 직후 첫 화면에 서비스 한 줄 설명
- [ ] **UT-13 · UT-64** 사람 검수 유무를 플랜·리포트·결과 화면에 명시 — **없으면 없다고 쓰는 편이 낫다**
- [ ] **UT-19** 스튜디오 예시 이미지에 "이 서비스가 만든 결과" / "일본 시장 참고 사례" 구분 표기
- [ ] **UT-44** FREE 플랜 설명을 실제 무료 범위와 일치시킨다 — 지금은 "약기법 간이 체커만"이라 써두고 썸네일·상세를 무료로 내준다
- **DoD:** 로그인 전에 가격 감이 잡힌다 · 유료 상품에 포함이라 적힌 것을 무료로 내주지 않는다
- **근거:** WTP **18/20** 인데 **NPS −70 · 9점 이상 0명**. 사겠다는 사람은 많은데 확신을 못 준다

### M12-E · 리포트 읽기 부담 (P1 — 여력 있을 때)
- [ ] **UT-61** 안 읽히는 4블록을 **지우지 말고 접는다** — 블록5·6·8 기본 접힘 + 블록1·2·7 안에 "자세히" 링크. 스킵 사유가 예외 없이 "중복"이고 **블록5는 20명 중 읽은 사람이 0명**이다
- [ ] **UT-62** 진단 폼에 **"넣지 않으면 잠기는 블록 5개"**를 이름으로 미리 보여주고, 미제출 문구를 "관찰 0개" → **"제출되지 않아 판정하지 않음"** 으로 교체
- [ ] **UT-63** 감사 결과 건수를 서술에서 다시 세지 말고 **표에서 파생**시킨다(감사표 4문장인데 본문이 "다섯 개")
- [ ] **UT-65** 보고용 슬라이드에 페르소나 1장 추가 — `slides_usable` Y 4 · PARTIAL 16 이고 PARTIAL 사유 1위가 이것

> **스펙 대상이 아닌 것(별도 트랙):** 랜딩 카피 5건(UT-53~57 — `jp-localizer`) · `@cosme` 채널 지원 여부(UT-23 — 제품 결정 사항, 8/20 언급 중 5명이 주력 채널) · 브랜드 폼 카테고리 4→6종 정합(UT-50 — `productCategory` 는 이미 6종, 폼만 뒤처짐).

## 5. 검증 전략

| 수단 | 대상 | 기준 |
|---|---|---|
| 단위테스트(node:test) | `rules/aggregate` 등 `rules/*` | 결정성: 같은 입력 → 같은 출력 (AC-2.2) · `rules/slides`는 같은 입력 → 같은 HTML (AC-10.5) |
| 골든 픽스처 | cica 샘플 카피 → CLI 실행 | [[specs/01-report-sample-cica-ampoule]]과 점수·판정 **방향** 대조 (완전 일치 요구 아님 — LLM 편차는 `LlmCallLog`로 관찰, 08 §8-D6) |
| 수동 E2E 체크리스트 | 입력 → (자동 발행) → 열람 → 슬라이드·PDF | 로드맵 "한 사이클 작동" · UT 시나리오와 동일. ~~서명~~ 단계 제거(2026-07-16) |
| **리포트 잡 시간 예산** | `reportJob` · `lib/engine/reportBudget.ts` | 콜⑩ 진입 시 잔여 시간 < 임계면 건너뛰고 `published` 로 끝나는가 · **함수 상한(300초) 전에 반드시 종료되는가** · 소진율이 95%를 넘는 건이 늘고 있지 않은가(UT-60) |
| **AI 에이전트 UT** | 배포본 전 과업 | `docs/research/ut-agent/` 실행 도구 — 합성 페르소나 20인이 실배포본을 돌며 과업 성공률·산출물 4축·이슈를 수집. 큰 변경 후 재실행 가능 |
| typecheck / CI | 전체 | PR 병합 전 (CONTRIBUTING) |

## 6. 참조 정본 (구현 시 무엇을 보는가)

| 구현 대상 | 정본 |
|---|---|
| 입력 필드·검증·폴백 / 8블록 내용·AC | [[specs/01-report-spec]] §3(v4: 브랜드 필수/제품 선택 · 두 진단 모드)·§4(v6: 블록 0~8)·§6 |
| 보고용 슬라이드(형식·7장 골격·산출 분담·AC) | [[specs/01-report-spec]] §10 |
| LLM 콜 요청/응답 스키마·파라미터·폴백 | [[08-data-flow]] §4 |
| 엔티티·저장 / 화면↔데이터 | [[08-data-flow]] §6·§7 |
| 채점 항목·통과기준 (콜① grounding) | [[research/jp-detail-message-patterns]] §4 |
| 화면 구성·상태·접근성 규약 | 진단 입력폼 = `docs/specs/01-report/1-input.html` · `design/wireframes/report-wireframe.html`(8블록 뷰) · `public-onboarding-spec.md` §0 · `app-spec.md` |
| 코딩 컨벤션 | `CLAUDE.md` (camelCase·JSDoc·로거·Server Component 기본) |

---

## 변경 이력
- 2026-08-21 **AI 에이전트 UT(20인 · 2세션) 반영 + 스프린트 종료 정리**(근거 `docs/research/ut-agent/results/UT-리포트.md` · [이슈-백로그.md](research/ut-agent/results/이슈-백로그.md) §E). **[추가]** §4d **M12-A~E** — 리포트 시간 예산(✅ `c1f3d30` 완료) / 폐루프 배선 UT-58·59 / "말과 화면이 다르다" 나머지 / 지불 판단 정보 / 리포트 읽기 부담 · §1 이미지 비용 계기(`lib/studio/imageCost.ts` — **모듈만 존재 · 호출부·DB 컬럼 없음**) · §5 검증 전략에 리포트 시간 예산·AI 에이전트 UT 행. **[근거]** 1차 리포트 발행 **0/20**(콜⑩ 윤문이 231초에 시작해 함수 300초 상한 초과) → 2차 **20/20 복구** · 기업 매칭 랜딩↔앱 모순 **20/20 지적·15/20 이탈 위기** · "한 서비스로 보인다" **4/20** · 카피 슬롯 없는 썸네일 A·B **6/6 차별성 2점** · WTP **18/20** 대비 **NPS −70**.
- 2026-08-11 **성능 개정 — 상세페이지 도입 후 전 페이지 체감 저하 해소**. 원인은 상세페이지 기능 자체가 아니라 **기존 구조적 비효율에 상세페이지 데이터가 얹혀 임계점을 넘은 것**이었다. **[추가]** §2 ② 상세페이지 서버 경계 + 폴링 규약 · `GET /api/studio/detail/[id]/status` · `Store.getBrandCounts`(개수 전용) · `Store.getAssetStatus`·`listBlockStatuses`(폴링 전용) · `GeneratedAssetSummary`·`ReportSummary`(목록용 타입 — 무거운 jsonb 제외) · `lib/files/downloadUrl.ts`. **[변경]** `app/app/layout.tsx` 요청당 스토어 왕복 `5+2N` → `3+N`(세션·브랜드목록을 `react.cache` 로 요청 단위 메모 · 카운트는 count 쿼리) · `next.config.ts` `outputFileTracingIncludes` 키를 `"/**"` 단일에서 **라우트 스코프**로(JP 폰트 9.2MB + 샘플 7.4MB 가 함수 47개 전부 → 상세/썸네일 7개) · `POST /api/studio/detail/plan` 이미지 바이트 미수신(토글당 최대 100MB → 수 KB) · 폴링 2.5초 고정 → 백오프 + 상태 전용 라우트 · `GET /api/files/[id]` Supabase 모드에서 서명 URL 302(함수 전량 버퍼링 제거 · `?download=1` 은 종전 바이트 응답) · `fileStore` 읽기를 직렬화 큐 밖으로 + 쓰기 원자적 교체(rename) · 비전 입력 이미지 장변 1568px 다운스케일 · 템플릿 카드용 상단 크롭본(`preview-D*-card.webp`, 597KB → 26KB).
- 2026-08-19 **③ 운영 탭 UI 개선**. **[추가]** §2 라우트 맵 `/app/season` 시즌 캘린더 · 서버 경계에 `GET·POST /api/season/memo` · `PUT·DELETE /api/season/memo/[id]`. **[변경]** 라우트 맵 운영 4행을 메뉴 순서(브랜드 관리 → 자산 라이브러리 → 시즌 캘린더 → 기업 매칭)로 재배열 · `/app/library` 기간 셀렉트 추가 · 상세 제출 FormData 를 `productImage`/`images` 로 분리(입력 이미지 정합성). 정본 = `specs/04-operations/04-operations-ui-기획서.md` # 1 · # 5.
- 2026-07-23 **온보딩·빈 상태·홈 위젯 코드화 스펙**. **[추가]** §4c **M11**(시즌 이벤트·`POST /api/brand` create·`BrandOnboarding`·4단계 가이드·`HomeWidgets` MAIN-10~12·스튜디오 빈 상태·리포트 프리필·셸 "홈" 정합). **[변경]** §2 라우트 맵 `/app`(리다이렉트 → 홈 상태 변형 · 와이어프레임 = `specs/00-main/1-home.html`)·`/onboarding`(보류를 `/app` no-brand firstRun이 대체) · 하지 말 것의 "⓪ 대시보드"에 2차 M11 해소 주석. 정본 = `specs/00-main/01-onboarding-ui-기획서.md`.
- 2026-07-21 **스프린트 2 개발 스펙 확정**(사용자 결정 → [[decisions/DECISIONS]] 2026-07-21 스프린트 2 행). **[추가]** §4b 마일스톤 M5~M9(② 실생성 + ③ 운영 + 계정) · §2 라우트 `/app/account`·`/app`(리다이렉트)·스프린트 2 서버 경계(목 세션·파일 서빙·스튜디오·브랜드·매칭 API) · §3 `lib/studio`·`lib/files`·`lib/server/session`·`AppShell`·`run-thumbnail.ts`. **[변경]** §1 인증 = 목 세션 잠정·파일 = 로컬 우선(Supabase Storage 전환 경계 유지) · 시크릿 키 4종 추가(`IMAGE_MODE`·`OPENAI_IMAGE_MODEL`·`OPENAI_IMAGE_QUALITY`) · `/login` 정본 = `specs/03-account`.
- 2026-07-21 **②·③ IA 개편 반영**([[07-ia]] §5 · `specs/02-studio`·`specs/04-operations` UI 기획서). **[변경]** §2 라우트 맵 `/app/studio/thumbnail` = 스튜디오 홈(홈=생성 · 기존 "썸네일 변환기" 갤러리 허브 폐지) · 와이어프레임 정본을 specs 프로토타입으로 갱신. **[추가]** `/app/studio/thumbnail/[assetId]` 생성 결과 상세(생성중 상태로 시작) · `/app/library/[assetId]` 자산 상세(카드 클릭 시 축 이동 제거 — 재열람 정본).
- 2026-07-16 **입력 브랜드 우선 재구성(v4) · 두 진단 모드 반영**([[specs/01-report-spec]] v4 배너·§3 · [[08-data-flow]] §3.1~3.2 · [[decisions/DECISIONS]]). **[변경]** §2 라우트 맵 `/app/report/new` "티어 입력폼" → **진단 입력폼(브랜드 필수/제품 선택)** · 와이어프레임 정본 = `docs/specs/01-report/1-input.html` · 서버 경계에 모드 판정(제출 경계 1회: `source` 유무 → `tierInput.mode`)·`brand` 파이프라인(stages `persona → benchmark → assemble` · 콜③ 실패 = 잡 실패) 한 줄 · §3 `rules/` 주석에 `gates.ts`(게이트 단일 정의)·`positioning.ts`(택소노미 16종) 추가·슬라이드 골격 모드별(7장/4장) · §6 참조 정본 표 §3 서술·입력폼 화면 정본 갱신. **[추가]** M3 체크 항목: 입력 브랜드 우선 재구성(v4) — 테스트 30/30. 기존 M3 "티어 폼" 항목은 취소하지 않고 이력 주석만 부기.
- 2026-07-16 **검수 제거 · 슬라이드 추가 반영**([[decisions/DECISIONS]] 2026-07-16 행). **[삭제]** §2 라우트 맵 `/admin/review` · 서버 경계 `POST /api/report/[id]/review`. **[폐기]** M4 검수 큐 태스크와 DoD("needsReview → 서명 → published"·"서명 없는 발행 불가") — 당시 충족했으나 제품에서 빠짐, 취소선으로 이력 보존. **[변경]** M4 DoD = **파이프라인 성공 = 발행**(사람 개입 0) · §5 E2E 체크리스트에서 서명 단계 제거. **[추가]** `GET /api/report/[id]/slides` 라우트 · `rules/slides.ts` 렌더러 · `llm/runCall5` · M4 슬라이드 태스크 · §6 참조 정본에 스펙 §10.
- 2026-07-09 신규 작성: 공통 골격(스택·라우트·모듈) + ① 리포트 스프린트 마일스톤 M0~M4(엔진 우선). 원칙 = 정본 중복 없이 포인터, 태스크는 체크박스+DoD.
