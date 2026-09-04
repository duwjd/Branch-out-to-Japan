/**
 * 배경컷 여백 실측 검증 — 정본: docs/specs/02-detail-converter-spec.md §4b.
 *
 * 판정식을 합성 이미지로 못박는다. 여기서 지키는 것은 하나다:
 * **텍스트가 제품이 있는 쪽으로 가지 않는가.** 상단/하단 어디로도 고정하지 않았다는 것이
 * 곧 "제품이 하단인 컷에서도 안 가린다"는 뜻이므로, 제품 위치를 바꿔가며 반대편을 고르는지 본다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { INSET_PLACEMENT, analyzeSafeArea } from './safeArea';

const W = 512;
const H = 768;

/**
 * 구조물 한 칸의 크기(px).
 *
 * ⚠ 1px 줄무늬로 만들면 안 된다 — analyzeSafeArea 는 64×96 으로 줄여서 재므로 8배 축소에서
 *   고주파가 평균으로 지워져 **완전히 평평한 회색**이 된다(실제로 그렇게 나왔다).
 *   이건 버그가 아니라 의도한 성질이다: 재려는 것은 천 결·필름 노이즈가 아니라
 *   제품·소품 같은 **구도 규모의 구조물**이다. 그래서 픽스처도 그 규모로 만든다.
 */
const CELL = 32;

/**
 * 합성 배경컷 — `busy` 사각형만 구도 규모의 체커로 채우고 나머지는 단색으로 둔다.
 * 체커가 곧 "제품·소품이 있는 구역"이다(엣지 밀도가 높다).
 * @param busy 제품이 있다고 볼 영역(px)
 * @param base 여백의 밝기 0~255
 */
async function synth(busy: { left: number; top: number; width: number; height: number }, base = 235): Promise<Buffer> {
  const px = Buffer.alloc(W * H * 3, base);
  for (let y = busy.top; y < busy.top + busy.height; y++) {
    for (let x = busy.left; x < busy.left + busy.width; x++) {
      const v = (Math.floor(x / CELL) + Math.floor(y / CELL)) % 2 === 0 ? 12 : 246;
      const i = (y * W + x) * 3;
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
    }
  }
  return sharp(px, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
}

test('제품이 상단이면 카피는 하단으로 간다', async () => {
  const p = await analyzeSafeArea(await synth({ left: 0, top: 0, width: W, height: Math.round(H * 0.6) }));
  assert.ok(p.zone.top >= 0.5, `상단(${p.zone.top})으로 갔다 — ${p.reason}`);
  assert.equal(p.vAlign, 'bottom');
  assert.equal(p.scrim.direction, 'to top');
});

test('제품이 하단이면 카피는 상단으로 간다 — 하단 고정이 아니라는 증거', async () => {
  const p = await analyzeSafeArea(
    await synth({ left: 0, top: Math.round(H * 0.4), width: W, height: Math.round(H * 0.6) }),
  );
  assert.equal(p.zone.top, 0, `하단(${p.zone.top})에 그대로 앉았다 — ${p.reason}`);
  assert.equal(p.vAlign, 'top');
  assert.equal(p.scrim.direction, 'to bottom');
});

// 좌우 케이스에서 후보 id 를 못박지 않는 이유: `우측 절반`과 `우하단`은 둘 다 정답이고,
// 더 비어 있는 쪽이 이기는 게 맞다. 검증해야 할 것은 **제품과 겹치지 않는가** 하나다.
test('제품이 좌측이면 카피는 제품과 겹치지 않는 우측으로 간다', async () => {
  const p = await analyzeSafeArea(await synth({ left: 0, top: 0, width: Math.round(W * 0.5), height: H }));
  assert.ok(p.zone.left >= 0.5, `좌측(${p.zone.left})으로 갔다 — ${p.reason}`);
  assert.equal(p.hAlign, 'right');
});

test('제품이 우측이면 카피는 제품과 겹치지 않는 좌측으로 간다', async () => {
  const p = await analyzeSafeArea(
    await synth({ left: Math.round(W * 0.5), top: 0, width: Math.round(W * 0.5), height: H }),
  );
  assert.ok(p.zone.left + p.zone.width <= 0.5 + 1e-9, `우측(${p.zone.left})으로 갔다 — ${p.reason}`);
  assert.equal(p.hAlign, 'left');
});

test('밝은 여백은 잉크 글자, 어두운 여백은 흰 글자', async () => {
  const bright = await analyzeSafeArea(await synth({ left: 0, top: 0, width: W, height: Math.round(H * 0.6) }, 240));
  assert.equal(bright.textTone, 'dark');
  const dark = await analyzeSafeArea(await synth({ left: 0, top: 0, width: W, height: Math.round(H * 0.6) }, 24));
  assert.equal(dark.textTone, 'light');
});

test('화면이 전부 빽빽하면 신뢰도 0 + 강스크림 — 조용히 가리지 않고 사유를 남긴다', async () => {
  const p = await analyzeSafeArea(await synth({ left: 0, top: 0, width: W, height: H }, 128));
  assert.equal(p.confidence, 0);
  assert.ok(p.reason.includes('빽빽'), p.reason);
  assert.ok(p.scrim.alpha >= 0.9, '여백이 없는데 스크림이 약하다');
});

test('스크림 알파는 대비를 확보하는 최소값이다', async () => {
  // 회색 128 은 잉크(4.30:1)로도 흰 글자(3.95:1)로도 AA 에 못 미친다 → 스크림이 필요하다
  const mid = await analyzeSafeArea(await synth({ left: 0, top: 0, width: W, height: Math.round(H * 0.6) }, 128));
  assert.ok(mid.scrim.alpha > 0, '중간 밝기인데 스크림 0');
  assert.ok(mid.scrim.alpha <= 0.92, '상한 초과');
  // 아주 밝은 여백 + 잉크 글자 → 스크림 없이도 읽힌다
  const clean = await analyzeSafeArea(await synth({ left: 0, top: 0, width: W, height: Math.round(H * 0.6) }, 252));
  assert.equal(clean.scrim.alpha, 0, '멀쩡한 여백에 불필요한 베일을 씌운다');
});

test('결정성 — 같은 버퍼면 같은 배치(블록 재생성이 흔들리지 않는다)', async () => {
  const buf = await synth({ left: 0, top: 0, width: W, height: Math.round(H * 0.6) });
  assert.deepEqual(await analyzeSafeArea(buf), await analyzeSafeArea(buf));
});

test('디코딩 실패는 배치 실패로 번지지 않는다', async () => {
  const p = await analyzeSafeArea(Buffer.from('not an image'));
  assert.equal(p.confidence, 0);
  assert.equal(p.vAlign, 'bottom');
});

test('구역은 항상 캔버스 안이고 최소 면적을 갖는다', async () => {
  for (const busy of [
    { left: 0, top: 0, width: W, height: 200 },
    { left: 200, top: 300, width: 200, height: 200 },
    { left: 0, top: H - 200, width: W, height: 200 },
  ]) {
    const { zone } = await analyzeSafeArea(await synth(busy));
    assert.ok(zone.top >= 0 && zone.left >= 0);
    assert.ok(zone.top + zone.height <= 1 + 1e-9);
    assert.ok(zone.left + zone.width <= 1 + 1e-9);
    assert.ok(zone.width * zone.height >= 0.24, `구역이 너무 좁다: ${zone.width * zone.height}`);
  }
});

test('INSET_PLACEMENT — 배경 없는 블록은 스크림 0(흰 배경에 흰 글자 방지의 마지막 방벽)', () => {
  assert.equal(INSET_PLACEMENT.scrim.alpha, 0);
  assert.equal(INSET_PLACEMENT.textTone, 'dark');
});
