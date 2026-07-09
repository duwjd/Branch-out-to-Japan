/**
 * A~E 루브릭 정의 + 카테고리 가중치 — 정본 그대로 상수화.
 * 항목·통과기준: docs/research/jp-detail-message-patterns.md §4 (변경 금지 — 문서와 함께 갱신)
 * 가중치: docs/specs/01-report-spec.md 블록5 (합=1.00, 파일럿 튜닝 대상 §9-Q2)
 */

import type { Category, RubricGroup, RubricItemId } from './types';

export interface RubricItem {
  id: RubricItemId;
  group: RubricGroup;
  title: string;
  criterion: string;
}

export const RUBRIC_ITEMS: RubricItem[] = [
  { id: 'A1', group: 'A', title: '효능 주장에 근거 라벨', criterion: '効能評価試験済み 등 시험·근거 표기가 있는가' },
  { id: 'A2', group: 'A', title: '조건 각주(※/＊)로 범위 한정', criterion: '※1 角質層まで 식으로 주장의 범위를 스스로 한정했는가' },
  { id: 'A3', group: 'A', title: '등급에 맞는 효능 표현', criterion: '美白·肌荒れ 등은 医薬部外品 有効成分 승인 범위 내인가' },
  { id: 'A4', group: 'A', title: '제3자 지표 제시', criterion: 'ランキング1位+集計日·レビュー○건 등 검증 가능한 외부 지표가 있는가' },
  { id: 'A5', group: 'A', title: '거래 안심 요소 노출', criterion: '送料無料·当日発送 등 거래 리스크를 낮추는 요소가 있는가' },
  { id: 'B1', group: 'B', title: '프리 처방 라벨화', criterion: '合成香料フリー·鉱物油フリー 등 "뺀 것"을 라벨로 명시했는가' },
  { id: 'B2', group: 'B', title: '검증형 안전 소구', criterion: '敏感肌 소구가 주관 형용사에 그치지 않고 無香料·無着色 등 검증형인가' },
  { id: 'C1', group: 'C', title: '문제 제기·공감 도입', criterion: 'こんな経験〜? 식 공감 훅으로 시작하는가' },
  { id: 'C2', group: 'C', title: '원인→근거→결과 구조', criterion: '원인 도식·비교 구조로 정보가 배열되는가' },
  { id: 'C3', group: 'C', title: '즉단정 회피', criterion: '효과를 즉단정하지 않고 근거 뒤에 배치했는가' },
  { id: 'D1', group: 'D', title: '성분 농도·수치', criterion: 'グリシルグリシン 6% 식 농도·수치가 있는가' },
  { id: 'D2', group: 'D', title: '기전·전달 원리 설명', criterion: '성분→전달 원리→기대효과의 기전 설명이 있는가' },
  { id: 'D3', group: 'D', title: '정량 데이터 근거화', criterion: '2倍にUP 등 정량 데이터/그래프로 근거화했는가' },
  { id: 'D4', group: 'D', title: '일본 검색·신뢰 성분 키워드', criterion: 'ナイアシンアミド·CICA 등 일본 검색·신뢰 키워드와 맞는 성분명인가' },
  { id: 'E1', group: 'E', title: 'suncare: 스펙·내수성·사용 씬', criterion: 'SPF/PA·UV耐水性 등급·사용 씬을 명시했는가' },
  { id: 'E2', group: 'E', title: 'makeup: 퍼스널컬러 프레임', criterion: 'ブルベ/イエベ 프레임과 컬러 서사가 있는가' },
  { id: 'E3', group: 'E', title: 'cleansing: 저자극·편의 소구', criterion: '肌に優しい·W洗顔不要 등 저자극·편의를 소구했는가' },
  { id: 'E4', group: 'E', title: 'skincare: 효능평가·등급 근거 축', criterion: '効能評価·医薬部外品 근거 축이 있는가' },
];

/** E군은 제품 카테고리에 해당하는 항목만 채점(분모에서도 제외) — 스펙 블록5 */
const E_ITEM_BY_CATEGORY: Record<Category, RubricItemId> = {
  suncare: 'E1',
  makeup: 'E2',
  cleansing: 'E3',
  skincare: 'E4',
};

/** 카테고리별 그룹 가중치 (합=1.00) — 스펙 블록5 표 그대로 */
export const GROUP_WEIGHTS: Record<Category, Record<RubricGroup, number>> = {
  skincare: { A: 0.3, B: 0.15, C: 0.25, D: 0.2, E: 0.1 },
  suncare: { A: 0.2, B: 0.1, C: 0.1, D: 0.2, E: 0.4 },
  makeup: { A: 0.15, B: 0.1, C: 0.2, D: 0.15, E: 0.4 },
  cleansing: { A: 0.2, B: 0.3, C: 0.15, D: 0.15, E: 0.2 },
};

/** 해당 카테고리에서 채점 대상인 항목 목록(E군 선별은 코드가 한다 — 결정성 계약) */
export function applicableItems(category: Category): RubricItem[] {
  const eItem = E_ITEM_BY_CATEGORY[category];
  return RUBRIC_ITEMS.filter((item) => item.group !== 'E' || item.id === eItem);
}

/** itemId → 정의 조회 */
export function rubricItem(id: RubricItemId): RubricItem {
  const found = RUBRIC_ITEMS.find((item) => item.id === id);
  if (!found) throw new Error(`unknown rubric item: ${id}`);
  return found;
}
