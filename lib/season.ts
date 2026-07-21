/**
 * 시즌 캘린더 상수 — 다음 메가와리 D-day는 사이드바 KPI·대시보드·라이브러리가 공유한다.
 * (일정 예약 도구가 아니라 "지금 무엇을 준비할지" 보는 조회 전용 데이터 — LIB-02)
 */

export const NEXT_MEGAWARI = { label: '9월 메가와리', month: '9월', date: '2026-09-01' };

/** 대상 날짜까지 남은 일수(음수면 0) */
export function dDay(target: string): number {
  const diff = new Date(target).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}
