---
title: 검증·실험
space: 검증·실험
status: 정본
phase: Phase 0
updated: 2026-08-31
owner:
tags: [UT, 실험, 인덱스]
---

# 검증·실험

> **가설을 사실로 바꾸려던 시도들.** 계획과 결과를 함께 둔다.
> 지식베이스 홈 = [../README.md](../README.md)

## Phase 0 에서 무엇이 검증됐고 무엇이 안 됐나

| | 상태 |
|---|---|
| **AI 에이전트 UT** (합성 페르소나 20인 · 2세션 · 2026-08-20~21) | ✅ 실행 — 생성 60/60 · 이슈 71건(P0 14) → [UT 리포트](../research/ut-agent/results/UT-리포트.md) |
| **실사용자 UT** (계획 8/1~3) | ❌ **미실행** — 모집 불발로 AI 에이전트 UT 로 대체. **대체이지 등가가 아니다** |
| **`/lp` 수요 검증 실험** | ⚠️ **설계만** — 랜딩(`/lp`)·이벤트 API 는 구현됐으나 표본 100 확보와 집계는 미완 |

> **그래서 "고객이 이걸 사는가"는 Phase 0 종료 시점에도 답이 없다.** 합성 페르소나는 구매 행동을 예측하지 않는다 — WTP 18/20 은 전환율이 아니라 상대 비교 신호다. 이 미결정은 [DECISIONS](../decisions/DECISIONS.md) "미결정" 절이 정본이다.

## AI 에이전트 UT (`../research/ut-agent/`)

배포본을 합성 페르소나 20인이 실제로 돌았다. 실행 도구는 `scripts/ut/` 에 있고 **큰 변경 후 재실행할 수 있다**.

| 문서 | 상태 | 갱신 | 태그 |
|---|---|---|---|
| [AI 에이전트 사용자 테스트(UT) 계획 — YOAKE 실서비스 만족도 평가](../research/ut-agent/00-ut-plan.md) | ✅ 정본 | 2026-08-21 | [UT, 계획] |
| [AI 에이전트 UT — 산출물 형식](../research/ut-agent/01-산출물-형식.md) | ✅ 정본 | 2026-08-21 | [UT, 계약] |
| [AI 에이전트 UT — Claude Code 실행 프롬프트](../research/ut-agent/02-실행-프롬프트.md) | ✅ 정본 | 2026-08-21 | [UT, 프롬프트] |
| [AI 에이전트 UT — YOAKE 실서비스 만족도 평가](../research/ut-agent/README.md) | ✅ 정본 | 2026-08-21 | [UT, 인덱스] |
| [UT용 제품컷 6종 — 출처·라이선스·배정](../research/ut-agent/fixtures/products/README.md) | ✅ 정본 | 2026-08-21 | [UT, 자산, 라이선스] |
| [`docs/09-dev-spec.md` 반영 문안 (제안) — UT P0 대응](../research/ut-agent/results/09-dev-spec-반영-문안.md) | 📜 이력 | 2026-08-21 | [UT, 제안문안] — 대체: docs/09-dev-spec.md (반영 완료 2026-08-21) |
| [P0 — 진단 리포트가 발행되지 않는다 (콜⑩ 윤문에서 함수 예산 초과)](../research/ut-agent/results/P0-리포트-파이프라인-예산초과.md) | 📜 이력 | 2026-08-21 | [UT, P0, 진단리포트] — 대체: 해소됨 (c1f3d30 · M12-A) — docs/09-dev-spec.md §4d |
| [AI 에이전트 UT 결과 — YOAKE 실서비스 (2026-08-21)](../research/ut-agent/results/UT-리포트.md) | ✅ 정본 | 2026-08-21 | [UT, 결과] |
| [UT 실행 기록 — 무엇을 어떻게 돌렸고, 무엇이 어긋났나](../research/ut-agent/results/실행-기록.md) | 📜 이력 | 2026-08-21 | [UT, 실행로그] — 대체: 2026-08-20~21 실행 로그 — 결론은 UT-리포트.md |
| [원시 응답 — 페르소나 20인 전문](../research/ut-agent/results/원시응답.md) | 📜 이력 | 2026-08-21 | [UT, 원자료] — 대체: 원자료 — 해석은 UT-리포트.md |
| [UT 이슈 백로그 — YOAKE 실서비스](../research/ut-agent/results/이슈-백로그.md) | ✅ 정본 | 2026-08-21 | [UT, 결과, 백로그] |
| [YOAKE 배포본 UT — 한 장 요약](../research/ut-agent/results/한장요약.md) | ✅ 정본 | 2026-08-21 | [UT, 결과, 요약] |

## 실험 설계

| 문서 | 상태 | 갱신 | 태그 |
|---|---|---|---|
| [실험 · 검증 랜딩(/lp) — MVP 실효성 조사](2026-07-22-lp-validation.md) | ✅ 정본 | 2026-08-18 | [실험, 수요검증, 랜딩] |
| [유튜브 대본 — /lp 검증 랜딩 유입 영상](2026-07-23-youtube-script.md) | ✅ 정본 | 2026-07-23 | [실험, 유입, 대본] |
