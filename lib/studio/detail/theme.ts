/**
 * 상세페이지 테마 해석 — 정본: docs/specs/02-detail-converter-spec.md §2-7.
 * 참조 구현: docs/specs/02-studio/detail-proto.js (§1 색 유틸 · §2 프리셋 · §3 추출 · §4 해석).
 * 판정식이 스펙 표와 어긋나면 **문서가 아니라 코드가 틀린 것**이다.
 *
 * 관통 원칙 4 — **산출물의 색은 고객 브랜드의 것이다.**
 * 여기서 나온 색은 생성 산출물(satori 블록·AI 배경컷 프롬프트)에만 쓰이고,
 * YOAKE 앱 화면의 일출 코랄 디자인시스템(app/globals.css)과는 아무 관계가 없다.
 * 그래서 잉크·본문 색도 로고 네이비(#182333)가 아니라 중립 회흑을 쓴다 —
 * 고객 상세페이지에 우리 브랜드 아이덴티티가 새어 나가면 안 된다.
 *
 * ⚠ fs 미사용 **클라이언트 안전 잎 노드**다(output.ts 관례).
 *   생성 폼(브라우저)과 서버 파이프라인이 같은 함수를 호출해 미리보기와 산출이 어긋나지 않게 한다.
 *   픽셀 읽기는 이 모듈이 하지 않는다 — 호출부가 RGBA 버퍼를 만들어 넘긴다(서버 sharp / 브라우저 canvas).
 */

import type { ProductCategory } from './blockPack';

/* ────────────────────────────────────────────────────────────────────────────
 * 1. 색 유틸 — 순수 함수
 * ──────────────────────────────────────────────────────────────────────────── */

/** 생성 산출물의 중립 잉크. YOAKE 로고 네이비가 아니다(위 주석 참조). */
export const NEUTRAL_INK = '#202124';
export const NEUTRAL_BODY = '#414245';

/**
 * `#rgb`·`#rrggbb` 만 허용한다. 그 외(빈값·8자리·css 함수·문자열 주입)는 null.
 * 여기서 sanitize 하지 않으면 사용자 문자열이 그대로 satori 스타일과 AI 프롬프트에 들어간다.
 * @param raw 사용자 입력 또는 저장값
 */
export function normalizeHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  return null;
}

/** hex → RGB 0~255. 잘못된 값은 검정으로 접는다(normalizeHex 를 먼저 통과시킬 것). */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex) ?? '#000000';
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
}

/** RGB → hex. 범위 밖 값은 클램프한다. */
export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number): string => {
    const c = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return c.length === 1 ? `0${c}` : c;
  };
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** RGB → HSV. h 0~360, s·v 0~1. */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** HSV → RGB 0~255. */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const t =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return { r: (t[0] + m) * 255, g: (t[1] + m) * 255, b: (t[2] + m) * 255 };
}

function srgbChannel(c: number): number {
  const n = c / 255;
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 상대휘도 0~1. */
export function luminance(hex: string): number {
  const c = hexToRgb(hex);
  return 0.2126 * srgbChannel(c.r) + 0.7152 * srgbChannel(c.g) + 0.0722 * srgbChannel(c.b);
}

/** WCAG 2.1 대비비 1~21. */
export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * sRGB 채널 균등 스케일로 어둡게 한다.
 * HSL 명도 조작과 달리 R:G:B 비율이 유지되므로 **HSV 색상(hue)과 채도(S)가 정확히 보존**된다
 * — 브랜드색의 정체성이 남는다.
 * @param t 0~1. 클수록 어두워진다
 */
export function darken(hex: string, t: number): string {
  const c = hexToRgb(hex);
  const k = 1 - t;
  return rgbToHex(c.r * k, c.g * k, c.b * k);
}

/** 흰색과 섞는다(틴트·서피스 파생). @param t 0~1. 클수록 희어진다 */
export function mixWhite(hex: string, t: number): string {
  const c = hexToRgb(hex);
  return rgbToHex(c.r + (255 - c.r) * t, c.g + (255 - c.g) * t, c.b + (255 - c.b) * t);
}

/** hex + 알파 → rgba() 문자열. satori 는 8자리 hex 를 안전하게 다루지 못한다. */
export function fade(hex: string, a: number): string {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

/**
 * 채움용 클램프 — 흰 배경에서 최소 1.6:1.
 * 사용자가 `#fffdf0` 같은 색을 고르면 그래프 바·불릿 점이 흰 배경에서 아예 사라진다.
 */
export function clampFill(hex: string, min = 1.6): string {
  let cur = normalizeHex(hex) ?? '#8a7f76';
  let guard = 0;
  while (contrastRatio(cur, '#ffffff') < min && guard < 60) {
    cur = darken(cur, 0.02);
    guard += 1;
  }
  return cur;
}

/**
 * 텍스트용 파생색 — bg 위에서 target 이상이 될 때까지 2% 단위로 어둡게.
 * bg 를 흰색이 아니라 **그 색이 실제로 얹히는 배경(accentTint)** 으로 두는 게 핵심이다.
 * accentTint 는 흰색보다 어두우므로 여기서 4.5 를 넘기면 흰 배경 위는 자동으로 더 안전하다.
 */
export function deriveStrong(accent: string, bg: string, target = 4.5): string {
  let cur = accent;
  let guard = 0;
  while (contrastRatio(cur, bg) < target && guard < 60) {
    cur = darken(cur, 0.02);
    guard += 1;
  }
  return cur;
}

/** 채움 위 글자색 — 흰색과 잉크 중 대비가 높은 쪽. */
export function bestOn(bg: string): string {
  return contrastRatio(bg, '#ffffff') >= contrastRatio(bg, NEUTRAL_INK) ? '#ffffff' : NEUTRAL_INK;
}

/**
 * accent 톤 **밴드의 배경색**. accent 원색과 다를 수 있다.
 * 중간 밝기 accent 는 흰 글자도 잉크 글자도 4.5:1 을 못 넘긴다(실측: `#8a7f76` → 잉크 4.12).
 * 그런 색일 때만 대비가 더 유리한 방향으로 밀어 4.5 를 확보한다 — 채널 비율/흰색 혼합이라 hue 는 보존된다.
 * 바·점 같은 **채움**에는 원색 accent 를 그대로 쓴다(브랜드색이 눈에 남아야 한다).
 */
export function deriveBand(accent: string, target = 4.5): string {
  const cInk = contrastRatio(NEUTRAL_INK, accent);
  const cWhite = contrastRatio('#ffffff', accent);
  if (Math.max(cInk, cWhite) >= target) return accent;
  let cur = accent;
  let guard = 0;
  if (cInk >= cWhite) {
    while (contrastRatio(NEUTRAL_INK, cur) < target && guard < 60) {
      cur = mixWhite(cur, 0.04);
      guard += 1;
    }
  } else {
    while (contrastRatio('#ffffff', cur) < target && guard < 60) {
      cur = darken(cur, 0.04);
      guard += 1;
    }
  }
  return cur;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. 프리셋 — 오버라이드용. 기본값은 "업로드 제품컷에서 추출"이다.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface PaletteDef {
  id: string;
  labelKo: string;
  accent: string;
  /** AI 프롬프트에 hex 와 **함께** 들어간다 — hex 만 주면 이미지 모델이 거의 따르지 못한다 */
  nameEn: string;
}

/**
 * 팔레트 10종. 전부 파생 후 AA 통과가 실측 확인된 값이다(theme.test.ts 가 지킨다).
 * `#ff6f61`(YOAKE 일출 코랄)은 **넣지 않는다** — 고객이 우연히 우리 색을 고르는 것과
 * 우리가 강요하는 것은 다르다. 필요하면 `rose-coral` 이 그 자리를 대신한다.
 */
// 팔레트 카탈로그 — id·라벨·accent 를 나란히 놓고 색을 고른다
// prettier-ignore
export const PALETTES: readonly PaletteDef[] = [
  { id: 'neutral-greige', labelKo: '뉴트럴 그레이지', accent: '#8a7f76', nameEn: 'warm greige' },
  { id: 'clinical-blue', labelKo: '클리니컬 블루', accent: '#3d6fb5', nameEn: 'deep clinical blue' },
  { id: 'fresh-aqua', labelKo: '프레시 아쿠아', accent: '#1f9aa6', nameEn: 'fresh aqua teal' },
  { id: 'botanical-green', labelKo: '보태니컬 그린', accent: '#4f7a52', nameEn: 'botanical green' },
  { id: 'rose-coral', labelKo: '로즈 코랄', accent: '#e8556e', nameEn: 'soft rose coral' },
  { id: 'soft-pink', labelKo: '소프트 핑크', accent: '#d4788f', nameEn: 'muted rose pink' },
  { id: 'warm-beige', labelKo: '웜 베이지', accent: '#b08356', nameEn: 'warm sand beige' },
  { id: 'lavender', labelKo: '라벤더', accent: '#7d6bb0', nameEn: 'soft lavender' },
  { id: 'plum', labelKo: '플럼', accent: '#8e4f6e', nameEn: 'deep plum' },
  { id: 'luxe-charcoal', labelKo: '럭스 차콜', accent: '#3a3f4a', nameEn: 'charcoal slate' },
];

export interface MoodDef {
  id: string;
  labelKo: string;
  keywords: string;
}

/** 무드 8종. keywords 는 카테고리 keywords 를 **대체하지 않고 뒤에 잇는다**(장면 문법 보존). */
/**
 * ⚠ **무드 키워드에 "빛이 얼마나 평평한가"를 쓰지 않는다.**
 * 조명은 프롬프트의 다른 층(팩 `dramaProfiles` + `sceneConstraints` + 템플릿 `artDirection`)이
 * 이미 지시한다. 여기에 `soft even light` 같은 말을 남기면 같은 프롬프트 안에서
 * "평평하게" 와 "평평하지 않게" 가 동시에 지시돼 결과가 밋밋한 쪽으로 무너진다(2026-08-18 실측).
 * 이 층이 말하는 것은 **팔레트 · 소재 · 스타일링**이다.
 * 그림자의 성격(`deep controlled shadows`·`high-contrast`)은 연출 층과 방향이 같으므로 남긴다.
 */
// 무드 카탈로그 — 위와 같은 이유
// prettier-ignore
export const MOODS: readonly MoodDef[] = [
  { id: 'minimal-clean', labelKo: '미니멀 클린', keywords: 'minimal clean styling, generous negative space, matte neutral props, restrained palette' },
  { id: 'clinical', labelKo: '클리니컬', keywords: 'clinical precision, cool neutral palette, laboratory-clean glass and brushed steel, restrained styling' },
  { id: 'natural', labelKo: '내추럴 보태니컬', keywords: 'natural botanical styling, organic textures, warm earthy palette, leaf shadows' },
  { id: 'luxury', labelKo: '럭셔리', keywords: 'quiet luxury, deep controlled shadows, polished stone and glass, restrained editorial palette' },
  { id: 'fresh', labelKo: '프레시', keywords: 'fresh hydrating feel, dew and water droplets, crisp cool palette, translucent surfaces' },
  { id: 'pastel', labelKo: '파스텔 소프트', keywords: 'soft pastel palette, gentle gradients, airy weightless styling' },
  { id: 'bold-editorial', labelKo: '볼드 에디토리얼', keywords: 'bold editorial styling, high-contrast palette, graphic color blocking, confident composition' },
  { id: 'warm-daily', labelKo: '웜 데일리', keywords: 'warm everyday palette, lived-in cozy textures, wood and cotton' },
];

/** 추출 실패(coverage 부족) 시 카테고리별 폴백 팔레트. */
const CATEGORY_FALLBACK: Record<string, string> = {
  skincare: 'neutral-greige',
  suncare: 'fresh-aqua',
  makeup: 'rose-coral',
  cleansing: 'botanical-green',
  haircare: 'lavender',
  etc: 'neutral-greige',
};

/**
 * 카테고리 소재·팔레트 키워드. 상품에 맞는 문법이라 브랜드 무드가 지워선 안 된다
 * — 그래서 무드 키워드를 대체하지 않고 앞에 둔다.
 *
 * **여기가 정본이다.** 팩의 `moodProfiles` 는 2026-08-18 에 삭제했다 — 코드가 읽지 않는데
 * 남겨 두면 다음 사람이 거기를 고치고 아무 일도 일어나지 않는다(accent 를 뺀 것과 같은 이유).
 * 무엇을 연출할지는 팩 `shotGrammar` 가, 어떤 빛인지는 `dramaProfiles`·`artDirection` 이 소유한다.
 */
const CATEGORY_KEYWORDS: Record<string, string> = {
  skincare: 'calm clinical-clean palette, dewy texture, honed stone and glass surfaces',
  suncare: 'fresh blue-white palette, water droplets, summer air, sand and sea materials',
  makeup: 'saturated pigment, glossy swatch, playful color blocking, seamless coloured backdrops',
  cleansing: 'foam and water, gentle pastel palette, wet tile and cotton, hygienic',
  haircare: 'silky flow, warm neutral palette, glossy strands, warm wood and brass',
  etc: 'clean minimal styling, neutral palette, matte surfaces',
};

/** 팔레트 조회 — 미지 id 는 첫 팔레트(화이트리스트 역할을 겸한다). */
export function paletteById(id: string | undefined): PaletteDef {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** 무드 조회 — 미지 id 는 첫 무드. */
export function moodById(id: string | undefined): MoodDef {
  return MOODS.find((m) => m.id === id) ?? MOODS[0];
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. 색 추출 — 업로드한 **첫 장(제품 대표컷)** 에서만 뽑는다.
 *    2번째 장부터는 한국 상세페이지 원본이라 한국어 UI 색(빨강 세일 배너 등)이 섞여
 *    결과를 오염시킨다. 호출부에서 코드로 못박는다.
 * ──────────────────────────────────────────────────────────────────────────── */

export const EXTRACT = {
  /** 다운스케일 한 변 */
  size: 96,
  /** 이보다 채도가 낮으면 무채색(흰·회 스튜디오 배경) */
  minS: 0.18,
  /** 이보다 어두우면 그림자 */
  minV: 0.12,
  /** 밝고 채도 낮으면 하이라이트·화이트 배경 */
  hiV: 0.96,
  hiS: 0.3,
  /** hue 15° 단위 */
  buckets: 24,
  /** 유효 픽셀이 3% 미만이면 신뢰 불가 → 카테고리 폴백 */
  minCoverage: 0.03,
} as const;

export interface ExtractResult {
  accent: string;
  moodId: string;
  /** 유효 픽셀 비율. 화면이 "추출 신뢰도"로 그대로 쓴다 */
  coverage: number;
  /** 추출이 성공했는가. false 면 카테고리 폴백 팔레트다 — 그 사실을 화면에 밝힌다 */
  ok: boolean;
  hue: number;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

interface ImageStats {
  meanS: number;
  meanV: number;
  contrast: number;
}

function imageStats(meanS: number, meanV: number, vList: number[]): ImageStats {
  const s = [...vList].sort((a, b) => a - b);
  const p10 = s[Math.floor(s.length * 0.1)] ?? 0;
  const p90 = s[Math.floor(s.length * 0.9)] ?? 0;
  return { meanS, meanV, contrast: p90 - p10 };
}

/** 밝기·채도·대비·색상으로 무드를 추정한다. 제안일 뿐 사용자가 칩 하나로 바꾼다. */
export function suggestMood(st: ImageStats, hue: number): string {
  if (st.meanV > 0.82 && st.meanS < 0.25) return 'minimal-clean';
  if (st.meanV < 0.45) return 'luxury';
  if (st.contrast > 0.62 && st.meanS > 0.45) return 'bold-editorial';
  if (hue >= 150 && hue <= 210 && st.meanV > 0.7) return 'fresh';
  if (st.meanS < 0.35 && st.meanV > 0.7) return 'pastel';
  if (hue >= 60 && hue <= 150) return 'natural';
  return 'minimal-clean';
}

function extractFallback(category: string | undefined, coverage: number, stats?: ImageStats): ExtractResult {
  const p = paletteById(CATEGORY_FALLBACK[category ?? 'skincare'] ?? 'neutral-greige');
  const rgb = hexToRgb(p.accent);
  return {
    accent: p.accent,
    moodId: stats ? suggestMood(stats, rgbToHsv(rgb.r, rgb.g, rgb.b).h) : 'minimal-clean',
    coverage,
    ok: false,
    hue: 0,
  };
}

/**
 * 제품 대표컷에서 브랜드 accent 와 무드를 추정한다 — **순수 함수**.
 * 픽셀 소스는 호출부가 만든다: 서버는 `sharp(buf).resize(96,96,{fit:'fill'}).ensureAlpha().raw()`,
 * 브라우저는 `canvas.getContext('2d').getImageData()`. 그래서 이 모듈이 sharp 에 의존하지 않는다.
 *
 * @param rgba RGBA 4채널 바이트 배열(길이 = width × height × 4)
 * @param width  다운스케일된 폭
 * @param height 다운스케일된 높이
 * @param category 추출 실패 시 폴백에 쓸 상품 종류
 */
export function accentFromPixels(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  category?: ProductCategory,
): ExtractResult {
  const total = width * height;
  if (total <= 0 || rgba.length < total * 4) return extractFallback(category, 0);

  const bins = Array.from({ length: EXTRACT.buckets }, () => ({
    w: 0,
    hs: [] as number[],
    ss: [] as number[],
    vs: [] as number[],
  }));

  let kept = 0;
  let sumS = 0;
  let sumV = 0;
  const vList: number[] = [];

  for (let i = 0; i < total * 4; i += 4) {
    const hsv = rgbToHsv(rgba[i], rgba[i + 1], rgba[i + 2]);
    sumS += hsv.s;
    sumV += hsv.v;
    vList.push(hsv.v);
    // 배경·그림자·하이라이트를 걷어낸다
    if (hsv.s < EXTRACT.minS) continue;
    if (hsv.v < EXTRACT.minV) continue;
    if (hsv.v > EXTRACT.hiV && hsv.s < EXTRACT.hiS) continue;
    kept += 1;
    // 채도가 높고 중간 밝기인 픽셀이 브랜드색일 확률이 높다
    const w = hsv.s * (1 - Math.abs(hsv.v - 0.55) * 0.8);
    const b = Math.min(EXTRACT.buckets - 1, Math.floor(hsv.h / (360 / EXTRACT.buckets)));
    bins[b].w += w;
    bins[b].hs.push(hsv.h);
    bins[b].ss.push(hsv.s);
    bins[b].vs.push(hsv.v);
  }

  const coverage = kept / total;
  const stats = imageStats(sumS / total, sumV / total, vList);
  if (coverage < EXTRACT.minCoverage) return extractFallback(category, coverage, stats);

  // 최대 버킷 + 좌우 인접 버킷 합산 — hue 경계에 걸쳐 분산된 색을 되모은다
  let best = 0;
  for (let i = 1; i < bins.length; i++) if (bins[i].w > bins[best].w) best = i;
  const idx = [(best - 1 + bins.length) % bins.length, best, (best + 1) % bins.length];
  const hs: number[] = [];
  const ss: number[] = [];
  const vs: number[] = [];
  for (const j of idx) {
    hs.push(...bins[j].hs);
    ss.push(...bins[j].ss);
    vs.push(...bins[j].vs);
  }
  if (hs.length === 0) return extractFallback(category, coverage, stats);

  // hue 는 원형이라 최대 버킷 중심을 기준으로 ±180 로 펴서 중앙값을 낸다
  const center = (best + 0.5) * (360 / EXTRACT.buckets);
  const unwrapped = hs.map((h) => {
    let d = h - center;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  });
  const h = (center + median(unwrapped) + 360) % 360;
  const rgb = hsvToRgb(h, median(ss), median(vs));

  return {
    accent: clampFill(rgbToHex(rgb.r, rgb.g, rgb.b), 1.6),
    moodId: suggestMood(stats, h),
    coverage,
    ok: true,
    hue: h,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4. 테마 해석 — accent 1개 → 파생 토큰 5종. **순서가 중요하다.**
 * ──────────────────────────────────────────────────────────────────────────── */

/** 테마 출처. 우선순위: custom → palette → auto(제품컷 추출) → 카테고리 기본 */
export type ThemeSource = 'custom' | 'palette' | 'auto';

/** 폼·브랜드 설정이 넘기는 원본 선택값. 전부 optional 이고 sanitize 는 resolveTheme 이 한다. */
export interface ThemeInput {
  source?: ThemeSource;
  paletteId?: string;
  customAccent?: string;
  moodId?: string;
  /** auto 일 때 accentFromPixels 가 뽑은 값 */
  extracted?: string;
}

/**
 * 해석된 테마 — 프리셋 id 가 아니라 **실제 값**을 담는다.
 * 프리셋 테이블을 나중에 고쳐도 이미 생성된 자산의 블록 재생성이 흔들리지 않는다(스냅샷 원칙).
 */
export interface DetailTheme {
  accent: string;
  accentStrong: string;
  accentTint: string;
  accentBand: string;
  surface: string;
  onAccent: string;
  moodId: string;
  moodLabel: string;
  /** AI 배경컷 프롬프트용 — 카테고리 장면 키워드 + 무드 키워드 */
  moodKeywords: string;
  /** 프롬프트에 hex 와 함께 넣을 영문 색 이름 */
  accentNameEn: string;
  source: ThemeSource;
  paletteId: string;
  /** 대비 감사값 — 화면이 그대로 배지로 쓴다 */
  bodyContrast: number;
  fillContrast: number;
  onAccentContrast: number;
}

/**
 * 추출된 hex 에 가장 가까운 팔레트의 영문명을 빌려온다.
 * 이미지 모델은 hex 를 거의 따르지 못하므로 **반드시 영문 색 이름을 함께** 준다.
 */
function nearestColorName(hex: string): string {
  const target = rgbToHsv(hexToRgb(hex).r, hexToRgb(hex).g, hexToRgb(hex).b);
  let bestName = PALETTES[0].nameEn;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of PALETTES) {
    const c = hexToRgb(p.accent);
    const h = rgbToHsv(c.r, c.g, c.b);
    // hue 는 원형 거리, s·v 는 선형. hue 를 크게 가중해 "같은 색 계열"을 고른다
    const dh = Math.min(Math.abs(h.h - target.h), 360 - Math.abs(h.h - target.h)) / 180;
    const dist = dh * 2 + Math.abs(h.s - target.s) + Math.abs(h.v - target.v);
    if (dist < bestDist) {
      bestDist = dist;
      bestName = p.nameEn;
    }
  }
  return bestName;
}

/**
 * 테마 해석 — 우선순위 `custom → palette → auto → 카테고리 기본`.
 * 파생 순서를 바꾸지 말 것(§2-7): accent → accentTint → surface → accentStrong → accentBand → onAccent.
 * @param input 폼·브랜드 설정의 원본 선택값
 * @param category 폴백·장면 키워드에 쓸 상품 종류
 */
export function resolveTheme(input: ThemeInput | undefined, category?: ProductCategory): DetailTheme {
  const t = input ?? {};
  const cat = category ?? 'skincare';

  let raw: string | null = null;
  if (t.source === 'custom') raw = normalizeHex(t.customAccent);
  else if (t.source === 'palette')
    raw = paletteById(t.paletteId).accent; // 화이트리스트 통과분만
  else raw = normalizeHex(t.extracted);
  if (!raw) raw = paletteById(CATEGORY_FALLBACK[cat] ?? 'neutral-greige').accent;

  const accent = clampFill(raw, 1.6);
  const accentTint = mixWhite(accent, 0.94);
  // ⚠ AI 배경컷 프롬프트용 연한 색이다. 밴드 배경으로 쓰면 흰색과 3.5% 차이라 교대가 안 보인다(§2-6)
  const surface = mixWhite(accent, 0.965);
  const accentStrong = deriveStrong(accent, accentTint, 4.5);
  const accentBand = deriveBand(accent, 4.5);
  const onAccent = bestOn(accentBand);
  const mood = moodById(t.moodId);

  return {
    accent,
    accentStrong,
    accentTint,
    accentBand,
    surface,
    onAccent,
    moodId: mood.id,
    moodLabel: mood.labelKo,
    moodKeywords: `${CATEGORY_KEYWORDS[cat] ?? CATEGORY_KEYWORDS.etc}, ${mood.keywords}`,
    accentNameEn: t.source === 'palette' ? paletteById(t.paletteId).nameEn : nearestColorName(accent),
    source: t.source ?? 'auto',
    paletteId: t.source === 'palette' ? paletteById(t.paletteId).id : '',
    bodyContrast: contrastRatio(accentStrong, accentTint),
    fillContrast: contrastRatio(accent, '#ffffff'),
    onAccentContrast: contrastRatio(onAccent, accentBand),
  };
}

/**
 * 자산에 스냅샷된 테마를 읽는 **유일한 액세서**.
 * `DetailInput.theme` 는 optional 이다 — regenerateBlock 이 이 기능 이전 자산의
 * `detail_input` 을 그대로 읽으므로, required 로 두면 기존 자산의 블록 재생성이 죽는다.
 * @param stored 자산에 스냅샷된 값(있으면 그대로, 없으면 카테고리 기본으로 해석)
 * @param category 상품 종류
 */
export function detailThemeOf(stored: unknown, category?: ProductCategory): DetailTheme {
  const s = stored as Partial<DetailTheme> | undefined;
  // 해석된 값이 통째로 저장돼 있으면 그대로 쓴다(프리셋 테이블이 바뀌어도 재생성이 흔들리지 않는다)
  if (s && typeof s.accent === 'string' && typeof s.accentBand === 'string' && typeof s.onAccent === 'string') {
    return s as DetailTheme;
  }
  return resolveTheme(undefined, category);
}
