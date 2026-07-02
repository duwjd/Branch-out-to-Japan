# design/ — 디자인 산출물

디자인 방식은 현재 **코드 우선(Tailwind)** 으로 시작한다. Figma 연동은 팀 결정 시 도입.

## 폴더
- `design-system.md` — 컬러·타이포·간격 토큰 (구현은 Tailwind 설정/유틸에 반영)
- `copy/` — 랜딩·광고 카피 초안 (KR 원안 → JP 재설계). `jp-localizer` 산출물 보관
- `wireframes/` — 와이어프레임·스크린샷·참고 이미지

## 워크플로우
- 화면 설계는 `/design-page` (→ `designer` 에이전트)로 시작 → `frontend-dev`가 구현.
- 카피는 `/localize` (→ `jp-localizer`)로 일본 고객 관점 재설계 후 반영.

## Figma 연동(선택)
팀이 Figma를 쓰기로 하면, 이 세션에 연결된 Figma MCP로 design-to-code가 가능하다.
그 경우 `.claude/agents/designer.md` 의 `tools` 에 Figma MCP 도구를 추가한다.
