---
title: CLAUDE.md — YOAKE (일본 시장 진출 브랜드 전환 스튜디오)
space: 프로젝트 기준
status: 정본
phase: Phase 0
updated: 2026-08-31
owner:
tags: [팀규칙, 에이전트]
---

# CLAUDE.md — YOAKE (일본 시장 진출 브랜드 전환 스튜디오)

> 이 파일은 **팀 전원과 모든 Claude Code 세션·에이전트가 공유하는 프로젝트 규칙**이다.
> 작업 판단이 흔들리면 이 문서와 `docs/00-positioning.md` 로 돌아온다.

## 서비스명 · 로고 (확정 2026-08-18 · 구 KGLOW에서 리브랜딩)
- 서비스명은 **YOAKE** — 전부 대문자, 붙여 쓴다. 고객 대면 이름은 이것 하나다.
  - 어원은 일본어 **夜明け(동트기·새벽)** — 일본 시장에서 브랜드가 처음 빛을 보는 순간. 심볼의 일출이 이 뜻이다.
  - 금지 표기: `Yoake` · `YO-AKE` · `Y.O.A.K.E` · `yoake`(도메인·핸들·파일명 제외). 일본어도 로마자 `YOAKE` 그대로 — 한자·가나 표기(`夜明け`·`ヨアケ`)는 어원 설명에서만 병기하고 이름 자리에 쓰지 않는다.
  - **구 이름 `KGLOW`는 전면 폐기.** 신규 산출물에 남아 있으면 즉시 교정한다(근거: `docs/decisions/2026-08-18-리브랜딩-yoake.md`).
  - 상위 포지셔닝은 **K-Beauty Japan Growth Studio**(한국어: K뷰티 일본 그로스 스튜디오) — 확정 2026-08-15. `Japan Growth Studio`는 **이름이 아니라 카테고리 서술어**이므로 단독으로 서비스명처럼 쓰지 않는다("YOAKE — K-Beauty Japan Growth Studio").
    - 영문은 반드시 `Japan Growth Studio`. **`Japanese Growth Studio`는 쓰지 않는다** — 일본식·일본계 스튜디오로 오해된다. YOAKE는 한국 브랜드의 일본 진출을 돕는 쪽이다.
  - **`ClaimOps`는 서비스 카테고리가 아니다.** 주장 분류·근거 연결·위험 상태·대체 표현·변경 이유·규정 버전·승인 이력을 담당하는 **내부 진단 엔진**을 가리킬 때만 보조적으로 쓴다("ClaimOps 기반 진단 엔진" · "주장·근거 진단 체계"). "YOAKE는 ClaimOps 서비스다", "최종 상품은 ClaimOps다"라고 정의하지 않는다. 로고·서비스명 옆에 붙이지 않는다.
- 로고 정본은 `design/brand/logo/` — **규칙은 `design/brand/logo/README.md`를 읽고 따른다**(변형·여백·최소 크기·금지 사항).
  - 코드에서는 SVG를 직접 import하지 말고 `components/brand/Logo.tsx`의 `YoakeLogo` · `YoakeMark`를 쓴다.
  - 로고 색과 UI 브랜드색은 **같다**(2026-08-18 전환, 근거 `docs/decisions/2026-08-18-일출코랄-DS전환.md`). 잉크 `#182333` = `--color-ink`, 일출 코랄 `#FF6F61` = `--color-coral`. 구 스티비 coral `#ff6464`·`#d93636`은 폐기 — 신규 산출물에 남아 있으면 교정한다.
    - 예외: **일출 그라디언트**(`#FF6F61`→`#FF9B70`)는 로고 심볼 전용이다. UI 면에는 단색 `#FF6F61`만 쓴다.
    - **면과 글자를 나눈다.** 면(버튼 배경·도트·아이콘)은 `coral`, 소형 텍스트·링크는 `coral-strong`(`#C93F2E`). 원색은 크림 위 2.6:1이라 글자색으로 쓰지 않는다. hover는 `coral-hover`, pressed는 `coral-pressed`.
    - 디자인 시스템 정본은 `design/references/LP_Components.svg`, 실측 스펙은 `design/lp-components-spec.md`.

## 한 줄 정의
**YOAKE** — 한국 뷰티 브랜드의 **카피와 근거를 진단**하고, 그 결과를 **일본 채널에 맞는 썸네일·상세페이지로 전환**하며, 이후 **현지 마케팅 회사·유통 채널 연결**까지 확장하는 **K-Beauty Japan Growth Studio**.

**현재 MVP 한 줄 정의:** 한국 뷰티 브랜드의 카피와 근거를 진단하고, 진단 결과를 일본 채널에 맞는 썸네일과 상세페이지로 전환하는 서비스.
**장기 비전:** 진단에서 제작, 현지 실행 파트너 연결까지 이어지는 일본 진출 운영 기반. — `Diagnose. Create. Connect.`
**핵심 차별점:** 번역이 아니라 **일본 고객 관점의 메시지 재설계**, 그리고 **진단 결과가 그대로 제작의 입력값이 되는 폐루프**. 검수만 하는 곳은 다시 만들지 않고, 만드는 곳은 근거까지 관리하지 않는다.
**상품 구조:** 3축 — ① 진단 리포트 · ② 마케팅 스튜디오 · ③ 운영 서비스 (`docs/decisions/2026-07-04-상품-구조-구체화.md`).
- **① + ②가 현재 MVP다.** 진단 리포트만 MVP인 것처럼 쓰지 않는다.
- **③ 운영 서비스는 MVP 이후 확장 가설** — 브랜드에게 적합한 **일본 마케팅 회사·유통 채널을 소개·연결**하는 서비스로 재정의(2026-08-15). 현재 구현된 기능처럼 쓰지 않으며, `MVP 이후`·`확장 가설`로 표시한다. YOAKE가 광고 집행이나 유통을 직접 수행하지 않고, **유통 입점·광고 성과·판매 실적을 보장하지 않는다**.

## 현재 단계 — Phase 0 종료 (2026-08-31)

- **지금까지의 개발 전체 = `Phase 0` (MVP 빌드, 2026-07-02 ~ 08-31).** 3축을 직접 개발하기로 확정(2026-07-04)한 뒤 배포·UT·리브랜딩·협업 기반 정비까지가 한 덩어리다. **Phase 1 은 아직 정하지 않았다** — Phase 1 의 내용을 확정된 것처럼 쓰지 않는다.
- **Phase 정본 = `docs/04-roadmap.md`.** 구간(0-A~0-G)·무엇을 만들었나·종료 시점 미해결이 전부 여기 있다. 마일스톤 `M0~M12` 는 Phase 0 의 **실행 단위**이며 상세는 `docs/09-dev-spec.md` §4~§4d.
- **Phase 0 종료 판정:** 배포본에서 3축이 돌고 UT 를 마쳤다. 다만 **검증되지 않은 채로 종료했다** — 실사용자 수요·폐루프·지불 의사는 미검증이며 미결정 정본은 `docs/decisions/DECISIONS.md` "미결정" 절이다.
- **문서를 찾을 때는 지식베이스 홈 `docs/README.md` 부터 본다.** 영역별 인덱스와 문서 상태(정본/초안/이력/폐기)가 거기 있다. 문서 규약은 `docs/CONVENTIONS.md`.

**주제별 정본 (자주 쓰는 것)**
- 제품 정의 — `docs/00-positioning.md` · 상품 구조 `docs/decisions/2026-07-04-상품-구조-구체화.md`
- ① 진단 리포트 — 스펙 `docs/specs/01-report-spec.md` · 심화 샘플 `docs/specs/01-report-sample-cica-ampoule.md` · 메시지 관례 루브릭 `docs/research/jp-detail-message-patterns.md`
- 데이터 계약 — `docs/08-data-flow.md` (입력→가공→출력 E2E · LLM 콜별 요청/응답 §4 · 엔티티·저장 §6 · 화면↔데이터 §7)
- 어떻게 짓는가 — `docs/09-dev-spec.md` (스택·라우트 맵·모듈 구조·마일스톤)
- 무엇이 실제로 도는가 — `docs/10-implementation-status.md` (Phase 0 종료 시점 스냅샷 · 실행 방법 · 잔여)
- 배포 — `docs/11-deploy-spec.md`("왜·무엇") · `docs/deploy-runbook.md`("어떻게 클릭") · 환경 축 브랜치 `docs/decisions/2026-08-22-환경분리-브랜치전략.md`
- 검증 결과 — `docs/research/ut-agent/results/UT-리포트.md`
- 참고 자산: 페르소나 검증 랜딩 시안 `persona-simulation/landing/index.html`(비배포)

> ※ 2026-07-04 이전의 컨시어지 로드맵도 단계를 `Phase 1`·`Phase 2` 로 불렀다. **위 Phase 0/1 과 무관한 번호**다 — 옛 문서에서 만나면 "컨시어지 로드맵"으로 읽고, 신규 산출물에는 쓰지 않는다.

## 절대 하지 말 것 (금지 포지션)
아래로 흐르는 산출물/기획/카피는 즉시 교정한다. 각각 강력한 경쟁사와 정면충돌한다.
1. AI 광고 영상 생성툴 (Carat, Arcads, AdCreative.ai)
2. 쇼츠 자동 변환 서비스 (피카클립, AlphaCut, OpusClip)
3. 유튜브 채널 분석기 (vidIQ, TubeBuddy)
4. SNS 예약 발행툴 (Buffer, Metricool, Hootsuite)
5. 단순 일본어 번역 서비스 (DeepL, ChatGPT, 프리랜서)
6. 일본 진출 종합 대행 (AnyMind, transcosmos, @cosme)

> ※ 우리도 도구를 **만든다**. 다만 범용 자동생성/번역이 아니라, **일본 고객 관점의 메시지 재설계가 내장된 점**이 위 경쟁사와의 경계선이다. 산출물이 범용 자동생성·번역툴로 흐르면 즉시 교정한다.

## 우리가 가져갈 것
- 일본 고객 관점의 USP·구매 이유 재설계
- 대행사에 큰돈 쓰기 **전**의 사전 진단 상품
- 일본향 **메시지 설계·페르소나·USP 재정의가 내장된 도구를 직접 만든다** (범용 자동생성툴과 다른 지점)

## 기술 스택
- 빌드 스택: Next.js (App Router) · TypeScript · Tailwind CSS · npm. 저장소 루트 = 앱 루트.
- 페르소나 검증용 랜딩 시안은 의존성 없는 단일 HTML(`persona-simulation/`, 비배포).

## 문서를 찾는 법 (지식베이스)

**`docs/README.md` 가 문서의 출발점이다.** 폴더를 뒤지지 말고 거기서 시작한다 — 영역별 인덱스와 각 문서의 상태가 있다.

모든 문서는 상단 속성에 **상태**를 달고 있다(규약: `docs/CONVENTIONS.md`).

| 상태 | 어떻게 다루나 |
|---|---|
| **정본** | 지금 기준. 다른 문서와 어긋나면 이쪽이 맞다 |
| **초안** | 참고는 하되 **근거로 인용하지 않는다** |
| **이력** | 그 시점의 기록. 현재 기준으로 쓰지 않는다 |
| **폐기** | 읽지 말고 `superseded_by` 가 가리키는 문서로 간다 |

**어긋날 때 무엇이 이기나** — 무엇을 만드는가 `docs/00-positioning.md` · 지금 어느 단계인가 `docs/04-roadmap.md` · 무엇이 **실제로** 도는가 `docs/10-implementation-status.md` · 무엇을 만들기로 **했는가** `docs/09-dev-spec.md`·`docs/specs/` · 데이터 계약 `docs/08-data-flow.md` · 색·컴포넌트 `design/lp-components-spec.md` · 왜 그렇게 했는가 `docs/decisions/DECISIONS.md`.
**스펙과 코드가 다르면 코드가 사실이고 스펙이 의도다.**

문서를 새로 만들면 **해당 영역 인덱스에 한 줄 등재한다**. 등재되지 않으면 `npm run docs:check` 가 고아 문서로 잡는다.

## 폴더 맵
- `docs/` — 기획·설계·리서치·의사결정 문서 (**지식베이스 홈 = `docs/README.md`**)
- `design/` — 디자인(디자인시스템·카피·와이어프레임) / `design/brand/logo/` — **로고 정본 자산·사용 규칙**
- `persona-simulation/` — 페르소나 검증용 랜딩 시안·카피 팩·스크린샷·결과 기록 (비배포)
- `scripts/docs/check-docs.mjs` — 문서 규약 검사 (`npm run docs:check`)
- `.claude/agents/` — 역할별 에이전트, `.claude/commands/` — 슬래시 명령

## 에이전트 팀 & 호출 시점
| 에이전트 | 언제 |
|---|---|
| `lead-orchestrator` | 큰 작업 분해·배분·진척 관리 |
| `pm-planner` | 기획·PRD·범위·지표 (`/spec`) |
| `jp-localizer` | 카피·일본 메시지 재설계 (`/localize`) — **핵심 차별점** |
| `designer` | 화면 설계·디자인시스템 (`/design-page`) |
| `frontend-dev` | Next.js/React/Tailwind 구현 |
| `backend-dev` | API·데이터·연동 (운영·생성기 백엔드) |
| `qa` | 배포/PR 전 검증 |

슬래시 명령: `/kickoff`(온보딩) · `/spec` · `/localize` · `/design-page` · `/status`.

> **오케스트레이션:** 실제 조율은 메인 세션이 한다. 에이전트가 다시 에이전트를 부르는 중첩은 비용이 크므로 지양한다. `lead-orchestrator`는 "분해+배분 계획"을 반환하는 용도.

## 코딩 컨벤션 (전역 규칙 계승·강화 — 빌드 단계 적용)
- 변수·함수: **camelCase**. 함수에는 간단한 **JSDoc**.
- `console.log` 금지 → 로거 유틸 사용.
- 코드 변경 시 **변경 이유**를 간단히 설명한다.
- 에러 발생 시 **원인과 해결 방법**을 함께 제시한다.
- 접근성 기본(시맨틱 태그·label·색 대비·포커스), 타입 안전(`any` 지양).
- Server Component 기본, 상호작용 필요 시에만 `"use client"`.

## 일본 현지화 원칙
KR→JP는 **번역이 아니다**. 일본 고객의 신뢰 요소·구매 이유·소구점을 처음부터 재설계한다. 카피는 `jp-localizer`를 통해 다룬다.

## 협업 규칙
- **브랜치는 작업자가 아니라 환경으로 나눈다** — `main`(=prd, 보호) · `stg`(=QA 배포, 보호) · `dev`(=통합, 배포 없음).
  작업 브랜치는 `feat/…` · `docs/…` · `fix/…` 이고 **base 는 `dev`** 다. 승격은 `dev`→`stg`→`main` 순서이며 **merge commit**으로만 한다(squash 금지 — 다음 승격에서 유령 충돌이 난다).
  `main`에 뭔가 들어가면 즉시 `main`→`stg`→`dev` 역병합한다. **브랜치 규칙 정본은 `CONTRIBUTING.md`.**
- 커밋: Conventional Commits(`feat:`, `fix:`, `docs:`, `chore:` …).
- PR로 병합, 리뷰 1인 이상. 템플릿(`.github/pull_request_template.md`) 사용.
- 자세한 협업 방법: `CONTRIBUTING.md` (개발 머신 트러블슈팅 포함)
