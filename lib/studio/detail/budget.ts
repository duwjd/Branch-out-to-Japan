/**
 * 마감 예산 가드 — 300초 안에서 잡이 완주하도록 두 가지를 결정한다.
 *  ① 이미지를 **몇 장까지** 만들 수 있는가 (`fitImageBudget`)
 *  ② 앞단 LLM 콜(⑦⑧⑨) 하나에 **얼마를 허용하는가** (`callTimeout`)
 *
 * 왜 필요한가: `maxDuration = 300` 은 Vercel Hobby(Fluid Compute)의 **플랫폼 상한**이라
 * 올릴 수 없다(11 §2). 이미지 캡을 4 → 6으로 올리면서 동시성도 6으로 맞춰 한 웨이브를 유지했지만,
 * 앞단(콜⑧ 번역 · 콜⑦ 카피 · 콜⑨ 윤문)이 평소보다 오래 끌면 이미지 웨이브가 예산 밖으로 밀린다.
 * 그때 그냥 진행하면 함수가 300초에서 통째로 죽고 **모든 블록이** 스테일 가드로 실패한다 —
 * 사진 몇 장을 포기하는 것보다 훨씬 나쁜 결과다.
 *
 * 그래서 웨이브 진입 **직전에** 남은 시간을 재고, 우선순위 낮은 컷부터 텍스트로 강등한다.
 * 우선순위는 `blockPack.imagePriority()` 가 단독 소유한다 — 여기서 규칙을 다시 쓰지 않는다.
 * 순수 함수라 단위 테스트가 가능하다(시간을 인자로 받는 이유).
 */

import type { BlockType } from './output';

/**
 * 잡 전체에 허용하는 벽시계 예산.
 * 300초에서 이미지 이후 단계(satori 15블록 · sharp 결합·분할 · 게이트 · 저장)를 위해 30초를 뗀다.
 */
export const JOB_BUDGET_MS = 270_000;

/** 이미지 웨이브가 끝난 뒤 남겨 둬야 할 시간. 이만큼은 결합·분할이 반드시 쓴다. */
export const COMPOSE_RESERVE_MS = 30_000;

/**
 * 이미지 1장의 기대 소요(실측 40~90초의 상단).
 * 낙관적으로 잡으면 가드가 늦게 걸려 존재 이유가 사라지므로 **비관값**을 쓴다.
 */
export const IMAGE_WAVE_MS = 90_000;

/**
 * 시간 상한을 거는 LLM 콜. 규칙 단계(plan·layout·compose·slice)는 LLM 을 타지 않아 대상이 아니다.
 * 이미지 콜은 `fitImageBudget` 이 `perImageTimeoutMs` 로 따로 준다.
 */
export type DetailCallStage = 'translate' | 'copy' | 'humanize';

/**
 * 콜 1회의 벽시계 상한(재시도 포함).
 *
 * ## 이 상한은 스케줄이 아니라 **폭주 차단선**이다
 *
 * 단계 상한을 "다음 단계들이 쓸 시간을 뺀 값"으로 잡으면 정상 소요까지 잘라 버려
 * 가드가 오히려 실패를 만든다. 그래서 상한은 **실측 최악값에 여유를 얹은 값**으로 두고,
 * 거기에 "결합·분할 몫은 어떤 콜도 먹지 못한다"는 하드캡만 겹친다(`callTimeout`).
 * 정상 실행은 이 가드를 스치지도 않는다. 매달린 콜 하나만 잘린다.
 *
 * **확정이 아니라 실측 갱신 대상이다** — 모델·effort·이미지 캡을 바꾸면 여기부터 다시 잰다.
 * 값은 ① 리포트 `reportBudget.STAGE_CEILING_MS` 와 같은 규칙으로 잡았다.
 */
const CALL_CEILING_MS: Record<DetailCallStage, number> = {
  translate: 90_000, // 콜⑧ inputTranslate — 이미지 없음, 필드 텍스트만
  copy: 150_000, // 콜⑦ detailCopy — maxTokens 12000 + 비전 최대 10장. 파이프라인에서 가장 무겁다
  humanize: 90_000, // 콜⑨ copyHumanize — 슬롯 텍스트만(maxTokens 6000)
};

/**
 * 이 콜에 허용할 벽시계 상한(ms).
 *
 * 0 을 돌려줄 수 있다 — "이 콜을 걸 시간이 없다"는 뜻이고, `runStructuredCall` 이 시도 없이
 * 실패로 접어 상위 폴백(콜⑧ 원문 유지 · 콜⑨ 원문 유지)에 도달한다.
 *
 * @param stage 지금 거는 콜
 * @param remainingMs 잡 마감까지 남은 시간. **마감이 없는 경로는 생략한다**(제출·미리보기·블록
 *   재생성 라우트 — 잡 예산 밖에서 도는 단발 콜이라 단계 상한 자체가 폭주 차단선이 된다)
 */
export function callTimeout(stage: DetailCallStage, remainingMs?: number): number {
  const ceiling = CALL_CEILING_MS[stage];
  if (remainingMs === undefined) return ceiling;
  return Math.max(0, Math.min(ceiling, remainingMs - COMPOSE_RESERVE_MS));
}

/** 예산 배분 후보 1개. `planBlocks` 가 이미 계산해 둔 값을 그대로 받는다. */
export interface ImageCandidate {
  blockId: BlockType;
  /** `imagePriority()` 산출 — 작을수록 먼저 받는다 */
  priority: number;
  /** 시퀀스 위치. 동점을 결정적으로 깨는 데만 쓴다 */
  seq: number;
}

export interface ImageBudgetResult {
  /** 배경컷을 실제로 만들 블록 */
  keep: BlockType[];
  /** 시간이 모자라 포기한 블록 + 화면에 그대로 노출할 한국어 사유 */
  drop: { blockId: BlockType; reason: string }[];
  /** 이번 실행에서 이미지 1콜에 허용할 최대 시간(ms). SDK 요청별 timeout 으로 넘긴다 */
  perImageTimeoutMs: number;
  /** 몇 웨이브로 돌 예정인가(로그·진단용) */
  waves: number;
}

/**
 * 남은 시간에 맞춰 이미지 후보를 자른다.
 *
 * 히어로(priority 0)는 **어떤 경우에도 남긴다.** 제품이 한 번도 서지 않은 상세페이지는
 * 실패한 페이지고, 그럴 바에는 시간을 넘겨 재시도를 받는 편이 낫다.
 *
 * @param candidates 이미지 후보(우선순위·시퀀스 포함, 정렬 여부 무관)
 * @param remainingMs 지금부터 마감까지 남은 시간
 * @param concurrency 동시 실행 수 — 웨이브 수를 정한다
 * @param imageTimeoutMs 이미지 1콜의 기본 상한
 */
export function fitImageBudget(
  candidates: ImageCandidate[],
  remainingMs: number,
  concurrency: number,
  imageTimeoutMs: number,
): ImageBudgetResult {
  const ordered = [...candidates].sort((a, b) => a.priority - b.priority || a.seq - b.seq);
  const usable = Math.max(0, remainingMs - COMPOSE_RESERVE_MS);
  const wavesFor = (n: number) => Math.ceil(n / Math.max(1, concurrency));

  // ⚠ **웨이브 단위로만 자른다.** 한 웨이브 안의 장수를 줄여 봐야 동시에 도니까 시간이 줄지 않는다 —
  //   6장을 5장으로 줄이는 건 사진 한 장을 공짜로 버리는 짓이다. 웨이브가 하나 줄 때만 의미가 있다.
  //   한 웨이브조차 예산을 넘으면 그때는 장수가 아니라 **1콜 상한**을 줄여 대응한다(아래).
  const affordableWaves = Math.max(1, Math.floor(usable / IMAGE_WAVE_MS));
  const keepCount = Math.max(1, Math.min(ordered.length, affordableWaves * Math.max(1, concurrency)));

  const keep = ordered.slice(0, keepCount);
  const drop = ordered.slice(keepCount).map((c) => ({
    blockId: c.blockId,
    reason:
      '남은 생성 시간이 부족해 이 블록은 배경컷 없이 만들었습니다. 결과 화면에서 이 블록만 다시 만들 수 있습니다.',
  }));

  // 1콜 상한을 남은 시간에 맞춰 줄인다 — 한 콜이 매달려 예산을 통째로 먹지 않게.
  // 하한 30초: 이보다 짧으면 정상 호출(실측 40~90초)까지 자르게 되어 가드가 오히려 실패를 만든다.
  const perWave = keep.length > 0 ? Math.floor(usable / wavesFor(keep.length)) : imageTimeoutMs;
  const perImageTimeoutMs = Math.max(30_000, Math.min(imageTimeoutMs, perWave));

  return { keep: keep.map((c) => c.blockId), drop, perImageTimeoutMs, waves: wavesFor(keep.length) };
}
