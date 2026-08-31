/**
 * 마감 예산 가드 — 300초 안에 이미지를 **몇 장까지** 만들 수 있는지 결정한다.
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
