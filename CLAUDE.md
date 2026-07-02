# CLAUDE.md — 일본 시장 진출 브랜드 전환 스튜디오

> 이 파일은 **팀 전원과 모든 Claude Code 세션·에이전트가 공유하는 프로젝트 규칙**이다.
> 작업 판단이 흔들리면 이 문서와 `docs/00-positioning.md` 로 돌아온다.

## 한 줄 정의
한국 뷰티 브랜드의 상세페이지·SNS·광고 문구를 **일본 고객 관점으로 진단**하고, 7일 안에 일본향 카피·콘텐츠 기획안·광고 소재 방향을 **스타터 키트**로 제공하는 컨시어지형 Japan Growth Studio.

**포지션:** 일본 진출 전 콘텐츠 진단 & 광고 소재 스타터 키트.
**핵심 차별점:** 번역이 아니라 **일본 고객 관점의 메시지 재설계**.

## 현재 단계
- **Phase 1 (지금): 랜딩페이지** — 광고→랜딩→무료 "5분 진단" 신청으로 수요 검증.
- Phase 2: 한 사이클을 경험하는 작동 서비스(범위 미정).
- 자세히: `docs/04-roadmap.md`

## 절대 하지 말 것 (금지 포지션)
아래로 흐르는 산출물/기획/카피는 즉시 교정한다. 각각 강력한 경쟁사와 정면충돌한다.
1. AI 광고 영상 생성툴 (Carat, Arcads, AdCreative.ai)
2. 쇼츠 자동 변환 서비스 (피카클립, AlphaCut, OpusClip)
3. 유튜브 채널 분석기 (vidIQ, TubeBuddy)
4. SNS 예약 발행툴 (Buffer, Metricool, Hootsuite)
5. 단순 일본어 번역 서비스 (DeepL, ChatGPT, 프리랜서)
6. 일본 진출 종합 대행 (AnyMind, transcosmos, @cosme)

## 우리가 가져갈 것
- 일본 고객 관점의 USP·구매 이유 재설계
- 대행사에 큰돈 쓰기 **전**의 사전 진단 상품
- 툴을 새로 만들지 않고 기존 AI 툴을 조합하는 **컨시어지형 MVP**

## 기술 스택
- Next.js (App Router) · TypeScript · Tailwind CSS · npm
- 저장소 루트 = 앱 루트. 모든 명령은 루트에서 실행.

## 폴더 맵
- `docs/` — 기획 산출물(포지셔닝·리서치·PRD·페르소나·로드맵·열린질문·의사결정)
- `design/` — 디자인(디자인시스템·카피·와이어프레임)
- `app/`·`components/`·`lib/` — Next.js 앱 코드
- `.claude/agents/` — 역할별 에이전트, `.claude/commands/` — 슬래시 명령

## 에이전트 팀 & 호출 시점
| 에이전트 | 언제 |
|---|---|
| `lead-orchestrator` | 큰 작업 분해·배분·진척 관리 |
| `pm-planner` | 기획·PRD·범위·지표 (`/spec`) |
| `jp-localizer` | 카피·일본 메시지 재설계 (`/localize`) — **핵심 차별점** |
| `designer` | 화면 설계·디자인시스템 (`/design-page`) |
| `frontend-dev` | Next.js/React/Tailwind 구현 |
| `backend-dev` | API·데이터·연동 (주로 Phase 2) |
| `qa` | 배포/PR 전 검증 |

슬래시 명령: `/kickoff`(온보딩) · `/spec` · `/localize` · `/design-page` · `/status`.

> **오케스트레이션:** 실제 조율은 메인 세션이 한다. 에이전트가 다시 에이전트를 부르는 중첩은 비용이 크므로 지양한다. `lead-orchestrator`는 "분해+배분 계획"을 반환하는 용도.

## 코딩 컨벤션 (전역 규칙 계승·강화)
- 변수·함수: **camelCase**. 함수에는 간단한 **JSDoc**.
- `console.log` 금지 → `lib/logger.ts` 사용.
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
- 자세한 협업 방법: `CONTRIBUTING.md`

## 자주 쓰는 명령어
- 개발: `npm run dev` · 빌드: `npm run build` · 린트: `npm run lint` · 타입체크: `npx tsc --noEmit`

## 로컬 환경 주의 (개발 머신 이슈)
일부 Windows 개발 머신에서 **네이티브 노드 애드온(.node) 로딩 시 세그폴트**가 발생해 `next dev`/`next build`/`eslint`가 크래시할 수 있다(대개 보안/백신 소프트웨어가 원인). 이 경우 로컬에선 `npx tsc --noEmit`로 타입만 검증하고, 실제 런타임은 CI 또는 정상 머신에서 확인한다. 해결책은 `CONTRIBUTING.md` 트러블슈팅 참고.
