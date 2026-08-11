/**
 * 번호 배지 이중 표기 회귀 테스트.
 * 실측 결함: 배지는 코드가 `CASE1`·`POINT 1` 로 붙이는데 LLM이 제목 열에도 같은 라벨을 넣어
 * `POINT 1 │ POINT1 うるおい成分配合` 처럼 두 번 나왔다. 팩 슬롯 설명으로도 막지만,
 * 모델 출력에 최종 책임을 지지 않으려면 렌더 직전에도 막혀 있어야 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripAutoLabel } from './templates';

test('stripAutoLabel — 제목이 라벨뿐이면 본문을 제목으로 올린다', () => {
  // 실측 출력: causeItemsJa = "CASE1|外部刺激による水分蒸散"
  const r = stripAutoLabel('CASE1', '外部刺激による水分蒸散', 'CASE');
  assert.equal(r.title, '外部刺激による水分蒸散');
  assert.equal(r.body, '');
});

test('stripAutoLabel — 제목 앞에 붙은 라벨만 걷어내고 내용은 남긴다', () => {
  // 실측 출력: pointsJa = "POINT1 うるおい成分配合|ヒアルロン酸Naが…"
  const r = stripAutoLabel('POINT1 うるおい成分配合', 'ヒアルロン酸Naが角質層まで', 'POINT ');
  assert.equal(r.title, 'うるおい成分配合');
  assert.equal(r.body, 'ヒアルロン酸Naが角質層まで');
});

test('stripAutoLabel — 구분자가 붙은 형태도 처리한다', () => {
  for (const raw of ['STEP 2: 適量を手にとる', 'STEP2. 適量を手にとる', 'STEP 2　適量を手にとる']) {
    assert.equal(stripAutoLabel(raw, '', 'STEP').title, '適量を手にとる', raw);
  }
});

test('stripAutoLabel — 라벨과 무관한 제목은 손대지 않는다', () => {
  const r = stripAutoLabel('うるおいバランスを整える', '本文', 'POINT ');
  assert.equal(r.title, 'うるおいバランスを整える');
  assert.equal(r.body, '本文');
});

test('stripAutoLabel — 숫자 없이 라벨로 시작하는 정상 문장은 자르지 않는다', () => {
  // "POINTは3つ" 를 "は3つ" 로 만들면 안 된다 — 숫자가 뒤따를 때만 배지로 판정한다
  const r = stripAutoLabel('POINTは3つあります', '本文', 'POINT ');
  assert.equal(r.title, 'POINTは3つあります');
});
