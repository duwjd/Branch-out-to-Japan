---
title: design/ — 디자인 산출물
space: 디자인
status: 정본
phase: Phase 0
updated: 2026-08-19
owner:
tags: [디자인, 인덱스]
---

# design/ — 디자인 산출물

디자인 **단일 기준 = 일출 코랄 시스템** — 정본 시트 [references/LP_Components.svg](references/LP_Components.svg), 실측 스펙 [lp-components-spec.md](lp-components-spec.md), 토큰 구현 [`app/globals.css`](../app/globals.css). 면(CTA 배경·아이콘) `#FF6F61` · 면 hover `#F0594B` · 소형 텍스트·링크 `#C93F2E` · 틴트 `#FFF1EE` · 표면 웜 크림 `#FAF8F5` · 잉크 `#182333`. 모든 화면·와이어프레임은 이 시스템을 따른다.

> **팔레트 전환(2026-08-18).** 구 스티비 코랄 `#FF6464`/`#D93636`/`#FFF8F8` 팔레트는 폐기됐다 — 근거 [`docs/decisions/2026-08-18-일출코랄-DS전환.md`](../docs/decisions/2026-08-18-일출코랄-DS전환.md). [DESIGN.md](DESIGN.md)와 [handoff-landing-design-system.md](handoff-landing-design-system.md)·[design-system-plan.md](design-system-plan.md)는 **전환 이전 Figma as-built 기록**이라 구 색값이 그대로 남아 있다. 컴포넌트 인벤토리·상태 규약은 계속 참고하되, **색은 위 정본을 따른다.**

> 톤은 **코랄로 확정**(2026-07-09). 이전 "네이비 A안" 톤 탐색(`brand-tone-proposals.md`·`wireframes/tone-preview.html`)은 superseded(이력 보존). 리포트/산출물 와이어프레임도 코랄로 리스킨 완료.

## 폴더
- `references/LP_Components.svg` + `lp-components-spec.md` — **디자인 시스템 정본**(일출 코랄 토큰·컴포넌트 실측)
- `design-system.md` — 일출 코랄 토큰 문서(정본 요약)
- `DESIGN.md` — 컴포넌트 인벤토리·타이포·간격·상태 규약(**색은 전환 이전 as-built 기록**)
- `handoff-landing-design-system.md` — 랜딩 디자인시스템 인계(CTA 정책·Figma node id·접근성 — **색은 전환 이전 기록**)
- `design-system-plan.md` — 초기 토큰 계획(참고 · **색은 전환 이전 기록**)
- `copy/` — 랜딩·광고 카피 (KR 원안 → JP 재설계, `jp-localizer` 산출물)
- `references/` — 외부 레퍼런스(Stibee 코랄·Wanted 구조)
- `wireframes/` — 와이어프레임 + 핸드오프 명세

## 와이어프레임 목록 (`wireframes/`)
| 파일 | 화면 | 세그먼트 |
|---|---|---|
| `public-onboarding-wireframe.html` (+`-spec.md`) | 공개+온보딩 6화면 | 공통 |
| `app-wireframe.html` (+`app-spec.md`) | 앱 메인(대시보드) | 공통 |
| `report-wireframe.html` | 진단 리포트(입력+9블록) | S1 입점 전 |
| `report-wireframe-postentry.html` | 재진단 리포트(퍼널·리뷰 병목) | S2 입점 후 |
| `deliverable-proto-cica.html` (+`.standalone.html`) | 30만 산출물 프로토(상세+썸네일) | S2 |
| `ux-review.md` | 공개+온보딩 UX·접근성 점검 | — |
| `service-wireframe.html` | 서비스 전체 개관(구버전) | — |
| `tone-preview.html` | 톤 3안 비교 (superseded) | — |

## 워크플로우
- 화면 설계는 `/design-page`(→ `designer`)로 시작 → `frontend-dev`가 구현.
- 카피는 `/localize`(→ `jp-localizer`)로 일본 고객 관점 재설계 후 반영.
- 디자인 결정은 **DESIGN.md에서 확인**하고, 임의로 새 결정을 만들지 않는다.

## Figma 연동(선택)
팀이 Figma를 쓰기로 하면 이 세션에 연결된 Figma MCP로 design-to-code가 가능하다. 그 경우 `.claude/agents/designer.md`의 `tools`에 Figma MCP 도구를 추가한다.

---

## 문서 (전체 · 상태 포함)

> 상태 정의는 [문서 규약](../docs/CONVENTIONS.md) §4.
> **`references/` 의 Stibee·Wanted 문서는 외부 서비스를 기록한 레퍼런스이지 우리 기준이 아니다.** 특히 구 스티비 코랄(`#FF6464`)은 폐기됐다 — 색은 [lp-components-spec.md](lp-components-spec.md)가 정본이다.

| 문서 | 상태 | 갱신 | 태그 |
|---|---|---|---|
| [DESIGN — 컴포넌트 인벤토리·타이포·간격·상태 규약 (as-built)](DESIGN.md) | 📜 이력 | 2026-08-19 | [디자인, as-built] — 대체: design/lp-components-spec.md (색값 한정 — 컴포넌트·상태 규약은 계속 유효) |
| [감사 리포트 — Refined Landing v2 ↔ 디자인 시스템 정합성](audit-refined-landing-ds.md) | 📜 이력 | 2026-08-19 | [디자인, 감사] — 대체: design/lp-components-spec.md (감사 시점 팔레트가 폐기됨) |
| [YOAKE 브랜드 일러스트 — ChatGPT 생성 프롬프트 팩](brand/illustration/yoake-illustration-prompt.md) | ✅ 정본 | 2026-08-18 | [디자인, 일러스트, 브랜드] |
| [YOAKE 로고 — 자산 정본 & 사용 규칙](brand/logo/README.md) | ✅ 정본 | 2026-08-19 | [디자인, 로고, 브랜드] |
| [브랜드 무드·컬러 톤 제안 (3안)](brand-tone-proposals.md) | ⛔ 폐기 | 2026-07-09 | [디자인, 브랜드] — 대체: design/design-system.md |
| [copy/ — 카피 산출물](copy/README.md) | ✅ 정본 | 2026-07-02 | [카피, 인덱스] |
| [Design System Build Plan — Phase 1 Landing (최소치)](design-system-plan.md) | 📜 이력 | 2026-08-19 | [디자인, 토큰] — 대체: design/design-system.md |
| [디자인 시스템 (확정 · YOAKE 일출 코랄)](design-system.md) | ✅ 정본 | 2026-08-19 | [디자인, 토큰] |
| [Handoff — Landing Design System (Phase 1)](handoff-landing-design-system.md) | 📜 이력 | 2026-08-31 | [디자인, 랜딩, 핸드오프] — 대체: design/lp-components-spec.md (색값 한정 — CTA 정책·node id 는 계속 유효) |
| [LP_Components — 스펙 추출 (2026-08-18)](lp-components-spec.md) | ✅ 정본 | 2026-08-21 | [디자인, 토큰, 실측] |
| [Stibee — 외부 디자인 레퍼런스 기록](references/stibee-design.md) | ✅ 정본 | 2026-07-07 | [디자인, 레퍼런스] |
| [Wanted — 외부 디자인 레퍼런스 기록](references/wanted-design.md) | ✅ 정본 | 2026-07-08 | [디자인, 레퍼런스] |
| [앱 영역 · 와이어프레임 명세 (디자이너 핸드오프)](wireframes/app-spec.md) | ✅ 정본 | 2026-07-09 | [디자인, 와이어프레임] |
| [공개 영역 + 인증/온보딩 · 와이어프레임 명세 (디자이너 핸드오프)](wireframes/public-onboarding-spec.md) | ✅ 정본 | 2026-08-19 | [디자인, 와이어프레임, 랜딩] |
| [UX·엣지케이스·접근성 점검 (공개+온보딩 6화면)](wireframes/ux-review.md) | 📜 이력 | 2026-08-19 | [디자인, 접근성, 점검] — 대체: 점검 시점(2026-07) 기록 — 대체 문서 없음. 현행 점검은 docs/research/ut-agent/results/이슈-백로그.md |

← 지식베이스 홈 [../docs/README.md](../docs/README.md)
