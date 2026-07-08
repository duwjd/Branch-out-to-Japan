# CLAUDE.md — 일본 시장 진출 브랜드 전환 스튜디오

> 이 파일은 **팀 전원과 모든 Claude Code 세션·에이전트가 공유하는 프로젝트 규칙**이다.
> 작업 판단이 흔들리면 이 문서와 `docs/00-positioning.md` 로 돌아온다.

## 한 줄 정의
한국 뷰티 브랜드의 상세페이지·SNS·광고 문구를 **일본 고객 관점으로 진단**하고, 일본향 **카피·콘텐츠·운영**을 한곳에서 다루는 **일본향 메시지 설계가 내장된 Japan Growth Studio — 뷰티 중소기업용 내부 운영 툴 웹 서비스**.

**포지션:** 일본 진출 전 콘텐츠 진단 & 일본향 콘텐츠 제작·운영 서비스.
**핵심 차별점:** 번역이 아니라 **일본 고객 관점의 메시지 재설계**.
**상품 구조:** 3축 — ① 진단 리포트 · ② 마케팅 스튜디오 · ③ 운영 (`docs/decisions/2026-07-04-상품-구조-구체화.md`).

## 현재 단계
- **빌드(개발 스프린트) 단계** — 3축 서비스를 **직접 개발**하기로 확정(2026-07-04, `docs/decisions/DECISIONS.md`). 개발 스프린트: 주말 리서치(7/5~7/6) → 데이터 수집·정제 → IA·플로우 설계 → 1차 개발(리포트 7/11~17 · 스튜디오 7/18~24 · 운영 7/25~31) → UT(8/1~8/3) → 개선·완성(8/4~8/9) → 발표.
- 자세히: `docs/04-roadmap.md`. 상품 구조: `docs/decisions/2026-07-04-상품-구조-구체화.md`.
- ① 진단 리포트 설계 자산(2026-07-08): 스펙 `docs/specs/01-report-spec.md`(9블록·티어 입력) · 심화 샘플 `docs/specs/report-sample-cica-ampoule.md` · 메시지 관례 루브릭 `docs/research/jp-detail-message-patterns.md` · 페르소나 검증 `docs/research/리포트샘플-페르소나-검증.md`. 데이터: `data/processed/detail-ocr.jsonl`·`sns-lexicon.csv`.
- 참고 자산: 페르소나 검증 랜딩 시안 `persona-simulation/landing/index.html`(비배포), 근거 문서 `docs/research/ 페르소나 검증형 MVP 실행안.md`.
- ※ 이전의 "컨시어지형 MVP · 랜딩 검증(Phase 1/2)" 로드맵은 빌드 전환 결정으로 대체됨. 기존 Next.js 앱 코드는 git 이력에 보존.

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

## 폴더 맵
- `docs/` — 기획 산출물(포지셔닝·리서치·PRD·페르소나·로드맵·열린질문·의사결정)
- `design/` — 디자인(디자인시스템·카피·와이어프레임)
- `persona-simulation/` — 페르소나 검증용 랜딩 시안·카피 팩·스크린샷·결과 기록 (비배포)
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
- `main` 보호. 기능 브랜치: `feat/…`, 문서: `docs/…`, 수정: `fix/…`.
- 커밋: Conventional Commits(`feat:`, `fix:`, `docs:`, `chore:` …).
- PR로 병합, 리뷰 1인 이상. 템플릿(`.github/pull_request_template.md`) 사용.
- 자세한 협업 방법: `CONTRIBUTING.md` (개발 머신 트러블슈팅 포함)
