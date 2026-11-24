/**
 * 홈(MAIN) "다음 단계" 판정 — 규칙 기반이다(LLM 호출 없음, 저장 없음).
 *
 * 2026-11-24 홈 개편: 홈 머리가 시즌 D-day 숫자 대신 **지금 할 일 한 가지**를 말한다.
 * YOAKE 는 브랜드 → 진단 → 썸네일 → 상세페이지로 이어지는 파이프라인이라, "다음에 무엇을 하나"는
 * 자산 유무만으로 결정된다. 화면(app/app/page.tsx)이 이 판정을 받아 문구·버튼·미리보기를 고른다.
 * 판정을 화면 밖 순수 함수로 둔 이유: 상태 조합(진행 중·실패·건너뛴 단계)이 많아 테스트로 고정한다.
 * 근거: docs/decisions/2026-11-24-홈-다음단계-히어로.md
 */

/** 준비 흐름 4단계 — 화면 표기 순서가 곧 판정 순서다 */
export const PIPELINE_ORDER = ['brand', 'report', 'thumbnail', 'detail'] as const;
export type PipelineStepId = (typeof PIPELINE_ORDER)[number];

/** 'done' = 완성물 1건 이상 · 'current' = 아직 없는 첫 단계 · 'todo' = 그 뒤 단계 */
export type PipelineState = 'done' | 'current' | 'todo';

/**
 * 홈 히어로가 말하는 한 가지.
 * 'diagnose'·'thumbnail'·'detail' = 준비 흐름의 다음 단계
 * 'season' = 흐름을 다 밟았고 착수 구간에 들어온 시즌이 있다
 * 'steady' = 흐름을 다 밟았고 급한 시즌이 없다
 */
export type HomeStepKey = 'diagnose' | 'thumbnail' | 'detail' | 'season' | 'steady';

/**
 * 같은 단계의 현재 사정.
 * 'ready' = 시작할 수 있다 · 'running' = 이미 만드는 중 · 'failed' = 마지막 시도가 실패했다(진단만)
 */
export type HomeStepMode = 'ready' | 'running' | 'failed';

export interface HomeStepInput {
  /** 발행된 진단 리포트 건수 */
  publishedReports: number;
  /** 진행 중 진단(최신) id — 없으면 null */
  runningReportId: string | null;
  /** 최근 실패한 진단 id — 없으면 null */
  failedReportId: string | null;
  /** 완성된 썸네일 건수 */
  doneThumbnails: number;
  /** 생성 중 썸네일(최신) id — 없으면 null */
  runningThumbnailId: string | null;
  /** 완성된 상세페이지 건수 */
  doneDetails: number;
  /** 생성 중 상세페이지(최신) id — 없으면 null */
  runningDetailId: string | null;
  /** 착수 구간(leadDays)에 들어온 시작 전 시즌이 있는가 */
  seasonInLeadWindow: boolean;
}

export interface HomeStep {
  key: HomeStepKey;
  mode: HomeStepMode;
  /** mode 가 running·failed 일 때 그 대상의 id — 화면이 진행/원인 화면으로 보낸다 */
  targetId: string | null;
}

/**
 * 준비 흐름 4단계의 상태 — 브랜드는 홈에 들어온 시점에 이미 있으므로 항상 done 이다
 * (미등록이면 홈 대신 온보딩이 뜬다). 아직 없는 첫 단계 하나만 current 가 된다.
 * 단계를 건너뛴 경우(진단 없이 썸네일부터 만든 계정)도 그대로 보여 준다 — 없는 순서를 꾸미지 않는다.
 */
export function pipelineStates(input: HomeStepInput): Record<PipelineStepId, PipelineState> {
  const has: Record<PipelineStepId, boolean> = {
    brand: true,
    report: input.publishedReports > 0,
    thumbnail: input.doneThumbnails > 0,
    detail: input.doneDetails > 0,
  };
  const firstMissing = PIPELINE_ORDER.find((id) => !has[id]) ?? null;
  const out = {} as Record<PipelineStepId, PipelineState>;
  for (const id of PIPELINE_ORDER) {
    out[id] = has[id] ? 'done' : id === firstMissing ? 'current' : 'todo';
  }
  return out;
}

/** 완료 단계 수(1~4) — "2/4 단계 완료" 표기용 */
export function pipelineDoneCount(input: HomeStepInput): number {
  return Object.values(pipelineStates(input)).filter((s) => s === 'done').length;
}

/**
 * 홈 히어로의 다음 단계 1개를 정한다.
 * 순서: 진단 → 썸네일 → 상세페이지 → (다 밟았으면) 시즌 착수 여부.
 * 같은 단계라도 이미 만드는 중이면 "시작"이 아니라 "진행 보기"가 다음 할 일이다.
 * 실패는 진단에만 붙인다 — 첫 진단이 실패하면 다음 걸음 자체가 막히지만,
 * 썸네일·상세의 실패는 다시 만들면 되고 홈 알림 줄이 따로 원인 화면으로 보낸다.
 * @param input 자산 유무·진행 중 잡·시즌 착수 여부
 */
export function resolveHomeStep(input: HomeStepInput): HomeStep {
  if (input.publishedReports === 0) {
    if (input.runningReportId) return { key: 'diagnose', mode: 'running', targetId: input.runningReportId };
    if (input.failedReportId) return { key: 'diagnose', mode: 'failed', targetId: input.failedReportId };
    return { key: 'diagnose', mode: 'ready', targetId: null };
  }
  if (input.doneThumbnails === 0) {
    return input.runningThumbnailId
      ? { key: 'thumbnail', mode: 'running', targetId: input.runningThumbnailId }
      : { key: 'thumbnail', mode: 'ready', targetId: null };
  }
  if (input.doneDetails === 0) {
    return input.runningDetailId
      ? { key: 'detail', mode: 'running', targetId: input.runningDetailId }
      : { key: 'detail', mode: 'ready', targetId: null };
  }
  return { key: input.seasonInLeadWindow ? 'season' : 'steady', mode: 'ready', targetId: null };
}
