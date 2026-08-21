/**
 * ① 진단 리포트 잡의 마감 예산 — 300초 안에서 **리포트가 반드시 발행되게** 한다.
 *
 * 왜 필요한가: `app/api/report/route.ts` 의 `maxDuration = 300` 은 Vercel Hobby(Fluid Compute)의
 * **플랫폼 상한**이라 올릴 수 없다(11 §2). 그런데 리포트 잡은 저장이 **맨 마지막**이라
 * (`reportJob.ts` — saveReport → published), 함수가 300초에서 죽으면 5콜과 실비를 다 쓰고도
 * 남는 게 없다. 요청은 `processing` 으로 고착하다 10분 뒤 스테일 가드에 `failed` 로 확정된다.
 *
 * ② 상세페이지 잡은 같은 300초 안에서 완주한다 — `lib/studio/detail/budget.ts` 가 이미지 웨이브
 * 직전에 남은 시간을 재고 우선순위 낮은 컷을 강등하기 때문이다. 이 파일은 그 ① 대응물이고,
 * 상수 규칙(`JOB_BUDGET_MS = 270_000`)을 의도적으로 맞췄다 — 두 축의 예산이 서로 다른 숫자를
 * 쓰면 런북이 두 벌이 된다.
 *
 * ## 이 상한은 스케줄이 아니라 **폭주 차단선**이다
 *
 * 단계별 상한을 "다음 단계들이 쓸 시간을 뺀 값"으로 잡으면, 정상 소요(실측 콜①②③ 102초 ·
 * 콜④ 107초)까지 잘라 버려 가드가 오히려 실패를 만든다. 그래서 상한은 **실측 최악값에 여유를
 * 얹은 값**으로 두고, 거기에 "저장 몫은 어떤 콜도 먹지 못한다"는 하드캡만 겹친다.
 * 정상 실행은 이 가드를 스치지도 않는다. 매달린 콜 하나만 잘린다.
 *
 * 잘린 뒤에 무슨 일이 벌어지는지는 `pipeline.ts` 가 이미 정해 두었다 — 콜① 실패는 0점 폴백,
 * 콜③ 실패는 카테고리 일반형, 콜④ 실패는 블록7·8 축소, 콜⑩ 실패는 원문 유지. 이 파일이 하는 일은
 * **그 폴백들에 도달할 길을 여는 것**이지 새 폴백을 만드는 게 아니다.
 *
 * 근거 실측: docs/research/ut-agent/results/P0-리포트-파이프라인-예산초과.md (2026-08-20 · 3/3 재현)
 */

import { MIN_ATTEMPT_MS } from './llm/client';

/**
 * 잡 전체에 허용하는 벽시계 예산. ② `JOB_BUDGET_MS` 와 같은 값·같은 규칙이다.
 *
 * 300초가 아닌 이유는 저장 몫 때문이 **아니다**(그건 아래 `SAVE_RESERVE_MS` 가 따로 뗀다).
 * 마감을 재는 시점이 함수 시작과 다르기 때문이다 — `deadlineAt` 은 `after()` 안에서 잡히는데,
 * 그 전에 이미 폼 파싱·이미지 저장·readiness 점검·응답 반환이 끝나 있다. UT 실측에서
 * `POST /api/report` 가 201을 돌려준 시각이 **11초**였다. 즉 우리 예산 270초는 함수 시계로
 * 약 281초다. 이 30초 격차가 그 선행 구간과 마지막 여유를 함께 덮는다.
 */
export const REPORT_BUDGET_MS = 270_000;

/**
 * 어떤 LLM 콜도 침범할 수 없는 저장 몫.
 * 리포트 잡은 저장이 맨 마지막이라, 이 시간을 지키지 못하면 파이프라인이 성공해도 발행이 안 된다.
 *
 * 15초인 이유: 남은 일이 `saveReport`(jsonb upsert 1회) + `updateRequest`(1회) 뿐이라 정상 소요는
 * 2초 안쪽이다. 그런데 ② 상세 잡처럼 30초를 떼면 그 시간이 고스란히 윤문에서 빠진다 —
 * 실측(2026-08-21)에서 윤문이 42초, 배포본 기준 윤문 진입 시 잔여가 61초라 **떼는 몫이 곧
 * 윤문의 생사**다. 정상 소요의 7배를 남기되 그 이상은 윤문에 준다.
 */
export const SAVE_RESERVE_MS = 15_000;

/**
 * 윤문(콜⑩)을 시작해도 되는 최소 잔여 시간.
 * 저장 몫 + 콜 한 번이 성립할 최소 시간 — "한 번은 시도해 볼 만한가"의 기준이지 임의의 숫자가 아니다.
 * 이 미만이면 콜을 걸지 않고 `humanizeSkipped` 에 사유를 남긴다(원문 유지 — 발행은 그대로).
 */
export const HUMANIZE_MIN_MS = SAVE_RESERVE_MS + MIN_ATTEMPT_MS;

/** 시간 상한을 거는 LLM 단계. 규칙 단계(normalize·aggregate·assemble)는 LLM을 타지 않아 대상이 아니다 */
export type ReportBudgetStage = 'extract' | 'llmCalls' | 'call4' | 'persona' | 'humanize';

/**
 * 단계별 1콜 벽시계 상한(재시도 포함).
 *
 * 실측(2026-08-20 · P0 문서)에 여유를 얹은 값이다 — 콜①②③ 병렬 102초 → 150초,
 * 콜④ 107초 → 150초. 정상 실행이 이 선에 닿지 않아야 가드가 제 역할만 한다.
 * **확정이 아니라 실측 갱신 대상이다** — 모델·effort를 바꾸면 여기부터 다시 잰다.
 */
const STAGE_CEILING_MS: Record<ReportBudgetStage, number> = {
  extract: 90_000,    // 콜⓪ 비전 추출(이미지 최대 10장, maxTokens 4000)
  llmCalls: 150_000,  // 콜①·②·③ 병렬 — 셋 중 가장 느린 콜이 이 상한을 받는다
  call4: 150_000,     // 콜④ 총평·재작성(maxTokens 16000 — 파이프라인에서 가장 무거운 콜)
  persona: 150_000,   // 브랜드 진단의 콜③ 단독 — 유일한 LLM 산출이라 풀 파이프라인과 같은 폭을 준다
  humanize: 90_000,   // 콜⑩ 윤문 — 청크 병렬이라 청크 하나가 아니라 전체가 이 상한 안에 든다
};

/**
 * 이 단계의 LLM 콜에 허용할 벽시계 상한(ms).
 *
 * `remainingMs` 가 넉넉하면 단계 상한을 그대로 주고, 마감이 가까우면 **저장 몫을 남긴 나머지**로 조인다.
 * 0을 돌려줄 수 있다 — 그건 "이 콜을 걸 시간이 없다"는 뜻이고, 호출 계층이 시도 없이 실패 경로로 보낸다.
 *
 * @param stage 지금 진입하는 단계
 * @param remainingMs 지금부터 잡 마감까지 남은 시간
 */
export function callTimeout(stage: ReportBudgetStage, remainingMs: number): number {
  const hardCap = remainingMs - SAVE_RESERVE_MS;
  return Math.max(0, Math.min(STAGE_CEILING_MS[stage], hardCap));
}

/**
 * 윤문(콜⑩)을 시작할 수 있는가.
 * false면 콜을 걸지 않고 원문을 그대로 쓴다 — **발행을 막지 않는다.**
 *
 * @param remainingMs 지금부터 잡 마감까지 남은 시간
 */
export function canHumanize(remainingMs: number): boolean {
  return remainingMs >= HUMANIZE_MIN_MS;
}
