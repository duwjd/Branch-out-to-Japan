/**
 * 콜⑨ copyHumanize 검증.
 *
 * 이 콜의 존재 이유는 문체를 다듬는 것이지만, **설계 목표는 안전이다** —
 * 윤문이 사실을 바꾸거나 각주를 지우면 그건 개선이 아니라 사고다.
 * 그래서 여기서 지키는 것은 "무엇을 채택하지 않는가"다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyHumanized } from './humanizeCall';

const NO_FORBIDDEN: { term: string; reason: string }[] = [];

test('문체만 바뀐 문장은 채택된다', () => {
  const before = 'うるおいが続かない肌において、角質層までうるおいを届けることができます。';
  const after = 'うるおいが続かない肌へ。角質層までうるおいを届けます。';
  assert.deepEqual(verifyHumanized(before, after, NO_FORBIDDEN), { ok: true });
});

test('숫자가 바뀌면 채택하지 않는다(景表法 리스크)', () => {
  const before = 'ナイアシンアミド2%配合、累計163,991個。';
  const after = 'ナイアシンアミド3%配合、累計163,991個。';
  const r = verifyHumanized(before, after, NO_FORBIDDEN);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /숫자/);
});

test('표기 형식만 바뀐 숫자는 통과한다(값이 같으면 된다)', () => {
  // 천단위 쉼표·전각 숫자는 표기 차이지 값 변화가 아니다
  assert.equal(verifyHumanized('累計163,991個', '累計163991個', NO_FORBIDDEN).ok, true);
  assert.equal(verifyHumanized('SPF50+', 'ＳＰＦ５０＋', NO_FORBIDDEN).ok, true);
});

test('※각주 마커가 사라지면 채택하지 않는다(고아 각주 = 打消し表示 누락)', () => {
  const before = '透明感のある印象へ※1';
  const after = '透明感のある印象へ';
  const r = verifyHumanized(before, after, NO_FORBIDDEN);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /각주/);
});

test('없던 ※마커를 만들어도 채택하지 않는다(해소할 각주가 없다)', () => {
  const r = verifyHumanized('角質層まで', '角質層まで※2', NO_FORBIDDEN);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /각주/);
});

test('한글이 남으면 채택하지 않는다(그 블록이 통째로 사라진다)', () => {
  const r = verifyHumanized('うるおいを届けます', 'うるおい을 届けます', NO_FORBIDDEN);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /한글/);
});

test('브랜드 금지 표현이 들어가면 채택하지 않는다', () => {
  const r = verifyHumanized('肌をととのえます', '肌が生まれ変わる', [{ term: '生まれ変わる', reason: '약기법 인접' }]);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /금지 표현/);
});

test('항목 수가 달라지면 채택하지 않는다(슬롯 형식이 깨진다)', () => {
  const before = 'STEP1|洗顔後\nSTEP2|適量を手にとり\nSTEP3|気になる部分に';
  const after = 'STEP1|洗顔後\nSTEP2|適量を手にとり';
  const r = verifyHumanized(before, after, NO_FORBIDDEN);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /항목 수/);
});

test('여러 줄 슬롯도 항목 수가 같으면 채택된다', () => {
  const before = '乾燥が気になる|化粧水をつけても乾燥する\nゆらぎ|季節の変わり目に肌がゆらぎやすい';
  const after = '乾燥が気になる|化粧水をつけても、すぐ乾く\nゆらぎ|季節の変わり目は肌がゆらぐ';
  assert.equal(verifyHumanized(before, after, NO_FORBIDDEN).ok, true);
});

test('빈 결과는 채택하지 않는다(슬롯이 비면 필수 블록이 실패한다)', () => {
  const r = verifyHumanized('うるおいを届けます', '   ', NO_FORBIDDEN);
  assert.equal(r.ok, false);
});

test('이모지·간체자는 채택하지 않는다(폰트가 그리지 못한다)', () => {
  assert.equal(verifyHumanized('うるおい', 'うるおい✨', NO_FORBIDDEN).ok, false);
});
