/**
 * promptPack 결정적 조립·게이트 단위 테스트 — 같은 입력 → 같은 프롬프트(09 §5 검증 전략).
 * 법적 게이트가 코드에서 강제되는지가 핵심(proof 없는 배지 제거 · 가격 슬롯 공란).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleSlots, badgeParagraphs, buildPrompt, getStyle } from './promptPack';
import type { ThumbnailProof } from '../db/store';

const PROOF: ThumbnailProof = {
  rankTitle: '楽天ランキング1位',
  genre: '日焼け止め',
  aggregationDate: '2026/6/14更新',
};

test('buildPrompt — 슬롯 치환 + 제약 4계층 연결', () => {
  const prompt = buildPrompt('C', { brandName: 'HARUON', backgroundVisual: 'sky', catchCopyJa: 'コピー' }, false);
  assert.ok(prompt.includes("brand logo text 'HARUON'"));
  assert.ok(prompt.includes('コピー'));
  assert.ok(prompt.includes('Strict requirements:'));
  // 공통 제약(팩 commonNegativeConstraints)이 붙는다
  assert.ok(prompt.includes('No Korean (Hangul) characters'));
});

test('buildPrompt — 미지 스타일은 즉시 실패', () => {
  assert.throws(() => buildPrompt('Z', {}, false), /unknown style category/);
});

test('buildPrompt — 프로모 입력이면 cleanup 프리펜드', () => {
  const clean = buildPrompt('A', {}, false);
  const promo = buildPrompt('A', {}, true);
  assert.ok(!clean.includes('Korean promotional thumbnail'));
  assert.ok(promo.startsWith('The input is a Korean promotional thumbnail'));
});

test('badgeParagraphs — proof 없으면 배지 문단째 제거(기본값 = 배지 없음)', () => {
  const style = getStyle('C');
  const withoutProof = badgeParagraphs(style, null);
  assert.equal(withoutProof.rankingBadgeParagraph, '');
  const partial = badgeParagraphs(style, { ...PROOF, genre: ' ' });
  assert.equal(partial.rankingBadgeParagraph, '');
});

test('badgeParagraphs — proof 3필드 전부 있으면 배지 문단 채움', () => {
  const style = getStyle('C');
  const withProof = badgeParagraphs(style, PROOF);
  assert.ok(withProof.rankingBadgeParagraph.includes('楽天ランキング1位'));
  assert.ok(withProof.rankingBadgeParagraph.includes('日焼け止め'));
});

test('assembleSlots — 가격 슬롯은 값이 와도 강제 공란(有利誤認 차단)', () => {
  const style = getStyle('G');
  const slots = assembleSlots(
    style,
    [
      { key: 'setTitleJa', value: 'セット' },
      { key: 'priceBlock', value: '¥1,999 최대 59% 오프' }, // LLM이 지어내도
      { key: 'unknownSlot', value: 'x' }, // 미지 슬롯은 버린다
    ],
    null,
  );
  assert.equal(slots.priceBlock, '');
  assert.equal(slots.giftInsetParagraph, '');
  assert.ok(!('unknownSlot' in slots));
  assert.equal(slots.setTitleJa, 'セット');
});

test('buildPrompt — 결정성: 같은 입력이면 같은 프롬프트', () => {
  const a = buildPrompt('D', { catchCopyJa: 'コピー', ingredientVisual: 'v', backgroundColor: 'b' }, true);
  const b = buildPrompt('D', { catchCopyJa: 'コピー', ingredientVisual: 'v', backgroundColor: 'b' }, true);
  assert.equal(a, b);
});
