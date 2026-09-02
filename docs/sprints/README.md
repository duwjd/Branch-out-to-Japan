---
title: 스프린트
space: 전략·제품
status: 정본
phase: Phase 1
updated: 2026-08-31
owner:
tags: [스프린트, 인덱스, 운영]
---

# 스프린트

> **Phase 를 실제로 굴리는 단위.** [[../04-roadmap]] 이 "어느 Phase 이고 무엇을 하기로 했나"를 말한다면, 여기는 **"이번 2주에 누가 무엇을 언제"**를 말한다.
> 지식베이스 홈 = [../README.md](../README.md)

## 세 문서의 역할이 다르다

| | 무엇 | 언제 본다 |
|---|---|---|
| [[../04-roadmap]] | Phase 정의·범위·종료 판정 | "우리 지금 어느 단계지" |
| [[../09-dev-spec]] §4~ | 마일스톤 태스크·DoD (`M0`~) | "무엇을 어떻게 짓지" |
| **여기** | 기간·담당·일자별 진행·리스크·회고 | "이번 주 뭐 하지 / 뭐가 막혔지" |

일감의 **실시간 상태는 [GitHub Issues](https://github.com/duwjd/Branch-out-to-Japan/issues)** 가 정본이다. 스프린트 문서는 이슈 번호로 잇고 **맥락과 회고**를 맡는다 — 두 곳에 같은 내용을 쓰지 않는다.

## 규칙

- 파일명은 `YYYY-MM-{phase}.md`. 스프린트 하나에 문서 하나.
- 끝난 스프린트도 **지우지 않는다.** 회고가 다음 Phase 범위의 입력값이다.
- GitHub 활동(이슈·PR·커밋)은 전부 **`duwjd` 계정**으로 한다.

## 도구

**어떻게 굴리는지는 [[운영-가이드]] 에 있다** — 하루 리듬·상태 바꾸는 법·일감 추가·새 스프린트 시작·막혔을 때.
아래는 요약이다.

이슈와 이 문서를 잇는 스크립트가 `scripts/sprint/` 에 있다. 의존성 0(`node:` 빌트인만).

| 명령 | 무엇 |
|---|---|
| `npm run sprint:sync` | GitHub 이슈 → `.sprint/cache/`. **단방향 읽기**, 하루 시작에 한 번 |
| `npm run sprint:board` | 상태별 보드 |
| `npm run sprint:standup` | 어제(커밋)/오늘/블로커 |
| `npm run sprint:kanban` | `.sprint/board.html` |
| `npm run sprint:doc-sync` | §작업 보드 ↔ 이슈 대조. `-- --write` 면 **상태 열만** 갱신 |

Claude Code 에서는 `/sprint-sync` · `/sprint-board` · `/sprint-standup` · `/sprint-kanban` ·
`/sprint-groom <마일스톤>`(마일스톤 → 이슈 분해, 생성은 사람이).
세션을 열면 보드가 자동으로 주입된다(`.claude/hooks/sprint-session-start.mjs`).
**운영에 전용 에이전트를 두지 않는다** — 격리 컨텍스트는 그 주입을 못 받는다([[운영-가이드]] §5).

**상태는 GitHub 쪽을 바꾼다** — 라벨 `진행`·`blocked` 를 붙이거나 떼고, 완료는 이슈를 닫는다.
그다음 `doc-sync -- --write` 로 문서를 맞춘다. 반대 방향으로 하지 않는다.

| 문서 이모지 | GitHub |
|---|---|
| ⬜ 대기 | open |
| 🔵 진행 | open + 라벨 `진행` |
| ⛔ 차단 | open + 라벨 `blocked` |
| ✅ 완료 | **closed** |

`.sprint/` 는 캐시·생성물이라 커밋하지 않는다. 매 작업일 아침 09:13(KST)에는
[스탠드업 워크플로](../../.github/workflows/standup.yml)가 라벨 `스탠드업` 이 붙은
이슈에 자동으로 코멘트를 단다 — **`main` 에 있어야 발화한다.**

## 문서

| 스프린트 | 기간 | 목표 | 상태 |
|---|---|---|---|
| [Phase 1](2026-09-phase1.md) | 2026-08-31 ~ 09-11 | 상세페이지 안정화 · 입력 피로 해소 · 로그인 개선 | 🔵 진행 |
