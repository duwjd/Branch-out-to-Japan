/**
 * 리포트 표기 정본 — A~E 그룹 라벨과 그룹 점수 밴딩. 화면·슬라이드·카드가 같은 말을 쓰게 한다.
 *
 * 2026-08-19 추출. 이전에는 ReportView(짧은 라벨) · HomeWidgets(접두 라벨) · slides.ts 세 곳에
 * 사본이 있었고, 세 파일이 서로를 "정본과 동일"이라 주석했지만 실제 문자열은 달랐다.
 * 리포트 카드·요약이 네 번째 사본을 만들지 않도록 여기 한 벌만 둔다.
 *
 * 항목 정의(제목·통과기준)는 `lib/engine/rubric.ts` 가 정본이다 — 이 파일은 표기만 다룬다.
 */

import type { RubricGroup } from '../engine/types';

export const GROUP_ORDER: RubricGroup[] = ['A', 'B', 'C', 'D', 'E'];

/** 그룹 이름 — 좁은 자리(카드·레이더 축)용 */
export const GROUP_LABELS: Record<RubricGroup, string> = {
  A: '신뢰 구축',
  B: '무첨가·안전',
  C: '서사 구조',
  D: '성분 프레이밍',
  E: '카테고리 적합성',
};

/** 그룹 기호를 앞에 붙인 이름 — 목록·범례처럼 A~E 축이 함께 읽혀야 하는 자리용 */
export const GROUP_LABELS_PREFIXED: Record<RubricGroup, string> = {
  A: 'A 신뢰 구축',
  B: 'B 무첨가·안전',
  C: 'C 서사 구조',
  D: 'D 성분 프레이밍',
  E: 'E 카테고리 적합성',
};

export type Band = 'danger' | 'warn' | 'ok';

/** 색만으로 구분하지 않도록 항상 글자와 함께 쓴다 */
export const BAND_LABEL: Record<Band, string> = { danger: '위험', warn: '미흡', ok: '양호' };
export const BAND_BADGE: Record<Band, string> = {
  danger: 'bg-danger-bg text-danger-text',
  warn: 'bg-amber-bg text-amber-text',
  ok: 'bg-green-bg text-green-text',
};
export const BAND_BAR: Record<Band, string> = { danger: 'bg-danger', warn: 'bg-amber', ok: 'bg-green' };

/**
 * 그룹 점수(%) → 위험/미흡/양호.
 *
 * ⚠ **그룹 점수 전용이다.** 종합점수(블록1)에는 시급/보완/양호 같은 밴드 라벨을 붙이지 않는다 —
 * 임계값 근거가 아직 없다(스펙 §9-Q3 미해결 · REPORT-04). 카드·요약·리포트 어디서든 같다.
 * @param score 0~100 그룹 점수
 */
export function scoreBand(score: number): Band {
  if (score < 20) return 'danger';
  if (score < 60) return 'warn';
  return 'ok';
}
