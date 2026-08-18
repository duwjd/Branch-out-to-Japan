/**
 * 배경컷 여백 실측 — 생성된 사진에서 **제품이 없는 구역**을 찾아 카피를 거기에 앉힌다.
 *
 * 왜 필요한가: 종전에는 배경컷 블록의 텍스트가 화면 세로 중앙에 92% 불투명 흰 카드로 얹혔다.
 * 제품은 대체로 화면 가운데 있으므로 **카드가 곧 제품을 덮었다.** 하단 고정으로 바꾸는 것도
 * 답이 아니다 — 제품이 하단에 놓인 컷에서 같은 문제가 그대로 재발한다.
 * 그래서 위치를 고정하지 않고 **매번 실제 픽셀을 재서** 정한다.
 *
 * 왜 LLM 비전이 아닌가: 배경컷은 콜⑦(카피) **이후에** 생성되므로 기존 비전 콜을 재사용할 수 없고,
 * 블록마다 비전 콜을 새로 붙이면 최대 4콜·수십 초가 더 든다. 게다가 여백 탐지는
 * "무엇이 그려졌나"가 아니라 "어디가 비었나"라 픽셀 통계로 충분하고, 결정적이라
 * 블록 재생성 시 배치가 흔들리지 않는다.
 *
 * 비용: 64×96 그레이스케일 다운스케일 1회(6,144바이트) + 24셀 통계. 실측 수 ms.
 */

import sharp from 'sharp';
import { contrastRatio, NEUTRAL_INK, rgbToHex } from './theme';

/** 분석 격자 — 4열 × 6행 = 24셀. 세로로 긴 밴드(1024×1536 ≒ 2:3)에 맞춰 행을 더 잘게 썬다. */
const COLS = 4;
const ROWS = 6;
/** 다운스케일 크기. 셀당 16×16px 이면 엣지 밀도가 안정적으로 나온다(실측). */
const SAMPLE_W = COLS * 16;
const SAMPLE_H = ROWS * 16;

/** 텍스트가 앉을 최소 면적 — 전체 24셀의 25%(=6셀). 이보다 좁으면 카피가 넘친다. */
const MIN_ZONE_CELLS = 6;

/** 스크림 알파 상한. */
const MAX_SCRIM_ALPHA = 0.92;

/**
 * "충분히 비었다"고 볼 점수 상한.
 * 실측 대역: 스튜디오 배경·그라디언트 0.00~0.04 · 부드러운 소품 0.05~0.09 ·
 * 제품 용기나 잎사귀 같은 구조물 0.12~0.30.
 *
 * ⚠ 대비 계산만으로는 이 판정을 대신할 수 없다 — 알파를 상한까지 올리면 **어떤 사진 위에서도**
 *   대비는 확보되기 때문이다. "읽히는가"와 "제품을 안 가리는가"는 다른 질문이고, 여기서 보는 건 후자다.
 */
const CALM_SCORE_LIMIT = 0.1;

/**
 * 다운스케일 때문에 미세 질감(천 결·필름 노이즈)은 평균으로 지워진다 — **의도한 동작**이다.
 * 우리가 재려는 것은 구도 규모의 구조물(제품·소품·잎)이지 표면 질감이 아니다.
 */

/** 어두운 스크림 색(잉크 계열 회흑) · 밝은 스크림 색. */
const SCRIM_DARK = '#121214';
const SCRIM_LIGHT = '#ffffff';

/** 본문 기준 대비. 캐치카피는 크지만 보조 카피·각주가 같은 구역에 앉으므로 4.5:1 을 목표로 한다. */
const TARGET_CONTRAST = 4.5;

/**
 * 그라디언트는 시작 가장자리에서 최대, 반대쪽에서 0이다. 텍스트는 최대 쪽에 붙지만
 * 여러 줄이면 옅은 쪽까지 걸치므로 **실효 알파를 보수적으로 80%로 잡고** 계산한다.
 */
const EFFECTIVE_ALPHA_RATIO = 0.8;

export type ScrimDirection = 'to top' | 'to bottom' | 'to left' | 'to right';

/** 텍스트가 앉을 구역과 그 구역을 읽히게 만드는 처리. 0~1 정규화 좌표. */
export interface CopyPlacement {
  zone: { top: number; left: number; width: number; height: number };
  vAlign: 'top' | 'center' | 'bottom';
  hAlign: 'left' | 'center' | 'right';
  /** 이 구역 위에서 읽히는 글자색 계열 */
  textTone: 'light' | 'dark';
  scrim: { direction: ScrimDirection; alpha: number; color: string };
  /** 0~1. 낮으면 화면이 빽빽해 마땅한 여백이 없었다는 뜻 */
  confidence: number;
  /** 화면·로그에 그대로 쓰는 한국어 사유 */
  reason: string;
}

interface Candidate {
  id: string;
  labelKo: string;
  col0: number;
  col1: number; // 배타적
  row0: number;
  row1: number; // 배타적
  direction: ScrimDirection;
  vAlign: CopyPlacement['vAlign'];
  hAlign: CopyPlacement['hAlign'];
}

/**
 * 후보 구역 — 전부 **가장자리에 붙는다.**
 * 화면 한가운데 떠 있는 카드는 다시 사진을 가리는 장치가 되므로 마지막 폴백에만 둔다.
 * 배열 순서가 곧 동점 시 우선순위다(일본 상세 관례상 하단 → 상단 → 좌우).
 */
const CANDIDATES: readonly Candidate[] = [
  { id: 'bottom-band', labelKo: '하단', col0: 0, col1: 4, row0: 4, row1: 6, direction: 'to top', vAlign: 'bottom', hAlign: 'left' },
  { id: 'bottom-half', labelKo: '하단 절반', col0: 0, col1: 4, row0: 3, row1: 6, direction: 'to top', vAlign: 'bottom', hAlign: 'left' },
  { id: 'top-band', labelKo: '상단', col0: 0, col1: 4, row0: 0, row1: 2, direction: 'to bottom', vAlign: 'top', hAlign: 'left' },
  { id: 'top-half', labelKo: '상단 절반', col0: 0, col1: 4, row0: 0, row1: 3, direction: 'to bottom', vAlign: 'top', hAlign: 'left' },
  { id: 'left-half', labelKo: '좌측', col0: 0, col1: 2, row0: 0, row1: 6, direction: 'to right', vAlign: 'center', hAlign: 'left' },
  { id: 'right-half', labelKo: '우측', col0: 2, col1: 4, row0: 0, row1: 6, direction: 'to left', vAlign: 'center', hAlign: 'right' },
  { id: 'bottom-left', labelKo: '좌하단', col0: 0, col1: 2, row0: 3, row1: 6, direction: 'to top', vAlign: 'bottom', hAlign: 'left' },
  { id: 'bottom-right', labelKo: '우하단', col0: 2, col1: 4, row0: 3, row1: 6, direction: 'to top', vAlign: 'bottom', hAlign: 'right' },
  { id: 'top-left', labelKo: '좌상단', col0: 0, col1: 2, row0: 0, row1: 3, direction: 'to bottom', vAlign: 'top', hAlign: 'left' },
  { id: 'top-right', labelKo: '우상단', col0: 2, col1: 4, row0: 0, row1: 3, direction: 'to bottom', vAlign: 'top', hAlign: 'right' },
  { id: 'center-band', labelKo: '중앙', col0: 0, col1: 4, row0: 2, row1: 4, direction: 'to top', vAlign: 'center', hAlign: 'left' },
];

interface Cell {
  /** 평균 밝기 0~1 */
  luma: number;
  /** 이웃 픽셀 절대차 평균 0~1 — 제품·소품·질감이 있으면 높다 */
  busy: number;
}

/**
 * 그레이스케일 raw 를 24셀 통계로 접는다.
 * @param data 길이 SAMPLE_W × SAMPLE_H 의 1채널 바이트
 */
function toCells(data: Uint8Array | Buffer): Cell[] {
  const cw = SAMPLE_W / COLS;
  const ch = SAMPLE_H / ROWS;
  const cells: Cell[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x0 = c * cw;
      const y0 = r * ch;
      let sum = 0;
      let diff = 0;
      let diffN = 0;
      for (let y = y0; y < y0 + ch; y++) {
        for (let x = x0; x < x0 + cw; x++) {
          const v = data[y * SAMPLE_W + x];
          sum += v;
          // 간이 엣지 밀도 — 오른쪽·아래 이웃과의 절대차
          if (x + 1 < SAMPLE_W) {
            diff += Math.abs(v - data[y * SAMPLE_W + x + 1]);
            diffN += 1;
          }
          if (y + 1 < SAMPLE_H) {
            diff += Math.abs(v - data[(y + 1) * SAMPLE_W + x]);
            diffN += 1;
          }
        }
      }
      const n = cw * ch;
      cells.push({ luma: sum / n / 255, busy: diffN === 0 ? 0 : diff / diffN / 255 });
    }
  }
  return cells;
}

/** 후보 구역이 덮는 셀들. */
function cellsOf(cells: Cell[], cand: Candidate): Cell[] {
  const out: Cell[] = [];
  for (let r = cand.row0; r < cand.row1; r++) {
    for (let c = cand.col0; c < cand.col1; c++) out.push(cells[r * COLS + c]);
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** 0~1 밝기를 회색 hex 로. 대비 계산에 쓴다. */
function greyHex(luma: number): string {
  const v = Math.max(0, Math.min(255, Math.round(luma * 255)));
  return rgbToHex(v, v, v);
}

/**
 * 목표 대비를 만족하는 최소 스크림 알파를 이분 탐색한다.
 * @returns 알파(0~MAX_SCRIM_ALPHA). 상한에서도 목표에 못 미치면 상한을 돌려주고 호출부가 신뢰도를 깎는다
 */
function solveScrimAlpha(zoneLuma: number, scrimColor: string, textColor: string): { alpha: number; reached: boolean } {
  const scrimLuma = scrimColor === SCRIM_DARK ? 0.07 : 1;
  const at = (a: number): number => {
    const eff = a * EFFECTIVE_ALPHA_RATIO;
    return contrastRatio(textColor, greyHex(eff * scrimLuma + (1 - eff) * zoneLuma));
  };
  if (at(0) >= TARGET_CONTRAST) return { alpha: 0, reached: true };
  if (at(MAX_SCRIM_ALPHA) < TARGET_CONTRAST) return { alpha: MAX_SCRIM_ALPHA, reached: false };

  let lo = 0;
  let hi = MAX_SCRIM_ALPHA;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) >= TARGET_CONTRAST) hi = mid;
    else lo = mid;
  }
  return { alpha: Math.round(hi * 100) / 100, reached: true };
}

/** 배경컷이 없을 때(생성 실패 폴백 등) 쓰는 중립 배치 — 스크림 없음. */
export const INSET_PLACEMENT: CopyPlacement = {
  zone: { top: 0, left: 0, width: 1, height: 1 },
  vAlign: 'center',
  hAlign: 'left',
  textTone: 'dark',
  scrim: { direction: 'to top', alpha: 0, color: SCRIM_DARK },
  confidence: 1,
  reason: '배경컷 없음 — 흰 배경에 잉크 텍스트',
};

/**
 * 배경컷을 실측해 카피를 앉힐 구역을 정한다.
 *
 * 1. 64×96 그레이스케일로 다운스케일해 24셀의 평균 밝기·엣지 밀도를 낸다.
 * 2. 가장자리에 붙는 후보 11종 중 **가장 비어 있는(엣지 밀도가 낮고 고른)** 구역을 고른다.
 * 3. 그 구역의 밝기로 글자색을 정하고, 4.5:1 이 나올 때까지 스크림 알파를 이분 탐색한다.
 * 4. 상한에서도 대비가 안 나오면(=화면이 전부 빽빽) 하단 밴드 + 최대 강도로 폴백하고
 *    **그 사실을 사유로 남긴다** — 조용히 가리지 않는다.
 *
 * @param background 생성된 배경컷 PNG 버퍼
 */
export async function analyzeSafeArea(background: Buffer): Promise<CopyPlacement> {
  let cells: Cell[];
  try {
    const { data } = await sharp(background)
      .resize(SAMPLE_W, SAMPLE_H, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    cells = toCells(data);
  } catch {
    // 디코딩 실패는 배치 실패로 번지지 않게 한다 — 가장 안전한 하단 강스크림으로 간다
    return fallbackPlacement('배경컷을 분석하지 못해 하단에 강한 그라디언트로 배치했습니다.');
  }

  const scored = CANDIDATES.map((cand) => {
    const cs = cellsOf(cells, cand);
    const busy = cs.map((c) => c.busy);
    return {
      cand,
      cells: cs,
      luma: mean(cs.map((c) => c.luma)),
      /** 넓이 보너스를 뺀 순수 밀도. 신뢰도·여백 판정은 이 값으로 한다 */
      density: mean(busy) + stdev(busy) * 0.6,
      // 고르게 비어 있어야 좋은 구역이다 — 평균이 낮아도 한쪽에 제품이 걸치면 표준편차가 올라간다.
      // 넓이 보너스: **엇비슷하게 빈 구역이라면 넓은 쪽이 낫다.** 좁은 구역에 앉으면 헤드라인이
      // 어절 중간에서 꺾이고 글자도 작아진다(templates.tsx `widthFit`). 실측 밀도차(0.01~0.05)보다
      // 작게 잡아 **거의 동점일 때만** 갈리게 한다.
      score: mean(busy) + stdev(busy) * 0.6 - (cs.length / (COLS * ROWS)) * 0.03,
    };
  }).filter((s) => s.cells.length >= MIN_ZONE_CELLS);

  // 동점·근소차는 CANDIDATES 배열 순서(하단 → 상단 → 좌우)로 가른다
  let best = scored[0];
  for (const s of scored) if (s.score < best.score - 1e-6) best = s;

  const textTone: 'light' | 'dark' = best.luma < 0.52 ? 'light' : 'dark';
  const textColor = textTone === 'light' ? '#ffffff' : NEUTRAL_INK;
  const scrimColor = textTone === 'light' ? SCRIM_DARK : SCRIM_LIGHT;
  const solved = solveScrimAlpha(best.luma, scrimColor, textColor);

  // 가장 나은 후보조차 빽빽하면 **자리는 그대로 두되** 그라디언트를 최대로 올리고 신뢰도를 0으로 떨군다.
  // 하단으로 되돌리지 않는 이유: 제품이 하단인 컷에서 그게 바로 가림을 재생산한다.
  const calm = best.density <= CALM_SCORE_LIMIT;
  const alpha = calm && solved.reached ? solved.alpha : MAX_SCRIM_ALPHA;
  const confidence = calm && solved.reached ? Math.max(0, Math.min(1, 1 - best.density / CALM_SCORE_LIMIT)) : 0;
  const reason = calm && solved.reached
    ? `${best.cand.labelKo} 여백에 배치(밀도 ${best.density.toFixed(3)} · 밝기 ${best.luma.toFixed(2)} · 스크림 ${alpha}).`
    : `배경컷 전체가 빽빽해 뚜렷한 여백을 찾지 못했습니다(밀도 ${best.density.toFixed(3)}). ` +
      `${best.cand.labelKo}에 강한 그라디언트로 배치했으니 결과를 확인해 주세요.`;

  return {
    zone: {
      top: best.cand.row0 / ROWS,
      left: best.cand.col0 / COLS,
      width: (best.cand.col1 - best.cand.col0) / COLS,
      height: (best.cand.row1 - best.cand.row0) / ROWS,
    },
    vAlign: best.cand.vAlign,
    hAlign: best.cand.hAlign,
    textTone,
    scrim: { direction: best.cand.direction, alpha, color: scrimColor },
    confidence,
    reason,
  };
}

/** 여백을 못 찾았을 때 — 하단 + 최대 강도 어두운 그라디언트 + 흰 글자. */
function fallbackPlacement(reason: string): CopyPlacement {
  return {
    zone: { top: 4 / ROWS, left: 0, width: 1, height: 2 / ROWS },
    vAlign: 'bottom',
    hAlign: 'left',
    textTone: 'light',
    scrim: { direction: 'to top', alpha: MAX_SCRIM_ALPHA, color: SCRIM_DARK },
    confidence: 0,
    reason,
  };
}
