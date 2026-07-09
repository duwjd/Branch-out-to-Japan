# design/ — 디자인 산출물

디자인 **단일 기준 = [DESIGN.md](DESIGN.md)** (코랄 시스템 `#FF6464`/`#D93636`/`#FFF8F8` · 컴포넌트 인벤토리 · §14 상태 규약 · CTA 코랄 정책). 모든 화면·와이어프레임은 이 코랄 시스템을 따른다. 인계 결정 로그는 [handoff-landing-design-system.md](handoff-landing-design-system.md).

> 톤은 **코랄로 확정**(2026-07-09). 이전 "네이비 A안" 톤 탐색(`brand-tone-proposals.md`·`wireframes/tone-preview.html`)은 superseded(이력 보존). 리포트/산출물 와이어프레임도 코랄로 리스킨 완료.

## 폴더
- `DESIGN.md` — **디자인 시스템 단일 기준**(코랄 토큰·타이포·간격·컴포넌트·상태)
- `handoff-landing-design-system.md` — 랜딩 디자인시스템 인계(CTA 정책·Figma node id·접근성)
- `design-system.md` / `design-system-plan.md` — 초기 토큰 계획(참고)
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
