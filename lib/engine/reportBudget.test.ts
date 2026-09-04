/**
 * ① 리포트 잡 예산 가드 검증.
 *
 * 여기서 지키는 것은 "얼마나 빨리 끝나는가"가 아니라 **가드가 정상 실행을 자르지 않는가**다.
 * 예산 가드의 실패 모드는 두 방향이고, 두 번째가 훨씬 나쁘다:
 *  ① 너무 느슨하다 → 함수가 300초에 죽어 리포트가 발행되지 않는다(가드 도입 전의 상태)
 *  ② 너무 빡빡하다 → 정상 콜까지 잘라, 가드가 **스스로 실패를 만든다**
 *
 * 그래서 실측 타임라인(P0 문서 2026-08-20)을 회귀 테스트로 박아 둔다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUMANIZE_MIN_MS, REPORT_BUDGET_MS, SAVE_RESERVE_MS, callTimeout, canHumanize } from './reportBudget';

test('예산 시작 시점에는 단계 상한을 그대로 준다', () => {
  // 270초 남은 상태 — 저장 몫(20초)을 빼도 250초라 단계 상한이 그대로 통과한다
  assert.equal(callTimeout('llmCalls', REPORT_BUDGET_MS), 150_000);
  assert.equal(callTimeout('call4', REPORT_BUDGET_MS), 150_000);
  assert.equal(callTimeout('extract', REPORT_BUDGET_MS), 90_000);
});

test('실측 타임라인이 가드에 걸리지 않는다 — 가드가 스스로 실패를 만들면 안 된다', () => {
  // P0 문서 실측: 콜①②③ 병렬 102초 → 콜④ 107초. 두 단계 모두 상한 안에 들어야 한다.
  const atCalls = REPORT_BUDGET_MS;
  assert.ok(callTimeout('llmCalls', atCalls) > 102_000, '콜①②③ 실측치가 상한에 걸린다');

  const atCall4 = atCalls - 102_000;
  assert.ok(callTimeout('call4', atCall4) > 107_000, '콜④ 실측치가 상한에 걸린다');

  // 그리고 그 뒤에도 윤문을 **끝낼** 시간이 남아 있어야 한다 — 콜⑩이 죽은 코드가 되면 안 된다.
  // 로컬 실측(2026-08-21): 3청크 병렬로 가장 느린 청크 42초(4청크는 그보다 짧다).
  const atHumanize = atCall4 - 107_000;
  assert.equal(atHumanize, 61_000, '실측 타임라인이 바뀌었다면 이 테스트의 전제부터 갱신한다');
  assert.ok(canHumanize(atHumanize), `윤문 진입 시 잔여 ${atHumanize}ms 로 항상 건너뛴다`);
  assert.ok(
    callTimeout('humanize', atHumanize) >= 42_000,
    '실측 윤문 소요(42초)를 담지 못한다 — 예산 여유가 사라지면 콜⑩이 배포본에서 항상 스킵된다',
  );
});

test('마감이 가까우면 저장 몫을 남기고 조인다 — 저장은 어떤 콜도 먹지 못한다', () => {
  const left = 100_000;
  assert.equal(callTimeout('call4', left), left - SAVE_RESERVE_MS);
  assert.equal(callTimeout('humanize', left), left - SAVE_RESERVE_MS);
});

test('저장 몫보다 적게 남으면 0 — 콜을 걸지 않는다는 뜻이다', () => {
  assert.equal(callTimeout('call4', SAVE_RESERVE_MS), 0);
  assert.equal(callTimeout('call4', 5_000), 0);
  assert.equal(callTimeout('humanize', -10_000), 0, '마감을 넘긴 뒤에도 음수를 돌려주지 않는다');
});

test('canHumanize — 저장 몫 + 콜 한 번이 성립하는 선에서 갈린다', () => {
  assert.equal(canHumanize(HUMANIZE_MIN_MS), true);
  assert.equal(canHumanize(HUMANIZE_MIN_MS - 1), false);
  assert.equal(canHumanize(0), false);
  assert.equal(canHumanize(-30_000), false);
  // 게이트를 통과했다면 상한이 반드시 양수여야 한다 — 통과시켜 놓고 0초를 주면 앞뒤가 안 맞는다
  assert.ok(callTimeout('humanize', HUMANIZE_MIN_MS) > 0);
});

test('예산 상수는 ② 상세 잡(JOB_BUDGET_MS)과 같은 규칙이다 — 런북이 두 벌이 되면 안 된다', () => {
  assert.equal(REPORT_BUDGET_MS, 270_000, '300초 함수 상한에서 저장·전이용 30초를 뗀 값');
});
