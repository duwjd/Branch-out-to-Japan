/**
 * 제품 식별 검색 검증(BRAND-03b 3b-5).
 *
 * 이 콜의 존재 이유는 등록을 빠르게 하는 것이지만, **설계 목표는 추측을 후보로 세우지 않는 것이다.**
 * 출처 없이 이름만 있는 후보는 검색이 아니라 추측이고, 그걸 카드로 세우면 사용자가 확인할 방법이 없다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_CATEGORIES, runProductIdentify } from './identifyCall';

const IMAGE = { mediaType: 'image/jpeg' as const, dataBase64: 'x' };

test('후보에는 출처가 반드시 있다', async () => {
  const r = await runProductIdentify({ image: IMAGE, timeoutMs: 60_000 });
  assert.ok(r.candidates.length > 0, '목 후보가 비었다 — 동선을 볼 수 없다');
  for (const c of r.candidates) {
    assert.ok(c.sourceUrl.startsWith('http'), `${c.nameKr}: 출처 없는 후보가 살아남았다`);
    assert.ok(c.nameKr, '이름 없는 후보가 살아남았다');
  }
});

test('카테고리는 셀렉트에 있는 라벨만 남는다', async () => {
  // 모르는 라벨이 들어가면 셀렉트가 빈 칸으로 보인다 — 채웠는데 안 채워진 것처럼 읽힌다
  const r = await runProductIdentify({ image: IMAGE, timeoutMs: 60_000 });
  for (const c of r.candidates) {
    if (c.category) assert.ok(PRODUCT_CATEGORIES.includes(c.category), `모르는 카테고리: ${c.category}`);
  }
});

test('후보는 최대 3개', async () => {
  const r = await runProductIdentify({ image: IMAGE, timeoutMs: 60_000 });
  assert.ok(r.candidates.length <= 3);
});

test('카테고리 목록은 제품 등록 셀렉트와 같다', () => {
  // 두 목록이 갈리면 후보의 카테고리가 조용히 버려진다
  assert.deepEqual(PRODUCT_CATEGORIES, ['스킨케어', '메이크업', '선케어', '클렌징', '기타']);
});
