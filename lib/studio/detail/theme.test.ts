/**
 * 테마 해석 검증 — 정본: docs/specs/02-detail-converter-spec.md §2-7.
 *
 * 여기서 지키는 것은 두 가지다.
 *  1. **대비**: 파생 토큰이 실제로 AA(4.5:1)를 넘는가. 넘지 못하면 산출물의 글자가 안 읽힌다.
 *  2. **브랜드 분리**: YOAKE 코랄이 고객 상세페이지로 새어 나가지 않는가(관통 원칙 4).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOODS,
  PALETTES,
  accentFromPixels,
  clampFill,
  contrastRatio,
  darken,
  deriveBand,
  detailThemeOf,
  normalizeHex,
  resolveTheme,
  rgbToHsv,
  hexToRgb,
} from './theme';
import { surfaceFor } from './rhythm';

test('normalizeHex — #rgb·#rrggbb 만 통과시킨다(문자열 주입 차단)', () => {
  assert.equal(normalizeHex('#ABC'), '#aabbcc');
  assert.equal(normalizeHex('  #FF6F61 '), '#ff6f61');
  // 여기서 막지 않으면 사용자 문자열이 그대로 satori 스타일과 AI 프롬프트에 들어간다
  for (const bad of ['red', '#12345', '#ff6f6180', 'var(--x)', 'url(a)', '', null, 42]) {
    assert.equal(normalizeHex(bad), null, `${String(bad)} 가 통과됨`);
  }
});

test('darken — hue·채도를 보존한다(HSL 명도 조작과의 차이)', () => {
  const src = '#3d6fb5';
  const out = darken(src, 0.2);
  const a = rgbToHsv(hexToRgb(src).r, hexToRgb(src).g, hexToRgb(src).b);
  const b = rgbToHsv(hexToRgb(out).r, hexToRgb(out).g, hexToRgb(out).b);
  assert.ok(Math.abs(a.h - b.h) < 1.5, `hue 가 흔들림: ${a.h} → ${b.h}`);
  assert.ok(Math.abs(a.s - b.s) < 0.02, `채도가 흔들림: ${a.s} → ${b.s}`);
  assert.ok(b.v < a.v, '어두워지지 않음');
});

test('clampFill — 흰 배경에서 최소 1.6:1(연한 색이 그래프 바에서 사라지지 않게)', () => {
  for (const raw of ['#fffdf0', '#ffffff', '#fefefe', '#f3f8ff']) {
    assert.ok(contrastRatio(clampFill(raw), '#ffffff') >= 1.6 - 1e-6, `${raw} 클램프 실패`);
  }
});

test('팔레트 10종 — 파생 후 전부 AA 통과(§2-7 실측 표)', () => {
  for (const p of PALETTES) {
    const t = resolveTheme({ source: 'palette', paletteId: p.id }, 'skincare');
    // accentStrong 의 기준 배경은 흰색이 아니라 **그 색이 실제로 얹히는 accentTint** 다
    assert.ok(t.bodyContrast >= 4.5, `${p.id}: accentStrong on accentTint = ${t.bodyContrast.toFixed(2)}`);
    assert.ok(t.onAccentContrast >= 4.5, `${p.id}: onAccent on accentBand = ${t.onAccentContrast.toFixed(2)}`);
    assert.ok(t.fillContrast >= 1.6, `${p.id}: fill on white = ${t.fillContrast.toFixed(2)}`);
  }
});

test('deriveBand — 중간 밝기 accent 만 민다(#8a7f76 → 4.5 확보, 나머지는 원색 유지)', () => {
  // 흰 글자도 잉크 글자도 4.5 를 못 넘기는 색. 실측 잉크 대비 4.12
  const greige = '#8a7f76';
  const band = deriveBand(greige, 4.5);
  assert.notEqual(band, greige, '보정이 일어나지 않음');
  assert.ok(Math.max(contrastRatio('#202124', band), contrastRatio('#ffffff', band)) >= 4.5);
  // 이미 통과하는 색은 손대지 않는다 — 브랜드색이 흔들리면 안 된다
  assert.equal(deriveBand('#3a3f4a', 4.5), '#3a3f4a');
});

test('밴드 톤 4종 — accent·ink 밴드에서 본문이 AA 를 넘는다', () => {
  const t = resolveTheme({ source: 'palette', paletteId: 'rose-coral' }, 'makeup');
  for (const tone of ['paper', 'tint', 'accent', 'ink'] as const) {
    const sf = surfaceFor(tone, t);
    assert.ok(contrastRatio(sf.ink, sf.bg) >= 4.5, `${tone}: ink ${contrastRatio(sf.ink, sf.bg).toFixed(2)}`);
    assert.ok(
      contrastRatio(sf.softInk, sf.softFill) >= 4.5,
      `${tone}: softInk ${contrastRatio(sf.softInk, sf.softFill).toFixed(2)}`,
    );
  }
});

test('tint 밴드 배경은 surface(0.965)가 아니라 0.90 혼합이다', () => {
  const t = resolveTheme({ source: 'palette', paletteId: 'clinical-blue' }, 'skincare');
  const tint = surfaceFor('tint', t);
  // surface 를 그대로 쓰면 흰색과 3.5% 차이라 교대가 눈에 보이지 않는다 — 리듬이 없는 것처럼 보이던 원인
  assert.notEqual(tint.bg, t.surface);
  assert.ok(contrastRatio(tint.bg, '#ffffff') > contrastRatio(t.surface, '#ffffff'));
});

test('YOAKE 코랄은 팔레트에 없다 — 우리 색을 고객에게 강요하지 않는다', () => {
  for (const p of PALETTES) {
    assert.notEqual(p.accent.toLowerCase(), '#ff6f61', '일출 코랄이 팔레트에 들어감');
    assert.notEqual(p.accent.toLowerCase(), '#ff6464', '구 코랄이 팔레트에 들어감');
  }
});

test('resolveTheme — 우선순위 custom → palette → auto → 카테고리 기본', () => {
  assert.equal(resolveTheme({ source: 'custom', customAccent: '#3d6fb5' }, 'skincare').accent, '#3d6fb5');
  assert.equal(resolveTheme({ source: 'palette', paletteId: 'plum' }, 'skincare').accent, '#8e4f6e');
  assert.equal(resolveTheme({ source: 'auto', extracted: '#4f7a52' }, 'skincare').accent, '#4f7a52');
  // 잘못된 커스텀 값은 조용히 통과시키지 않고 카테고리 기본으로 접는다
  assert.equal(resolveTheme({ source: 'custom', customAccent: 'javascript:x' }, 'suncare').accent, '#1f9aa6');
  // 미지 팔레트 id 는 화이트리스트에서 걸러진다
  assert.equal(resolveTheme({ source: 'palette', paletteId: '../../etc' }, 'skincare').accent, PALETTES[0].accent);
});

test('resolveTheme — moodKeywords 는 카테고리 장면 문법 + 무드다(대체 아님)', () => {
  const t = resolveTheme({ source: 'palette', paletteId: 'fresh-aqua', moodId: 'luxury' }, 'suncare');
  assert.match(t.moodKeywords, /water droplets/, '카테고리 장면 문법이 지워짐');
  assert.match(t.moodKeywords, /quiet luxury/, '무드 키워드가 빠짐');
});

test('resolveTheme — 프롬프트용 영문 색 이름이 붙는다(hex 만으로는 모델이 못 따른다)', () => {
  assert.equal(resolveTheme({ source: 'palette', paletteId: 'plum' }, 'skincare').accentNameEn, 'deep plum');
  // 추출값은 가장 가까운 팔레트의 영문명을 빌린다
  assert.ok(resolveTheme({ source: 'auto', extracted: '#3d6fb5' }, 'skincare').accentNameEn.length > 0);
});

// ── 추출 ────────────────────────────────────────────────────────────────────

/** width×height 단색 RGBA 버퍼. */
function solid(hex: string, w = 8, h = 8): Uint8Array {
  const c = hexToRgb(hex);
  const buf = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = c.r;
    buf[i * 4 + 1] = c.g;
    buf[i * 4 + 2] = c.b;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

test('accentFromPixels — 채도 있는 면에서 그 색 계열을 뽑는다', () => {
  const r = accentFromPixels(solid('#3d6fb5'), 8, 8, 'skincare');
  assert.equal(r.ok, true);
  const h = rgbToHsv(hexToRgb(r.accent).r, hexToRgb(r.accent).g, hexToRgb(r.accent).b).h;
  assert.ok(Math.abs(h - 214) < 20, `hue 가 벗어남: ${h}`);
});

test('accentFromPixels — 흰 스튜디오 배경은 신뢰 불가로 보고 카테고리 폴백', () => {
  const r = accentFromPixels(solid('#fbfbfb'), 8, 8, 'suncare');
  assert.equal(r.ok, false);
  assert.ok(r.coverage < 0.03);
  assert.equal(r.accent, '#1f9aa6', 'suncare 폴백 팔레트가 아님');
});

test('accentFromPixels — 같은 픽셀이면 같은 결과(결정적)', () => {
  const px = solid('#b08356');
  assert.deepEqual(accentFromPixels(px, 8, 8, 'skincare'), accentFromPixels(px, 8, 8, 'skincare'));
});

test('detailThemeOf — 구 자산(theme 없음)도 죽지 않고 카테고리 기본으로 해석된다', () => {
  // regenerateBlock 이 이 기능 이전 자산의 detail_input 을 그대로 읽는다
  const t = detailThemeOf(undefined, 'cleansing');
  assert.equal(t.accent, '#4f7a52');
  // 스냅샷된 해석값은 그대로 돌려준다 — 프리셋 테이블이 바뀌어도 재생성 색이 흔들리지 않는다
  const snap = resolveTheme({ source: 'palette', paletteId: 'lavender' }, 'skincare');
  assert.equal(detailThemeOf(snap, 'makeup').accent, snap.accent);
});

test('무드 8종이 전부 keywords 를 갖는다', () => {
  assert.equal(MOODS.length, 8);
  for (const m of MOODS) assert.ok(m.keywords.length > 20, `${m.id}: keywords 빈약`);
});

test('무드·카테고리 키워드는 조명을 지시하지 않는다 — 연출 층과 모순되지 않게', () => {
  // 2026-08-18 실측: minimal-clean 의 `soft even light` 가 팩 dramaProfiles 의
  // "Avoid flat, evenly-lit catalogue lighting" 과 같은 프롬프트 안에서 충돌해
  // 결과가 밋밋한 쪽으로 무너졌다. 조명은 한 층(dramaProfiles·sceneConstraints·artDirection)만 소유한다.
  const FLATTENING =
    /\b(even light|soft (?:even |day|morning )?light|diffused light|studio light|neutral light|bright light|soft shadow)\b/i;
  for (const m of MOODS) {
    assert.ok(!FLATTENING.test(m.keywords), `무드 ${m.id} 에 조명 지시가 남음: ${m.keywords}`);
  }
  for (const category of ['skincare', 'suncare', 'makeup', 'cleansing', 'haircare', 'etc'] as const) {
    const kw = resolveTheme(undefined, category).moodKeywords;
    assert.ok(!FLATTENING.test(kw), `카테고리 ${category} 에 조명 지시가 남음: ${kw}`);
  }
});
