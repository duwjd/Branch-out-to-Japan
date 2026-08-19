/**
 * 마감 예산 가드 검증 — 정본: docs/specs/02-detail-converter-spec.md §2-12.
 *
 * 여기서 지키는 것은 "몇 장을 만드는가"가 아니라 **무엇을 먼저 포기하는가**다.
 * 300초는 Vercel Hobby 플랫폼 상한이라 늘릴 수 없으므로, 예산이 모자랄 때의 행동이
 * 결정적이고 납득 가능해야 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPOSE_RESERVE_MS, IMAGE_WAVE_MS, fitImageBudget, type ImageCandidate } from './budget';

const TIMEOUT = 120_000;

/** 우선순위 0(히어로) ~ 4 의 후보 5장. 일부러 뒤섞어 넣어 정렬을 검증한다. */
const CANDIDATES: ImageCandidate[] = [
  { blockId: 'texture-shot', priority: 1, seq: 7 },
  { blockId: 'before-after-diagram', priority: 4, seq: 3 },
  { blockId: 'hero-product', priority: 0, seq: 0 },
  { blockId: 'usage-scene', priority: 3, seq: 8 },
  { blockId: 'problem-hook', priority: 2, seq: 1 },
];

test('여유가 충분하면 한 장도 버리지 않는다', () => {
  const r = fitImageBudget(CANDIDATES, 200_000, 6, TIMEOUT);
  assert.equal(r.keep.length, 5);
  assert.equal(r.drop.length, 0);
  assert.equal(r.waves, 1);
  assert.equal(r.perImageTimeoutMs, TIMEOUT);
});

test('한 웨이브 안에서는 장수를 줄이지 않는다 — 동시에 도니까 줄여도 시간이 안 준다', () => {
  // 한 웨이브(90초)조차 못 채우는 예산이지만, 5장을 4장으로 줄여도 여전히 한 웨이브다.
  // 사진 한 장을 공짜로 버리는 대신 1콜 상한을 조인다.
  const r = fitImageBudget(CANDIDATES, IMAGE_WAVE_MS / 2 + COMPOSE_RESERVE_MS, 6, TIMEOUT);
  assert.equal(r.drop.length, 0, '같은 웨이브 안에서 장수를 줄였다');
  assert.ok(r.perImageTimeoutMs < TIMEOUT, '1콜 상한이 줄지 않았다');
});

test('웨이브가 줄어들 때만 후보를 자른다', () => {
  // 동시성 2 · 5장 = 3웨이브(270초). 1웨이브치 예산만 주면 2장만 남아야 한다.
  const r = fitImageBudget(CANDIDATES, IMAGE_WAVE_MS + COMPOSE_RESERVE_MS, 2, TIMEOUT);
  assert.equal(r.waves, 1);
  assert.equal(r.keep.length, 2);
  assert.deepEqual(r.keep, ['hero-product', 'texture-shot'], '우선순위 순으로 남지 않았다');
});

test('버리는 순서는 우선순위 역순 — 카테고리 필수 컷이 서명 블록보다 오래 버틴다', () => {
  const r = fitImageBudget(CANDIDATES, IMAGE_WAVE_MS * 2 + COMPOSE_RESERVE_MS, 2, TIMEOUT);
  assert.deepEqual(r.keep, ['hero-product', 'texture-shot', 'problem-hook', 'usage-scene']);
  assert.deepEqual(r.drop.map((d) => d.blockId), ['before-after-diagram']);
});

test('히어로는 시간이 아무리 없어도 남는다 — 제품이 한 번도 안 서는 페이지는 실패한 페이지다', () => {
  const r = fitImageBudget(CANDIDATES, 0, 1, TIMEOUT);
  assert.deepEqual(r.keep, ['hero-product']);
  assert.equal(r.drop.length, 4);
});

test('1콜 상한에는 하한이 있다 — 정상 호출(40~90초)까지 자르면 가드가 실패를 만든다', () => {
  const r = fitImageBudget(CANDIDATES, 1_000, 6, TIMEOUT);
  assert.ok(r.perImageTimeoutMs >= 30_000, `상한 ${r.perImageTimeoutMs}ms`);
  assert.ok(r.perImageTimeoutMs <= TIMEOUT);
});

test('탈락 사유는 화면에 그대로 나가는 한국어이고 다음 행동을 말한다', () => {
  const r = fitImageBudget(CANDIDATES, 0, 1, TIMEOUT);
  for (const d of r.drop) {
    assert.match(d.reason, /[가-힣]/, '한국어가 아니다');
    assert.match(d.reason, /다시 만들/, '사용자가 취할 조치가 없다');
  }
});

test('결정성 — 입력 순서가 달라도 같은 결과(재생성이 흔들리지 않는다)', () => {
  const a = fitImageBudget(CANDIDATES, IMAGE_WAVE_MS + COMPOSE_RESERVE_MS, 2, TIMEOUT);
  const b = fitImageBudget([...CANDIDATES].reverse(), IMAGE_WAVE_MS + COMPOSE_RESERVE_MS, 2, TIMEOUT);
  assert.deepEqual(a, b);
});

test('동점 우선순위는 시퀀스 순서로 깬다', () => {
  const tied: ImageCandidate[] = [
    { blockId: 'texture-shot', priority: 1, seq: 9 },
    { blockId: 'usage-scene', priority: 1, seq: 4 },
    { blockId: 'hero-product', priority: 0, seq: 0 },
  ];
  const r = fitImageBudget(tied, IMAGE_WAVE_MS * 2 + COMPOSE_RESERVE_MS, 1, TIMEOUT);
  assert.deepEqual(r.keep, ['hero-product', 'usage-scene']);
});

test('후보가 없으면 조용히 빈 결과 — 텍스트 전용 페이지도 성립한다', () => {
  const r = fitImageBudget([], 200_000, 6, TIMEOUT);
  assert.deepEqual(r.keep, []);
  assert.deepEqual(r.drop, []);
});
