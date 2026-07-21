/**
 * 리포트 파이프라인 단계 라벨 — 처리 화면(PROCESS-02)·플로팅 진행 패널(MAIN-05a) 공유.
 * 단계 키는 lib/server/reportJob.ts가 기록하는 stage 값(08 §3.3).
 */

export const REPORT_STAGE_LABELS: Record<string, string> = {
  normalize: '콘텐츠 정규화 · 문장 분해',
  presignals: '신뢰 장치 신호 추출',
  llmCalls: '루브릭 채점 · 薬機法 감사 · 페르소나 (병렬 진단 중)',
  persona: '페르소나 · USP 재정의 (브랜드 진단)',
  aggregate: '점수 집계 (결정적)',
  benchmark: '코퍼스 벤치마크 대비',
  call4: 'NG/OK 재작성 · 총평 생성',
  assemble: '리포트 조립',
};

/** 처리 화면 7단계 표시 순서 — llmCalls·persona(브랜드 진단)는 같은 슬롯을 공유한다 */
export const REPORT_STAGE_STEPS: { keys: string[]; label: string }[] = [
  { keys: ['normalize'], label: '콘텐츠 정규화 · 문장 분해' },
  { keys: ['presignals'], label: '신뢰 장치 신호 추출' },
  { keys: ['llmCalls', 'persona'], label: '루브릭 채점 · 薬機法 감사 · 페르소나 (병렬 진단 중)' },
  { keys: ['aggregate'], label: '점수 집계 (결정적)' },
  { keys: ['benchmark'], label: '코퍼스 벤치마크 대비' },
  { keys: ['call4'], label: 'NG/OK 재작성 · 총평 생성' },
  { keys: ['assemble'], label: '리포트 조립' },
];

/** 현재 stage 키 → 7단계 인덱스(모르는 키·null은 0) */
export function reportStageIndex(stage: string | null): number {
  if (!stage) return 0;
  const idx = REPORT_STAGE_STEPS.findIndex((s) => s.keys.includes(stage));
  return idx === -1 ? 0 : idx;
}
