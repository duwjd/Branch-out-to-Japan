---
description: 페이지 와이어프레임 + Tailwind 레이아웃 설계 (designer 위임)
argument-hint: <설계할 페이지/화면>
---

`designer` 에이전트를 사용해 다음 화면을 설계한다:

**대상:** $ARGUMENTS

요구사항:
- 이 화면의 목표(전환/행동)와 사용자 시선 흐름을 먼저 정의한다.
- 섹션 구성·카피 슬롯을 마크다운 와이어프레임으로 잡아 `design/wireframes/` 에 저장 제안.
- `design/design-system.md` 토큰을 따르고, 없으면 제안 후 문서화한다.
- 모바일 우선·접근성(대비/포커스/시맨틱)을 갖춘 Tailwind 레이아웃 시안을 제시한다.
- 실제 구현은 `frontend-dev` 로 이어가도록 인계 포인트를 남긴다.
