/**
 * 파이프라인 3단계 — 집계·가중·Top3 (규칙 · 결정적).
 * 결정성 계약(스펙 §5.3): LLM은 항목 점수만 매기고, 합산·가중·Top3는 이 순수 함수가 한다.
 * 같은 items 입력 → 같은 종합점수 (단위 테스트: aggregate.test.ts, AC-2.2).
 *
 * 공식(스펙 블록5):
 *  그룹 점수(%) = (그룹 내 항목 점수 합) ÷ (적용 항목 수 × 2) × 100
 *  종합 점수(0~100) = Σ(그룹 점수 × 그룹 가중치)  — 가중치 합 = 1.00
 *  E군은 카테고리 해당 항목만 채점(분모에서도 제외).
 */

import type { AggregateResult, Category, RubricGroup, ScoredItem } from '../types';
import { GROUP_WEIGHTS, applicableItems, rubricItem } from '../rubric';

const GROUP_ORDER: RubricGroup[] = ['A', 'B', 'C', 'D', 'E'];

/** 콜① 항목 점수를 결정적으로 집계한다 */
export function aggregateScores(category: Category, items: ScoredItem[]): AggregateResult {
  const applicable = applicableItems(category);
  const applicableIds = new Set(applicable.map((i) => i.id));

  // 방어: 적용 항목 밖 점수는 무시, 중복은 마지막 값 사용(콜 검증에서 이미 1:1 보장)
  const scoreById = new Map<string, ScoredItem>();
  for (const item of items) {
    if (applicableIds.has(item.itemId)) scoreById.set(item.itemId, item);
  }

  const groupScores = {} as Record<RubricGroup, number>;
  for (const group of GROUP_ORDER) {
    const groupItems = applicable.filter((i) => i.group === group);
    const sum = groupItems.reduce((acc, i) => acc + (scoreById.get(i.id)?.score ?? 0), 0);
    const denominator = groupItems.length * 2;
    groupScores[group] = denominator === 0 ? 0 : Math.round((sum / denominator) * 1000) / 10;
  }

  const weights = GROUP_WEIGHTS[category];
  const overallRaw = GROUP_ORDER.reduce((acc, g) => acc + groupScores[g] * weights[g], 0);
  const overallScore = Math.round(overallRaw);

  // 저점 Top3: 점수 오름차순 → 항목 ID 오름차순(결정적 타이브레이크)
  const top3 = applicable
    .map((i) => ({ itemId: i.id, title: i.title, score: scoreById.get(i.id)?.score ?? 0 }))
    .sort((a, b) => a.score - b.score || a.itemId.localeCompare(b.itemId))
    .slice(0, 3);

  return { groupScores, overallScore, top3 };
}

/** 아이템 정의를 붙여 블록5 렌더용 행을 만든다 */
export function toBlock5Items(category: Category, items: ScoredItem[]) {
  const applicable = applicableItems(category);
  const scoreById = new Map(items.map((i) => [i.itemId, i]));
  return applicable.map((def) => {
    const scored = scoreById.get(def.id);
    return {
      itemId: def.id,
      group: def.group,
      title: def.title,
      criterion: rubricItem(def.id).criterion,
      score: scored?.score ?? 0,
      evidenceQuote: scored?.evidenceQuote ?? '',
      corpusRef: scored?.corpusRef ?? '',
    };
  });
}
