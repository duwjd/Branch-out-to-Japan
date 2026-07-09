/**
 * 집계 결정성 단위 테스트 — 스펙 AC-2.2(같은 항목 점수 → 같은 종합점수) · AC-2.3(E군 분모 제외).
 * 러너: node:test (네이티브 의존 없음 — 모든 머신에서 동작). 실행: npm run test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateScores } from './aggregate';
import { applicableItems } from '../rubric';
import type { Category, ScoredItem } from '../types';

/** 적용 항목 전부에 고정 점수를 채운 입력을 만든다 */
function fixedItems(category: Category, score: 0 | 1 | 2): ScoredItem[] {
  return applicableItems(category).map((item) => ({
    itemId: item.id,
    score,
    evidenceQuote: '',
    criterionRef: '',
    corpusRef: '',
  }));
}

describe('aggregateScores (결정적 집계)', () => {
  it('같은 입력을 두 번 집계하면 종합점수·그룹점수·Top3가 동일하다 (AC-2.2)', () => {
    const items = fixedItems('skincare', 1);
    items[0] = { ...items[0], score: 2 };
    items[3] = { ...items[3], score: 0 };

    const first = aggregateScores('skincare', items);
    const second = aggregateScores('skincare', structuredClone(items));

    assert.equal(second.overallScore, first.overallScore);
    assert.deepEqual(second.groupScores, first.groupScores);
    assert.deepEqual(second.top3, first.top3);
  });

  it('전 항목 2점이면 모든 카테고리에서 종합 100점이다 (가중치 합=1.00 검증)', () => {
    const categories: Category[] = ['skincare', 'makeup', 'suncare', 'cleansing'];
    for (const category of categories) {
      const result = aggregateScores(category, fixedItems(category, 2));
      assert.equal(result.overallScore, 100, `${category} 만점 검증`);
    }
  });

  it('전 항목 0점이면 종합 0점이고 Top3는 ID 순으로 결정적이다', () => {
    const result = aggregateScores('skincare', fixedItems('skincare', 0));
    assert.equal(result.overallScore, 0);
    assert.deepEqual(result.top3.map((t) => t.itemId), ['A1', 'A2', 'A3']);
  });

  it('E군은 카테고리 해당 항목만 채점·분모 반영된다 (AC-2.3)', () => {
    const suncareItems = applicableItems('suncare').map((i) => i.id);
    assert.ok(suncareItems.includes('E1'));
    assert.ok(!suncareItems.includes('E2'));
    assert.ok(!suncareItems.includes('E4'));

    // 적용 외 항목(E4) 점수를 섞어 넣어도 suncare 집계에 영향이 없다
    const base = fixedItems('suncare', 1);
    const withForeign: ScoredItem[] = [
      ...base,
      { itemId: 'E4', score: 2, evidenceQuote: '', criterionRef: '', corpusRef: '' },
    ];
    assert.deepEqual(aggregateScores('suncare', withForeign), aggregateScores('suncare', base));
  });

  it('스펙 블록5 공식 스팟체크: skincare에서 A만 전부 2점이면 종합 30점(A 가중 0.30)', () => {
    const items = fixedItems('skincare', 0).map((item) =>
      item.itemId.startsWith('A') ? { ...item, score: 2 as const } : item,
    );
    const result = aggregateScores('skincare', items);
    assert.equal(result.groupScores.A, 100);
    assert.equal(result.overallScore, 30);
  });
});
