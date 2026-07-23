/**
 * 리포트 파이프라인 단계 라벨 — 처리 화면(PROCESS-02)·플로팅 진행 패널(MAIN-05a) 공유.
 * 단계 키는 lib/server/reportJob.ts가 기록하는 stage 값(08 §3.3).
 */

export const REPORT_STAGE_LABELS: Record<string, string> = {
  extract: '상세페이지 이미지에서 문구를 읽는 중',
  normalize: '콘텐츠를 정리하는 중',
  presignals: '신뢰 요소를 확인하는 중',
  llmCalls: '일본 기준 채점 · 薬機法 감사 · 페르소나 진단 중',
  persona: '페르소나 · USP를 다시 정의하는 중 (브랜드 진단)',
  aggregate: '점수를 계산하는 중',
  benchmark: '일본 상위 제품과 비교하는 중',
  call4: '일본향 문안을 다시 쓰는 중',
  assemble: '리포트를 구성하는 중',
};

/** 처리 화면 표시 순서 — extract는 이미지 업로드 시에만 도는 첫 단계, llmCalls·persona는 같은 슬롯 공유 */
export const REPORT_STAGE_STEPS: { keys: string[]; label: string }[] = [
  { keys: ['extract'], label: '상세페이지 이미지에서 문구를 읽는 중' },
  { keys: ['normalize'], label: '콘텐츠를 정리하는 중' },
  { keys: ['presignals'], label: '신뢰 요소를 확인하는 중' },
  { keys: ['llmCalls', 'persona'], label: '일본 기준 채점 · 薬機法 감사 · 페르소나 진단 중' },
  { keys: ['aggregate'], label: '점수를 계산하는 중' },
  { keys: ['benchmark'], label: '일본 상위 제품과 비교하는 중' },
  { keys: ['call4'], label: '일본향 문안을 다시 쓰는 중' },
  { keys: ['assemble'], label: '리포트를 구성하는 중' },
];

/** 현재 stage 키 → 7단계 인덱스(모르는 키·null은 0) */
export function reportStageIndex(stage: string | null): number {
  if (!stage) return 0;
  const idx = REPORT_STAGE_STEPS.findIndex((s) => s.keys.includes(stage));
  return idx === -1 ? 0 : idx;
}
