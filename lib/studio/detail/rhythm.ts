/**
 * 밴드 리듬 — 확정된 블록 시퀀스 전체를 받아 블록별 톤·높이·간격을 낸다.
 * 정본: docs/specs/02-detail-converter-spec.md §2-6 · 참조 구현: docs/specs/02-studio/detail-proto.js §6.
 *
 * 왜 블록 단위 순수 함수로는 만들 수 없는가: 톤 교대가 **앞 블록에 의존**하는 접기(fold) 연산이다.
 * 종전 `BlockRenderContext` 는 `{brandName, hasBackground}` 뿐이라 블록이 자기가 몇 번째인지,
 * 앞뒤가 뭔지 몰랐다 — "슬라이드 나열"의 근본 원인은 블록 하나하나의 디자인이 아니라
 * **블록들 사이에 관계가 없다는 것**이었다.
 *
 * LLM 미개입 · 완전 결정적. 같은 시퀀스면 같은 배열이 나온다 —
 * 그래서 블록 재생성 경로도 같은 함수를 같은 순서에 적용해 색·톤이 흔들리지 않는다.
 */

import { getBlock, type BlockPlan } from './blockPack';
import { MAX_TOTAL_HEIGHT } from './output';
import { fade, mixWhite, NEUTRAL_BODY, NEUTRAL_INK, type DetailTheme } from './theme';

/** 밴드 톤 4종. */
export type BandTone = 'paper' | 'tint' | 'accent' | 'ink';

/** 블록의 바탕 성격 — 사진이 밴드를 채우는가, 색면 위에 텍스트가 앉는가. */
export type BandSurface = 'photo' | 'inset';

/** 아래 여백 밀도. 붙어야 할 섹션과 무관한 섹션의 간격이 같으면 리듬이 죽는다. */
export type BandDensity = 'compact' | 'normal' | 'spacious';

/** 비주얼 높이 프리셋(px) — 생성 크기 1024×1536(≒2:3)과 맞물린다. */
export const VISUAL_HEIGHT: Record<'hero' | 'band' | 'strip', number> = {
  /** 히어로·브랜드 스토리. 생성 비율(0.667)에 가장 가까워 좌우 잘림이 최소 */
  hero: 2000,
  /** 문제 제기·사용 씬·퍼스널컬러. 기본 */
  band: 1500,
  /** 텍스처·발색·비교 도해. 좌우 잘림이 크지만 세이프마진이 완화한다 */
  strip: 1040,
};

/** 총 높이가 이 비율을 넘으면 프리셋을 한 단계씩 강등한다. */
export const HEIGHT_GUARD_RATIO = 0.85;

/** 톤 리듬 파라미터 — 강한 톤이 페이지를 지배하지 않게 막는다. */
export const TONE_RHYTHM = { maxAccent: 2, maxInk: 2 } as const;

/** 밀도별 하단 여백(px). */
export const DENSITY_GAP: Record<BandDensity, number> = { compact: 32, normal: 56, spacious: 96 };

/** 텍스트 블록의 대략 높이(px) — **총높이 가드 추정용**이다. 실제 높이는 센티넬이 잰다. */
const TEXT_HEIGHT: Record<string, number> = {
  stat: 620, head: 700, list: 1180, table: 980, chips: 620,
  graph: 900, swatches: 780, card: 900, note: 520,
};
const TEXT_HEIGHT_DEFAULT = 800;

export interface BandPlan {
  seq: number;
  blockId: string;
  tone: BandTone;
  surface: BandSurface;
  /** 배경컷 블록이면 프리셋, 텍스트 블록이면 null */
  heightPreset: 'hero' | 'band' | 'strip' | null;
  /** 배경컷 블록의 고정 높이. 텍스트 블록에서는 추정치라 렌더가 쓰지 않는다 */
  height: number;
  density: BandDensity;
  /** 챕터 오프너면 `{index, total}` — 좌측 레일과 `03 / 06` 인덱스를 받는다 */
  chapter: { index: number; total: number } | null;
  /** 다음 밴드 톤. 이음새 노치를 그 색으로 그린다 */
  nextTone: BandTone | null;
  seam: 'notch' | 'none';
}

/**
 * 시퀀스 전체를 접어 밴드 배열을 만든다.
 *
 * 교대 규칙(§2-6):
 *  1. 비주얼 블록은 `paper` — 사진이 밴드를 채우므로 이 톤은 **배경컷 생성 실패 시의 폴백 배경**이다.
 *  2. 비주얼 블록에 **인접한** 블록은 `accent`·`ink` 금지. 사진 옆 강한 색면은 사진을 죽인다.
 *  3. `accent`·`ink` 는 페이지당 각 최대 2회, 서로 인접 금지.
 *  4. 팩 `tonePreference` 가 우선.
 *  5. 그 외(`auto`)는 `paper` 2연속 금지로 교대한다.
 *
 * ⚠ 초안의 "비주얼 인접은 paper 강제"는 **폐기됐다.** tint 교대까지 막아 D3 에서 paper 가
 *   11연속으로 이어졌다 — 고치려던 문제를 그대로 재생산했다. 금지 대상은 강한 톤으로만 좁힌다.
 *
 * @param blocks planBlocks() 가 확정한 시퀀스(순서 그대로)
 */
export function planLayout(blocks: BlockPlan[]): BandPlan[] {
  const defs = blocks.map((b) => getBlock(b.blockId));
  const isVisual = (i: number): boolean => {
    const d = defs[i];
    return d !== undefined && d.renderKind !== 'text';
  };

  const out: BandPlan[] = [];
  let accentUsed = 0;
  let inkUsed = 0;
  let prev: BandTone | null = null;

  defs.forEach((d, i) => {
    const nearVisual = isVisual(i - 1) || isVisual(i + 1);
    const strongPrev = prev === 'accent' || prev === 'ink';
    const strongOk = !nearVisual && !strongPrev;
    const pref = d.tonePreference ?? 'auto';

    let tone: BandTone;
    if (isVisual(i)) tone = 'paper';
    else if (pref === 'accent' && strongOk && accentUsed < TONE_RHYTHM.maxAccent) tone = 'accent';
    else if (pref === 'ink' && strongOk && inkUsed < TONE_RHYTHM.maxInk) tone = 'ink';
    else if (pref === 'paper') tone = 'paper';
    else if (pref === 'tint') tone = prev === 'tint' ? 'paper' : 'tint';
    else tone = prev === 'paper' ? 'tint' : 'paper';

    if (tone === 'accent') accentUsed += 1;
    if (tone === 'ink') inkUsed += 1;
    prev = tone;

    const preset = isVisual(i) ? (d.heightPreset ?? 'band') : null;
    out.push({
      seq: blocks[i].seq,
      blockId: d.id,
      tone,
      surface: isVisual(i) ? 'photo' : 'inset',
      heightPreset: preset,
      height: preset ? VISUAL_HEIGHT[preset] : (TEXT_HEIGHT[d.glyph ?? ''] ?? TEXT_HEIGHT_DEFAULT),
      density: 'normal',
      chapter: null,
      nextTone: null,
      seam: 'none',
    });
  });

  // 총 높이 안전판 — 넘치면 프리셋을 한 단계씩 강등한다.
  // 없으면 결합 단계가 뒤쪽 블록을 잘라내고 **각주 블록이 사라진다**(조용한 법적 사고).
  const guard = MAX_TOTAL_HEIGHT * HEIGHT_GUARD_RATIO;
  for (let pass = 0; pass < 2 && totalHeight(out) > guard; pass++) {
    for (const b of out) {
      if (b.heightPreset === 'hero') { b.heightPreset = 'band'; b.height = VISUAL_HEIGHT.band; }
      else if (b.heightPreset === 'band') { b.heightPreset = 'strip'; b.height = VISUAL_HEIGHT.strip; }
    }
  }

  // 챕터 인덱스 · 밀도 · 이음새
  const chapters = defs.filter((d) => d.chapterOpener).length;
  let n = 0;
  out.forEach((b, i) => {
    if (defs[i].chapterOpener) {
      n += 1;
      b.chapter = { index: n, total: chapters };
      b.density = 'spacious';
    } else if (defs[i - 1] && !defs[i - 1].chapterOpener) {
      // 앞 블록이 절 시작이 아니면 = 같은 절 안이다 → 붙인다
      b.density = 'compact';
    }
    const next = out[i + 1];
    b.nextTone = next ? next.tone : null;
    // 노치는 색면 밴드끼리의 경계에만. 사진 밴드에 삼각형을 얹으면 사진을 해친다
    b.seam = next && next.tone !== b.tone && b.surface === 'inset' && next.surface === 'inset' ? 'notch' : 'none';
  });

  return out;
}

/** 추정 총 높이 — 총높이 가드에 쓴다. */
export function totalHeight(list: BandPlan[]): number {
  return list.reduce((s, b) => s + b.height, 0);
}

/** 톤 구성 요약 — "paper 8 · tint 4 · accent 1 · ink 1". 게이트·로그가 그대로 쓴다. */
export function toneSummary(layout: BandPlan[]): string {
  const c: Record<BandTone, number> = { paper: 0, tint: 0, accent: 0, ink: 0 };
  for (const b of layout) c[b.tone] += 1;
  return (['paper', 'tint', 'accent', 'ink'] as BandTone[])
    .filter((k) => c[k] > 0)
    .map((k) => `${k} ${c[k]}`)
    .join(' · ');
}

/** 한 밴드의 표면 색 묶음. satori 트리가 이 값만 참조한다(모듈 전역 토큰 없음). */
export interface BandSurfaceTokens {
  bg: string;
  ink: string;
  body: string;
  mute: string;
  /** 소형 텍스트·링크에 쓰는 accent(AA 확보분) */
  accent: string;
  /** 바·점·칩 테두리 같은 **큰 면적 채움**에 쓰는 원색 */
  fill: string;
  rule: string;
  card: string;
  /** 알약 배지·스펙 카드처럼 accent 글자를 얹는 연한 면 */
  softFill: string;
  /** `softFill` 위에서 읽히는 글자색 */
  softInk: string;
}

/**
 * 밴드 톤 4종의 표면 색. 정본: §2-6 표.
 *
 * **대비 규칙 2줄**
 *  - `accent` 배경에는 `onAccent` 가 정한 글자색만. 흰 글자 on 코랄류는 2.89:1 로
 *    큰 텍스트 기준(3:1)에도 미달한다 — 흰 글자를 강제하지 않는다.
 *  - 텍스트에는 `accentStrong`, 큰 면적 채움에는 `accent` 원색. 극단 색에서 브랜드색이 완전히 죽는 걸 막는다.
 *
 * @param tone 밴드 톤
 * @param th 해석된 테마
 */
export function surfaceFor(tone: BandTone, th: DetailTheme): BandSurfaceTokens {
  if (tone === 'tint') {
    // ⚠ 배경은 th.surface(0.965 혼합)가 **아니라** 0.90 혼합이다.
    // surface 는 AI 배경컷 프롬프트용 연한 색이고, 그대로 밴드에 쓰면 흰색과 3.5% 차이라
    // 교대가 눈에 보이지 않는다 — 리듬 장치가 있는데 없는 것처럼 보이던 원인.
    return {
      bg: mixWhite(th.accent, 0.9), ink: NEUTRAL_INK, body: NEUTRAL_BODY, mute: 'rgba(55,56,60,0.66)',
      accent: th.accentStrong, fill: th.accent, rule: mixWhite(th.accent, 0.74), card: '#ffffff',
      softFill: '#ffffff', softInk: th.accentStrong,
    };
  }
  if (tone === 'accent') {
    // 배경은 원색이 아니라 accentBand — 4.5:1 이 나오도록 민 색이다.
    return {
      bg: th.accentBand, ink: th.onAccent, body: th.onAccent, mute: fade(th.onAccent, 0.72),
      accent: th.onAccent, fill: th.onAccent, rule: fade(th.onAccent, 0.24), card: '#ffffff',
      // 반투명 면(fade)을 쓰면 실제 대비를 계산할 수 없고 배지 글자가 밴드에 묻힌다.
      // 불투명 흰 알약 + accentStrong 글자가 강한 색면 위에서 가장 확실하게 읽힌다.
      softFill: '#ffffff', softInk: th.accentStrong,
    };
  }
  if (tone === 'ink') {
    return {
      bg: NEUTRAL_INK, ink: '#ffffff', body: 'rgba(255,255,255,0.78)', mute: 'rgba(255,255,255,0.58)',
      accent: mixWhite(th.accent, 0.35), fill: mixWhite(th.accent, 0.2), rule: 'rgba(255,255,255,0.18)', card: '#2b2b30',
      softFill: '#2b2b30', softInk: mixWhite(th.accent, 0.35),
    };
  }
  return {
    bg: '#ffffff', ink: NEUTRAL_INK, body: NEUTRAL_BODY, mute: 'rgba(55,56,60,0.61)',
    accent: th.accentStrong, fill: th.accent, rule: '#ebebeb', card: '#f7f7f8',
    softFill: th.accentTint, softInk: th.accentStrong,
  };
}
