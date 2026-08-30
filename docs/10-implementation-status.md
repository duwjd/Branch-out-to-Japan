---
title: 10 · 구현 현황 (Phase 0 종료 스냅샷)
space: 설계·개발
status: 정본
phase: Phase 0
updated: 2026-08-31
owner:
tags: [구현현황, 스냅샷]
---

# 10 · 구현 현황 (Phase 0 종료 스냅샷)

> **무엇이 실제로 돌아가는가**의 스냅샷 문서. **[[04-roadmap]] Phase 0 종료 시점(2026-08-31) 기준**이다.
> **지금 상태 한 줄:** 3축 전부가 배포본(`https://branch-out-to-japan.vercel.app`)에서 실제로 돌아간다 — ① 진단 리포트(입력→LLM 파이프라인→9블록→발행→슬라이드) · ② 마케팅 스튜디오(썸네일·상세페이지 실생성) · ③ 운영(브랜드 관리·자산 라이브러리·시즌 캘린더·기업 매칭) + 이메일/소셜 계정. 배포본 대상 **합성 페르소나 20인 UT 를 2세션 실행**해 생성 60/60 성공을 확인했다(`docs/research/ut-agent/`).
> **최종 검증(2026-08-21):** `npm run typecheck` 0 오류 · `npm run test` **322/322 통과**.
>
> **읽는 순서** — 이 문서는 "지금 어디까지 왔고, 어떻게 돌리고, 무엇이 남았나"만 담는다. 계획 대비 진척은 [[09-dev-spec]] §4~§4d 체크박스, 데이터 계약은 [[08-data-flow]], 제품 정의는 [[specs/01-report-spec]], 배포는 [[11-deploy-spec]]·[[deploy-runbook]], UT 결과는 [[research/ut-agent/results/UT-리포트]] 가 정본이다.
>
> ### 이력 요약
> - **2026-07-09** 기능 검증 빌드 — 랜딩 + ① 리포트 한 사이클(실 LLM E2E 통과).
> - **2026-07-16** 검수 단계 제거(파이프라인 성공 = 발행) · 보고용 슬라이드 · **입력 브랜드 우선 재구성(v4 — 두 진단 모드 `brand`/`brandProduct`)**.
> - **2026-07-21** 스프린트 2 — 목 로그인 · 앱 셸 · **② 썸네일 실생성** · **③ 운영 3화면** · 계정(§1b).
> - **2026-07-24** 배포 준비 — Supabase Storage 전환 · 서버리스 설정 · 인증 배포 가드.
> - **2026-08-10~11** **② 상세페이지 생성** 신설 + 배포 대응(§1b).
> - **2026-08-18~21** 일출 코랄 DS 전면 전환 · 시즌 캘린더 · 홈 D-day 히어로 · 콜⑩ 한국어 윤문 + 리포트 모델 상향 · **잡 시간 예산 가드** · **AI 에이전트 UT 실행·반영**(§1c).
>
> ### ⚠ 코드가 따라가지 못한 스펙 (그대로 남았다)
> **2026-07-18 v6 스펙 개정 — 코드 미반영.** 스펙·와이어프레임은 **블록 6 재프레이밍**(리뷰 인과 서사 → 정보 공백→이탈 경로)·**블록 7·8 통합**·**블록 9→8 재번호**(리포트 = 블록 0~8)로 갔으나, **아래 구현 현황과 배포본은 개정 전 코드(블록 0~9 · `reviewNarrative` 스키마 · 블록 7/8 분리) 기준**이다. UT 도 이 코드 기준으로 돌았다. 정본: [[specs/01-report-spec]] v6 · [[08-data-flow]] v6.
> 디자인: 초기 "기능 검증용 미니멀 UI" 전제는 2026-08-18~19 **일출 코랄 디자인 시스템 전면 적용**으로 종료됐다 — 정본 `design/DESIGN.md` · `design/lp-components-spec.md`.

---

## 1. 한눈에 — 지금 돌아가는 것

| 구분 | 상태 |
|---|---|
| 메인페이지(랜딩) | ✅ 확정 카피 12섹션(`public-onboarding-spec` §1 그대로) · Stats 수치 비노출 규칙 준수 |
| ① 리포트: 진단 입력폼 | ✅ **브랜드 섹션 필수**(브랜드명 · 포지셔닝 = 택소노미 태그 1~5(16종, `rules/positioning.ts`)+자유 서술 · 카테고리) + **제품 섹션 전부 선택**(접이식 — 분류·제품명·성분·가격·상세 콘텐츠) · **50자 하드게이트(버튼 잠금 + 서버 400)** · 200자 미만 "정밀도 제한" 안내 · 서버 이중 검증 6종 400 확인 · `reviewSourceUrl` 폼 제거(데드필드) |
| ① 리포트: 생성 파이프라인 | ✅ 규칙 5단계 + **LLM 4콜**(①②③ 병렬 → 집계 → ④) **+ 조립 후 윤문 콜⑩** · `claude-opus-5` 구조화 출력 + 콜별 `effort` · 프롬프트 캐싱 · 콜별 폴백 · **출력 언어 계약 검사**(부분 표류=교정, 통째 표류=폴백) · **`brand` 모드는 콜③ 1콜만**(stages `persona → benchmark → assemble → humanize` · **콜③ 실패 = 잡 실패**) |
| ① 리포트: 9블록 뷰 | ✅ 블록0~9 전부 렌더(품의 표지·감사표·A~E 점수·NG/OK JP+KR 병기 카드·고정가 퍼널) · **`brand` 모드는 블록 1·3·5·7·8 데이터 잠금**(종합점수 없음 · 대비표 "내 콘텐츠" = 미확인) |
| 발행 | ✅ 파이프라인 성공 = `published` (잡이 직접 세팅). ~~검수 큐·실명 서명~~ 제거(2026-07-16) |
| 보고용 슬라이드 | ✅ 발행 리포트 → 버튼 → 콜⑤(카피) + 코드 렌더 → 단일 HTML 다운로드 (스펙 §10) · **골격 모드별**: `brandProduct` 7장 / `brand` 4장(표지·포지셔닝/USP·벤치마크·다음 단계) |
| 상태 머신 | ✅ `submitted → processing(단계 표시) → published / failed` (08 §3.3) |
| 저장 | ✅ Supabase 구현 + **`.data/` 파일 폴백**(키 없으면 자동, UI에 "로컬 저장(dev)" 배지) |
| 목(mock) 모드 | ✅ `ANTHROPIC_API_KEY` 없거나 `LLM_MODE=mock`이면 고정 픽스처로 전체 플로우 확인 가능(화면에 배지) |

**미구현(다음 작업, §5):** PDF 내보내기 · 무료 약기법 체커 · ~~인증/온보딩~~(→ 목 로그인으로 대체, 실 OAuth는 잔여) · **결제 잠금(샘플 경계) 집행** · S2 재진단 뷰 · ~~②③축~~(→ §1b에서 구현).

## 1b. 스프린트 2 — ② 실생성 + ③ 운영 + 계정 (2026-07-21)

| 구분 | 상태 |
|---|---|
| 계정: 목 로그인 | ✅ `/login` 소셜 3종 버튼(카카오·네이버·구글) — **실 OAuth 미연동, 클릭 = 세션 쿠키 발급**(httpOnly 1개 · 데모 유저 1명 하드코딩) · `/app/*` 가드는 `app/app/layout.tsx` 1곳(비로그인 → `/login`, middleware 없음) · ✅ **해소(2026-07-23, §1c)** — 이메일 인증 + 비회원 열람 + 실행 직전 게이트가 실제로 구현됐다. **소셜 3종만 목으로 남았다** |
| 앱 셸 | ✅ `components/app/AppShell.tsx` 사이드바(3축 내비 + 운영 하위 아코디언 + 계정 행 + 매칭 상태 배지) · `/app` → `/app/library` 리다이렉트 · 기존 리포트 2화면 셸 안에서 리그레션 없음(E2E 확인) |
| 파일 저장 | ✅ 로컬 `.data/files/{prefix}-{uuid}.{ext}` + `GET /api/files/[id]` 서빙 — 스토어에는 fileId만. Supabase Storage 전환 시 `lib/files/storage.ts` 내부만 교체 |
| ② 썸네일 생성 | ✅ 생성 퍼널(`/app/studio/thumbnail` — 드롭존·플랫폼 칩·템플릿 8종 실측 그리드·실적 아코디언·sticky 제출) → **콜⑥ studioCopy**(Claude 비전 1콜: 분석+카피 재설계+슬롯) → 결정적 조립(`buildPrompt` + proof 게이트 + 가격 슬롯 강제 공란, 단위테스트 7건) → **OpenAI `images.edit`**(모델·품질 env 주입 — `input_fidelity`는 지원 모델에만 조건부, gpt-image-2는 항상 고정밀 처리라 미지원·불필요) → `.data/files/` 저장 → 결과 상세(`[assetId]` 2.5초 폴링: 생성중→done 게이트 배지·재설계 해설·다운로드→failed 프리필 재시도) |
| **② 상세페이지 생성** | ✅ **2026-08-10 신규.** 생성 퍼널(`/app/studio/detail` — 이미지 1~10장·상품종류·템플릿 6종·제품 스펙·조건 입력) → **블록 구성 확인 단계**(빠진 블록과 사유를 접지 않고 노출) → **콜⑦ detailCopy**(Claude 비전 1콜로 전 블록 슬롯) → 결정적 조립(`planBlocks` 게이트 + 각주 레지스트리, 단위테스트 20건) → **하이브리드 렌더**(gpt-image-2 배경컷 ≤4장 동시성 4 + satori 벡터 문자) → **sharp 세로 결합 + 몰 규격 분할** → 결과 상세(블록 n/N 진행률·블록별 재생성·결합본/분할본 2종). 실 LLM E2E 통과(약 130~155초/건). **2026-08-11 배포 대응 완료** — 제출 전 프리플라이트(마이그레이션·폰트·키·Storage 미비를 사유+조치와 함께 차단) · 저장 부피 건당 12.4MB→3.09MB · 폰트 트레이싱 빌드 검증. 운영 절차는 [[11-deploy-spec]] §3-1 · [deploy-runbook](deploy-runbook.md) §6-A |
| ② 목 모드 | ✅ `OPENAI_API_KEY` 없거나 `IMAGE_MODE=mock` → 실측 샘플 PNG 픽스처(콜⑥은 `LLM_MODE` 목 규칙 그대로) — 키 전무 상태로 전체 플로우 확인 가능. 모델 ID는 실검증으로 `gpt-image-2` 확정(2026-07-21, 스펙 §6-Q1 해소 — `OPENAI_IMAGE_MODEL`로 오버라이드 가능), **팩 §5 골든 픽스처 실검증은 잔여** |
| ③ 자산 라이브러리 | ✅ `/app/library` 타입 탭 [진단 리포트\|썸네일] + 시즌 제안 카드(정적 상수) + 생성중 타일 + 빈 상태 — 재조회 전용(실시간 폴링 없음, 새로고침 반영) · `/app/library/[assetId]` 썸네일/리포트 요약 2모드(생성중은 폴링 화면으로 리다이렉트) |
| ③ 브랜드 관리 | ✅ `/app/brand` 4섹션(프로필·제품·채널·브랜드 킷) `GET·PUT /api/brand` + 상세페이지 문서 업로드(`POST /api/brand/doc`) · 킷 수정 불소급 캡션 · 생성 시 `brandNameSnapshot` 물질화 확인 |
| ③ 기업 매칭 | ✅ `/app/matching` 신청 폼(자동 첨부 요약 스냅샷) → 상태 스테퍼 → 취소 모달, `GET·POST·DELETE /api/matching` — 상태 갱신은 운영팀 수동(reviewing·proposed는 DB에서 직접) |
| 계정: 마이페이지 | ✅ `/app/account` 계정 정보(provider 배지)·플랜 목업(FREE)·브랜드 요약(편집은 ③으로 링크)·로그아웃 |
| 저장 확장 | ✅ `Store`에 `BrandProfile`(싱글턴)·`GeneratedAsset`·`MatchRequest` + list 조회 — fileStore·supabaseStore 동시 구현, `supabase/schema.sql` 3테이블 멱등 추가 |
| 검증 | ✅ typecheck 0오류 · 테스트 37/37 · `next build` 전 라우트 통과 · **목 HTTP E2E 통과**(로그인→브랜드 저장→썸네일 생성 done·이미지 서빙→라이브러리 탭·상세→매칭 신청·취소→마이페이지→리포트 발행 리그레션→로그아웃 가드) |

**스프린트 2 잔여(2026-08-21 기준 재확인):** OpenAI 팩 §5 골든 픽스처 실검증(모델 ID는 `gpt-image-2` 확정 — 2026-07-21) · `.env.example` 키 추가(이 머신은 `.env*` 편집이 차단됨 — 키 이름은 [[09-dev-spec]] §1) · 매칭 상태 갱신 운영 도구 · **실 OAuth 전환** — 넷 다 그대로 남았다. ~~인증·비회원 게이트~~는 §1c 에서 해소.

## 1c. 2026-07-23 ~ 08-21 — 실 인증 · 코랄 DS 전환 · 운영 확장 · UT

> §1b 이후 들어온 것. **여기서 §1b·§5 의 "잔여"로 적혀 있던 항목 여럿이 실제로 해소됐다.**

| 구분 | 상태 |
|---|---|
| **계정: 실 인증(2026-07-23)** | ✅ **목 세션 → 실 인증 전환** — `users`·`auth_tokens` 엔티티 + 비밀번호 해시 + 서명 세션 · 이메일 회원가입/로그인/인증메일/비밀번호 재설정 화면·API 6종(`/api/auth/email/*`) · **비회원 열람 + 실행 직전 로그인 게이트**(GATE-00~04 — 로그인 벽이 "진입 시점"에서 "실행 시점"으로 이동) · 유저 브랜드 스코핑 + 리포트 생성 401 게이트 · 상세 라우트 **소유 검증**(타 유저 직접 URL 접근 차단). **소셜 3종은 여전히 목**(`POST /api/auth/login` — 버튼 클릭 = 세션 발급, 실 OAuth 미연동) |
| **제품 엔티티(2026-07-23)** | ✅ `products` 테이블 + `GET·POST /api/products` · `PUT·DELETE /api/products/[id]` + 이미지 복수 업로드(첫 장 자동 대표) — 브랜드 관리 BRAND-03. `Store` 에 `listProducts`·`createProduct`·`updateProduct`·`deleteProduct` |
| **① 리포트 이미지 입력 · 3탭(2026-07-23)** | ✅ 콜⓪ 비전 추출(이미지 1~10장 → 텍스트) + 리포트 열람 3탭 하이브리드(표지·요약 상단 고정 / 시장·진단·처방) |
| **/lp 검증 랜딩(2026-07-23~24)** | ✅ `app/lp/page.tsx` + `POST /api/lead`·`/api/track` — Before/After 시연·스크롤 리빌. 실험 설계는 `docs/experiments/2026-07-22-lp-validation.md` |
| **② 상세페이지 강화(2026-08-11)** | ✅ 한국어 입력 자동 변환 + 템플릿 실물 프리뷰 · 배경컷 연출 강화·카테고리별 샷 플랜(팩 v1.3.0) · 코퍼스 3.2배 확장 + 27블록 분류 체계 · **성능 개정**(요청당 스토어 왕복 `5+2N`→`3+N` · 라우트 스코프 트레이싱 · 폴링 백오프 — [[09-dev-spec]] 변경 이력 2026-08-11) |
| **리브랜딩 YOAKE(2026-08-18)** | ✅ `KGLOW` → `YOAKE` 전면 치환(로고·네이밍·코드·문서) · `components/brand/Logo.tsx` `YoakeLogo`·`YoakeMark` · 쿠키·저장 키 포함. 근거 [[decisions/2026-08-18-리브랜딩-yoake]] |
| **일출 코랄 DS 전면 전환(2026-08-18~19)** | ✅ 랜딩·앱 셸·와이어프레임·생성 자산·문서가 **한 팔레트**를 쓴다 — 잉크 `#182333` · 코랄 `#FF6F61`(면) · `coral-strong #C93F2E`(소형 텍스트). 구 스티비 coral `#ff6464`·`#d93636` 폐기 · 사이드바 내비를 `LP_Components` 시트 `SidebarNavItem` 상태에 정렬 · 시안 자산(LP_Nonmember_Desktop_v2) 투입 · 일러스트 8종. 근거 [[decisions/2026-08-18-일출코랄-DS전환]] · [[decisions/2026-08-18-앱셸-랜딩-팔레트-통일]] |
| **카테고리 라벨 정본화(2026-08-19)** | ✅ 제품분류 선택지·라벨 정본을 한 곳으로 모으고 한국어 단독 통일 |
| **③ 시즌 캘린더(2026-08-19)** | ✅ `/app/season` + `GET·POST /api/season/memo` · `PUT·DELETE /api/season/memo/[id]` (`season_memos` 테이블) — 운영 메뉴가 4개로(브랜드 관리 → 자산 라이브러리 → 시즌 캘린더 → 기업 매칭) |
| **홈 D-day 히어로(2026-08-20)** | ✅ `/app` 머리를 시즌 D-day 히어로로 개편 + 빈·예외 상태 보강 |
| **① 출력 언어 계약 · 모델 상향 · 콜⑩(2026-08-19)** | ✅ 리포트 콜 전부 `claude-opus-5` 상향(② 스튜디오는 `claude-sonnet-5` 유지) · 출력 언어 계약 강제(부분 표류=교정, 통째 표류=폴백) · **조립 후 한국어 윤문 콜⑩** 신설 |
| **① 잡 시간 예산 가드(2026-08-21)** | ✅ `lib/engine/reportBudget.ts` — `REPORT_BUDGET_MS = 270_000` · `StructuredCallOptions.timeoutMs` · 콜⑩ 진입 전 잔여 시간 검사(부족하면 윤문만 건너뛰고 **발행은 반드시 한다**) · 콜⑩ 청크 병렬. **UT 1차 리포트 0/20 → 2차 20/20 복구** |
| **AI 에이전트 UT 실행 도구(2026-08-21)** | ✅ `scripts/ut/` — 계정 프로비저닝·캡처·배치 실행·자유 탐색 드라이버·집계. 배포본을 합성 페르소나 20인이 실제로 돌았다. 계획·프롬프트·결과 전량 `docs/research/ut-agent/` |
| **이미지 비용 계기(2026-08-21)** | ⚠️ **모듈만 존재 · 배선 없음** — `lib/studio/imageCost.ts`(단가 계산·집계 순수 함수 + 단위 테스트)는 있으나 **호출부가 0곳이고 `generated_assets.image_usage` 컬럼도 스키마에 없다.** `usage` 없으면 `null` 반환(추정 금지). 그래서 UT 에서 실단가를 측정하지 못했다 |
| **저장 확장** | ✅ `supabase/schema.sql` **13 테이블** — `diagnosis_requests`·`reports`·`llm_call_logs`·`brand_profiles`·`generated_assets`·`match_requests`·`leads`·`track_events`·`products`·`users`·`auth_tokens`·`asset_blocks`·`season_memos` |
| **다중 브랜드** | ⛔ **철회(2026-08-18)** — 계정당 브랜드 1개. `lib/server/activeBrand.ts` 해석기 하나만 남겨 두고 호출부 20+곳은 그대로 뒀다(과거 데이터에 2건 이상 남아 있어도 "가장 최근 1건"으로 결정론적으로 좁힌다) |

**2026-08-21 최종 검증:** `npm run typecheck` 0 오류 · `npm run test` **322/322**(스위트 39) · 배포본 UT 생성 **60/60**(리포트·썸네일·상세 각 20).

## 1d. 2026-08-22 ~ 08-31 — 협업 기반 (Phase 0-G)

> 기능이 아니라 **팀이 같은 산출물을 계속 만질 수 있게 하는 바닥**. Phase 0 의 마지막 구간이다.

| 구분 | 상태 |
|---|---|
| **응답 속도(2026-08-22)** | ✅ 함수 리전 **서울 이전** · `loading` 경계 · 라우터 캐시 — 페이지 이동 지연 제거(`3963d10`) |
| **환경 축 브랜치(2026-08-24)** | ✅ `main`(=prd·보호) · `stg`(=QA 배포·보호) · `dev`(=통합) 으로 재편, 작업자 이름 브랜치 폐지. 승격은 `dev`→`stg`→`main` **merge commit** 전용 · 마이그레이션 대상 표시 + 환경 확진 진단 노출(`4724a5a`·`6f5c3f2`). 규칙 정본 = [CONTRIBUTING](../CONTRIBUTING.md) · 근거 [[decisions/2026-08-22-환경분리-브랜치전략]]. ⚠ **DB 분리는 보류** — `stg` 도 운영 Supabase 를 쓴다 |
| **PR 검증 게이트(2026-08-24)** | ✅ GitHub Actions — PR 에서 `typecheck` · `test` · `build` 통과를 병합 조건으로(`60afdc0`) |
| **코드 포맷(2026-08-24)** | ✅ Prettier 도입 → 전면 적용 → CI 포맷 검사 연결(`0882805`·`86fb2be`·`52dea7a`). 대상은 `**/*.{ts,tsx,mjs}` — **`*.md` 는 `.prettierignore` 로 제외**(한국어 표·문단이 재배치되면 읽기 나빠진다). 기계 적용 커밋은 `.git-blame-ignore-revs` 등록 |
| **문서 지식베이스(2026-08-31)** | ✅ Phase 축 도입 + `docs/README.md` 홈 · 영역 인덱스 · 문서 속성(상태·오너·갱신일·Phase) · 검증 스크립트 `npm run docs:check`. 규약 = [CONVENTIONS](CONVENTIONS.md) |

## 2. 실행 방법

> ⚠ **이 머신 특이사항**: 한글 경로에서 대용량 JS 실행이 보안SW에 차단됨(2026-07-09 규명 — [CONTRIBUTING 트러블슈팅](../CONTRIBUTING.md)). **소스 수정·git = 이 폴더(원본)**, **실행·검증 = 영문 경로 미러**로 분리한다. 정상 머신에서는 원본에서 바로 실행하면 된다.

```powershell
# 1) (수정 후마다) 원본 → 미러 동기화 (증분, 수 초)
robocopy "c:\Users\user\문서\문서\Claude\Projects\이너서클_일본확장 MVP" "C:\dev\jgs-run" /MIR /XD .git .next .tmp-node .data node_modules\.cache

# 2) 미러에서 실행
cd C:\dev\jgs-run
npm run dev          # → http://localhost:3000
npm run typecheck    # 타입 검사
npm run test         # 집계 결정성 테스트 (tsc 컴파일 → node --test)
npm run report:cli    # 화면 없이 ① 파이프라인만 (cica 픽스처)
npm run thumbnail:cli # 화면 없이 ② 썸네일 파이프라인만 (--style A~H · --platform · --proof)
npm run detail:cli    # 화면 없이 ② 상세페이지 파이프라인만
                      #   목 모드: npm run detail:cli
                      #   실 모드: npm run detail:cli -- --image <제품컷> --category skincare --platform rakuten-official
                      #   재검증(이미지 비용 0): 위 명령에 --reuse-visuals
                      #   산출: .data/detail-cli/{master.jpg, slice-NN.jpg, block-NN-*.png, plan.json}
npm run aggregate     # 코퍼스 갱신 시 사전집계 재생성
```

환경 변수(`.env`, [.env.example](../.env.example) 참조): `ANTHROPIC_API_KEY`(없으면 목 모드) · Supabase 3종(없으면 파일 폴백 — 셋업은 [setup-supabase.md](setup-supabase.md) 3단계) · **스프린트 2 추가**: `OPENAI_API_KEY`(없으면 이미지 목 모드) · `IMAGE_MODE=mock`(강제 목) · `OPENAI_IMAGE_MODEL`(기본 gpt-image-2) · `OPENAI_IMAGE_QUALITY`(기본 medium).

**클릭 동선(E2E와 동일):** `/` 랜딩 → `무료 진단 시작` → 폼 입력·제출 → 진행 화면(자동 폴링) → **발행 완료 배너 + 리포트 열람** → `보고용 슬라이드 만들기` → HTML 다운로드. (2026-07-16: ~~검수 전 배너 → `/admin/review` 실명 서명~~ 경로 제거)
**브랜드 진단 동선(v4 신규):** 같은 폼에서 **브랜드 섹션만**(브랜드명·포지셔닝·카테고리) 입력·제출(제품 섹션 비움 = 에러 아님) → 동일 진행 화면 → 발행(`mode: brand` — 블록 1·3·5·7·8 데이터 잠금·종합점수 없음) → 슬라이드 **4장** 다운로드.

## 3. 코드 맵 (신규 자산)

```
app/
  page.tsx                        # 랜딩(확정 카피 12섹션)
  app/report/new/page.tsx         # 진단 입력폼 — 브랜드 필수(포지셔닝 태그 칩 포함)/제품 선택 (50자 게이트·dev/목 배지)
  app/report/[id]/page.tsx        # 상태 폴링 로딩 → 9블록 뷰 + 슬라이드 내보내기 버튼
  api/report/route.ts             # POST 제출(서버 재검증)+after() 잡 킥오프 · GET 모드 메타
  api/report/[id]/status/route.ts # 상태 폴링(published면 리포트 동봉)
  api/report/[id]/slides/route.ts # 보고용 슬라이드 HTML 다운로드(동기·콜⑤+렌더) — 스펙 §10
components/report/ReportView.tsx  # 9블록 렌더 (blocksJson 계약 — 08 §3.4)
lib/
  engine/                         # ① 파이프라인 — Next 독립 순수 TS (09 §3 구조 그대로)
    types.ts · rubric.ts          #   계약 타입 · A~E 루브릭/가중치 상수(정본 그대로)
    schemas.ts                    #   콜①~④·체커 출력 JSON 스키마 (08 §4)
    rules/                        #   normalize(K1..Kn 분해)·presignals·aggregate(+test)·benchmark(+test)·assemble·slides(+test)
    │                             #   + gates.ts(+test) — 게이트 단일 정의(50자/200자/URL) · positioning.ts — 포지셔닝 택소노미 16종
    grounding/index.ts            #   사전집계·규정요약·렉시콘 로더 + 콜별 system 프리픽스
    llm/client.ts                 #   모델·effort 지정 + output_config + 캐싱 + 목 모드 + validate/repair 2단 재시도 + refusal 분기
    llm/languageCheck.ts          #   출력 언어 계약 검사(ko/ja 정책 · 통째 표류 판정)
    lang.ts                       #   한국어 우세 비율·한글/가나 판정·숫자 지문(①②축 공용)
    rules/evidenceGate.ts         #   증거 원칙 위반 후보 검사(결정적 · 비차단 경고)
  report/humanizeReport.ts        # 콜⑩ 한국어 윤문 — 사후 검사 7종, 반려분은 원문 유지
    llm/calls.ts · fixtures.ts    #   콜별 페이로드/검증 · 목 픽스처(결정적 휴리스틱)
    pipeline.ts                   #   병렬 실행·폴백 규칙(콜② 실패=잡 실패)
  db/store.ts                     # 저장 인터페이스 (08 §6 간소화: 감사문장은 blocksJson 내)
  db/supabaseStore.ts · fileStore.ts
  server/reportJob.ts             # 상태 전이 잡 러너
  logger.ts                       # console.log 금지 대체
scripts/
  aggregate/aggregate-benchmark.mjs  # detail-ocr 312건 → 사전집계(빈도≥2 필터)
  run-report.ts                      # 엔진 CLI 러너
data/processed/
  benchmark-aggregates.json       # skincare 90·makeup 92·suncare 73·cleansing 57 (신규 산출)
  regulatory-summary.json         # ⚠ v0 미검토 — 조항 [1]~[7]+등급 프레임 (콜②·블록9 근거)
supabase/schema.sql               # 테이블 3종 + RLS · `reports.overall_score` nullable(v4 — 신규 create + 멱등 마이그레이션 블록) · docs/setup-supabase.md
```

설정: `tsconfig.json`(Next 자동수정 반영) · `tsconfig.node.json`(CLI/테스트용 CJS 컴파일) · `next.config.ts` · `postcss.config.mjs` · package.json scripts(기존 `crawl:*` 보존). `detail-ocr.jsonl` 복구됨.

## 4. 검증 결과 (누적 — 아래로 갈수록 최신)

| 검증 | 결과 |
|---|---|
| `npm run typecheck` | ✅ 0 오류 |
| `npm run test` (node:test) | ✅ 5/5 — 집계 결정성(AC-2.2)·E군 분모 제외(AC-2.3)·가중치 합=1.00·공식 스팟체크 |
| CLI 목 모드 | ✅ 9블록 완성 · 16ms |
| **실 LLM E2E** (cica 카피 11문장) | ✅ 약 2분 · **종합 17/100** — 스펙 정본 샘플([[specs/01-report-sample-cica-ampoule]]) 18/100과 1점 차 · 감사 **불가 8·조건부 3·가능 0**(샘플 "11개 중 8개 위반"과 정합) · 재작성 5건(KR 역해설 포함, AC-3.1·3.2) |
| ~~발행 사이클(검수)~~ | ~~needsReview → 큐 → 실명 서명 → published~~ — **폐기(2026-07-16 검수 제거)** |
| 게이트 | ✅ 50자 미만 서버 400("최소 50자…") · 폼 버튼 잠금 · **단일 정의 = `lib/engine/rules/gates.ts`**(50자/200자/URL — 첫 단위 테스트 6건 포함, v4) · **빈 콘텐츠 = 브랜드 진단으로 제출**(게이트 미발동, 에러 아님) |
| **발행 사이클(2026-07-16 재검증)** | ✅ 목 모드 E2E — 제출 → `published` 도달(**관리자 조작 0회**) · 저장 레코드에 검수 필드 없음 · `publishedAt` 세팅 · 배지 `약기법 1차 스크리닝`(실명 검수 표기 제거) · 삭제 라우트 404 확인 |
| **슬라이드 내보내기(2026-07-16)** | ✅ 목 모드 E2E — 버튼 → 콜⑤ → 렌더 → HTML 다운로드(한글 파일명 정상) · 브라우저에서 열어 7장 내비게이션 확인 · **네트워크 요청 0건**(완전 무의존) · 콘솔 오류 0 · 발행 전 409 · 없는 리포트 404 · 대기/잠금/실패 UI 확인 |
| `npm run test` (2026-07-16 재실행) | ✅ 15/15 — 기존 집계 5 + `slides.test.ts` 10(숫자 출처·이스케이프·무의존·결정성·lang=ja) |
| `npm run typecheck` · `npm run test` (2026-07-16 v4) | ✅ typecheck 0 오류 · **30/30** — gates 6 · benchmark "미확인" 3 · slides 풀/브랜드 12 · aggregate 5 · 이스케이프 등 |
| **브랜드 진단 E2E (2026-07-16 v4 · 목 모드)** | ✅ 브랜드 섹션만 입력·제출 → **에러 0·관리자 조작 0으로 `published`** · `mode: brand` · block1 `scored: false` · 블록 3/5/7/8 null · 대비표 전 행 "미확인" · 퍼널 3단(① 브랜드 진단 (가격 미정) → ② 브랜드+제품 30만 → ③ 스튜디오 월 20만) |
| **브랜드 덱 다운로드 (2026-07-16 v4)** | ✅ **4장** · 외부 참조 0 · 점수 슬롯 0 · "미관찰" 0회 · 포지셔닝 슬라이드 렌더 · `filename*=UTF-8''HARUON-…` |
| **풀 모드 회귀 (2026-07-16 v4)** | ✅ 9블록 + 종합점수 + 감사 9문장 + 재작성 4 + **7장 덱** · 외부 참조 0 |
| **서버 이중 검증·경계 (2026-07-16 v4)** | ✅ 6종 400 확인(브랜드명/포지셔닝/미지 태그/카테고리/50자 하드게이트/URL 형식) · 미지 id 슬라이드 404 · CLI(mock) 완주 |
| **배포본 AI 에이전트 UT (2026-08-20~21)** | ✅ 합성 페르소나 20인 · 2세션 · 배포본 대상. **생성 60/60**(리포트 20/20 · 썸네일 20/20 · 상세 20/20) · 무효 응답 0건 · 이슈 71건 수집. 1차 리포트 0/20 → `c1f3d30` 후 2차 20/20 복구. 정본 [[research/ut-agent/results/UT-리포트]] |
| **최종 검증 (2026-08-21)** | ✅ `npm run typecheck` **0 오류** · `npm run test` **322/322 통과**(스위트 39) |

## 5. 알려진 한계 · 다음 작업

| # | 항목 | 내용 |
|---|---|---|
| 1 | **regulatory-summary v0 검토** | 조항 요약이 미검토(v0) — jp-localizer·약무 검토 후 `status: reviewed`로. 콜② 판정 품질의 근간 |
| 2 | ~~Supabase 전환~~ | **해소** — 배포본이 Supabase Free(Postgres 13테이블 + Storage 버킷 `files`)로 실제 운영 중이다. 로컬은 env 없으면 `.data/` 파일 폴백 그대로 |
| 3 | ~~`/admin/review` 보호~~ | **해소(2026-07-16)** — 화면 자체를 제거. 남은 인증 과제는 #6 |
| 3b | 🔴 **면책의 대가물 부재** | 검수 제거로 "법적 확정 판정 아님" 면책을 떠받치던 실명 서명이 사라짐. 30만 정당화·AI 불신층 전환 근거 약화 → **별도 결정 필요**([[decisions/DECISIONS]] 🔴) |
| 4 | PDF 내보내기 | 미구현 (09 M4 잔여 · 08 §8-D7) |
| 5 | 무료 약기법 체커 | 미구현 (stretch — 콜② 엔진·체커 스키마는 준비됨) |
| 6 | ~~인증·온보딩·프리필 · 이메일 가입·비회원 게이트~~ | **해소(2026-07-23 — §1c)** — `users`·`auth_tokens` 엔티티, 이메일 가입·로그인·인증메일·비밀번호 재설정, 비회원 열람 + 실행 직전 게이트(GATE-00~04), 유저 브랜드 스코핑·소유 검증까지 구현. **잔여는 실 OAuth 하나**(소셜 3종은 목 세션) |
| 7 | ~~비동기 잡 실행 모델~~ | **해소(2026-07-24)** — `after()`+폴링 유지, 큐 미도입. report·thumbnail `maxDuration=300` + 폴링 스테일 잡 가드(10분 초과 비터미널 → failed) 구현([[11-deploy-spec]] §3).<br>⚠ **"300초가 파이프라인(2~3분)을 수용"은 2026-08-20 실측으로 깨졌다** — 콜⑩ 신설 + `claude-opus-5` 상향(`055bf28`) 이후 **윤문 진입만 231초**(콜①②③ 102초 · 콜④ 107초)라 리포트가 한 건도 발행되지 않았다. **해소(2026-08-21)** — 잡 예산 가드 도입(`lib/engine/reportBudget.ts` · `REPORT_BUDGET_MS = 270_000`): 콜별 벽시계 상한으로 기존 폴백에 도달하게 하고, 시간이 모자라면 윤문만 건너뛰고 **발행은 반드시 한다**. 콜⑩은 청크 병렬로 예산 안에 들어온다 |
| 8 | 한글 경로 실행 차단 | 미러 우회 중 — 근본 해결(저장소 영문 경로 이전 or 보안SW 예외)은 **팀 결정 필요** |
| 9 | D1(Supabase)·D6(재현성) 팀 확정 | 기본안으로 구현했으나 `DECISIONS.md` 승격 기록·스펙 §9-Q5 갱신은 미완 (09 M0 잔여) |
| 10 | LLM 판정 편차 관찰 | `LlmCallLog` 저장 구현됨 — 동일 입력 N회 편차 리포트는 QA 단계 과제(08 §8-D6) |
| 11 | **결제 잠금(샘플 경계) 집행 미구현** | v4가 무료 = **샘플**(표지 + 요약 일부(종합점수 가림) + 페르소나 맛보기 — 두 모드 공통)·게이트 자리 = **샘플 → 풀 열람 직전**으로 **정의**했으나 집행은 MVP 미구현 — 현재 발행 리포트는 전체 열람(30만 진단이 실결제 없이 열람되는 상태와 동일하게 유지). 브랜드 진단 가격 **(미정)** — 스펙 §2 v4 · 08 §8-D2 |

### 5b. UT 가 새로 연 잔여 (2026-08-21 · P0 우선순)

> 근거 [[research/ut-agent/results/UT-리포트]] · [이슈-백로그](research/ut-agent/results/이슈-백로그.md) §E(P0 14 · P1 37 · P2 20). 대응 계획은 [[09-dev-spec]] **§4d M12-B~E**.

| # | 항목 | 내용 |
|---|---|---|
| 12 | 🔴 **폐루프가 화면에서 반증된다** | **UT-58** 상세 폼에 제품명 칸이 없어 생성기가 일본어 상품명을 스스로 지어 **리포트와 상세가 다른 제품을 말한다** · **UT-59** 리포트가 이미 만든 스튜디오 산출물을 안 보고 "미관찰·0점"으로 채점한다(스튜디오가 만든 상세에 리포트가 「쓸 수 없다」고 판정한 표현이 살아 있는데 못 잡는다). "한 서비스로 보인다" **4/20** — **서비스의 유일한 차별점이 걸린 항목이라 가장 먼저다** |
| 13 | 🔴 **랜딩과 앱이 다른 말을 한다** | **UT-27** 랜딩은 기업 매칭을 "지금 사용할 수 없다"고 못 박는데 앱에는 작동하는 신청 폼이 있다 — **20/20 지적 · 15/20 이탈 위기**(이번 UT 최다). P0 14건 중 **9건이 같은 유형** |
| 14 | 🟠 **리포트 예산 여유가 얇다** | **UT-60** `brandProduct` 가 270초 예산의 **77~96%**(유효 n=15 · 중앙 239초 · **최소 여유 10초**). 이번엔 `humanizeSkipped` 0건으로 완주했지만 API 지연이 조금만 겹치면 윤문이 잘린다 |
| 15 | 🟠 **9블록 중 4블록을 아무도 안 읽는다** | **UT-61** 블록4·5·6·8 스킵 사유가 예외 없이 "중복"이고 **블록5는 20명 중 읽은 사람이 0명**. 지우지 말고 접는 쪽 |
| 16 | 🟠 **사람 검수 표시 부재** | **UT-13·UT-64** 랜딩에는 "전문가 검토 단계로 전환할 수 있습니다"가 있는데 리포트·슬라이드·마이페이지 어디에도 흔적이 없다. AI 거부감군의 지불 조건이 정확히 이것 — §5 #3b(면책의 대가물 부재)와 같은 뿌리다 |
| 17 | 🟠 **이미지 실단가 미측정** | 단가 계산 모듈만 있고 **배선이 없다**(§1c) — 스키마 컬럼 추가 → 두 이미지 콜에 usage 기록 → `npm run db:push` → 소규모 재실행. **추정치를 원가 근거로 쓰지 않는다** |

## 변경 이력
- 2026-08-21 **스프린트 종료 갱신 — 최종 스냅샷**. **[추가]** §1c(2026-07-23~08-21 — 실 인증·제품 엔티티·콜⓪ 이미지 입력·3탭·/lp·상세 강화·리브랜딩·일출 코랄 DS 전환·시즌 캘린더·홈 D-day·모델 상향+콜⑩·잡 예산 가드·UT 실행 도구·이미지 비용 계기) · **§5b UT 가 새로 연 잔여 6건**. **[해소]** #2 Supabase 전환(배포본 운영 중) · #6 인증·비회원 게이트(실 OAuth만 잔여) · #7 잡 시간 예산(`c1f3d30`). **[검증]** typecheck 0오류 · 테스트 **322/322** · 배포본 UT 생성 60/60.
- 2026-07-09 신규 작성: 기능 검증 빌드(메인페이지+① 리포트 사이클) 구현·검증 완료 시점의 현황 스냅샷. 실 LLM E2E 결과(17/100, 정본 샘플과 1점 차)·코드 맵·실행 방법(한글 경로 미러 우회)·잔여 작업 10건.
- 2026-07-16 **v4 갱신**: **[변경] 입력 브랜드 우선 재구성** — 진단 입력폼(브랜드 필수: 브랜드명·포지셔닝(택소노미 16종)·카테고리 / 제품 전부 선택)·두 진단 모드(`brand`/`brandProduct`)·게이트 단일 정의 `gates.ts`·`reports.overall_score` nullable. **[추가]** 브랜드 진단 E2E(에러 0·관리자 조작 0으로 `published`·블록 1·3·5·7·8 잠금·대비표 "미확인"·4장 덱)·풀 모드 회귀(9블록·7장 덱)·서버 이중 검증 6종 400 — typecheck 0오류·테스트 **30/30**. **[신규 한계]** #11 결제 잠금(샘플 경계) 집행 미구현(경계 정의만 · 브랜드 진단 가격 (미정)).
- 2026-07-16 갱신: **[삭제] 검수 단계** — `/admin/review`·검수 API 2종·`signReport`/`rejectReport`/`listByStatus`·검수 3필드 제거, 상태 머신 4개로 축소, 파이프라인 성공 = 발행. 랜딩 FAQ의 서명 약속 카피 교체. **[추가] 보고용 슬라이드 내보내기**(스펙 §10). **[신규 한계] 3b 면책의 대가물 부재**(🔴).
- 2026-07-24 갱신: **[추가] 배포 준비(P0 6건)** — 파일 저장 Supabase Storage 전환(`lib/files/storage.ts` + `lib/db/supabaseClient.ts` 공유 헬퍼, 로컬 폴백 유지) · `AUTH_MAIL_MODE=devlink`(운영 인증 링크 화면 노출 — 가입 차단 해소) · `next.config.ts` outputFileTracingIncludes(`data/processed/**`·목 샘플 — 서버리스 ENOENT 방지) · report/thumbnail `maxDuration=300` · `engines.node 22.x` · 폴링 스테일 잡 가드. 호스팅 확정 Vercel Hobby + Supabase Free — 정본 [[11-deploy-spec]] · [[decisions/2026-07-24-호스팅-배포-결정]]. **한계 #7(잡 실행 모델) 해소**, #2(Supabase 전환)는 인프라 세팅만 잔여.
- 2026-07-24 **[개선] 인증 배포 가드 강화**: 배포본 이메일 가입/로그인 무동작 대응(원인=배포 env 미설정의 침묵 실패). `lib/db/store.ts` 프로덕션 Supabase env 누락 시 파일 폴백 대신 **명시적 throw**(빌드 페이즈 제외) · `mailer.ts`·`sessionToken.ts` 운영 **error 로그 승격**(`AUTH_MAIL_MODE`·`AUTH_SECRET` 미설정) · `GET /api/report`에 `misconfigured` 플래그(`hasSupabaseEnv` 기반, throw 회피) · `supabase/schema.sql` 상단 주석 함정(users 없음 오도) 교정. **typecheck 0오류 · 테스트 52/52**. 필수 env 3종 설정은 운영자 수동([[deploy-runbook]] §8·§1-B). [[11-deploy-spec]] §7·§8 갱신.
- 2026-08-11 ② 상세페이지 **결함 2건 수정 + 배포 대응**. [결함] 번호 배지 이중 표기(`CASE1`·`POINT1` — 팩 슬롯 설명 + 렌더 직전 `stripAutoLabel` 이중 방어) · 한 페이지에 서로 다른 제품이 섞이는 문제(AI 블록별 `productPresence` 를 팩이 소유 — 호출부 3곳 하드코딩 제거). 재생성으로 둘 다 확인. [정정] 8/10에 기록한 제품 라벨 열화(`GEL`→`GA`)는 원본 미대조 오기 — 원본이 처음부터 `GA` 였고 두 번의 실행 모두 자단위 보존됨. [배포] 프리플라이트·저장 포맷·트레이싱 정밀화.
