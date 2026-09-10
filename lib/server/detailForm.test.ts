/**
 * 프리필 계약 — `toFormFields`(펴기)와 `parseDetailForm`(접기)이 서로의 역방향인지.
 *
 * 이 둘이 어긋나면 프리필이 **조용히 빈 칸을 채운다.** 필드 이름을 한쪽에서만 바꿔도
 * 타입 검사에 걸리지 않으므로(둘 다 문자열 키다) 여기서 왕복으로 잡는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseDetailForm, toFormFields } from './detailForm';
import type { DetailInput } from '../db/store';

function sample(over: Partial<DetailInput> = {}): DetailInput {
  return {
    productCategory: 'suncare',
    sourceImagePaths: [],
    disabledBlocks: [],
    spec: {
      volume: '50mL',
      category: '化粧品',
      manufacturer: '株式会社YOAKE',
      origin: '韓国',
      fullIngredients: '水、BG、グリセリン',
    },
    ingredients: [{ name: 'グリシルグリシン', percent: '6%', purpose: '整肌成分' }],
    freeOf: ['合成香料', '鉱物油'],
    specs: [{ label: 'SPF', value: '50+' }],
    howToSteps: ['洗顔後、適量をなじませます。'],
    options: [{ axis: 'color', name: 'ベージュ', swatchHex: '#E5C9A8', sku: 'BG-01' }],
    cautions: ['異常が生じないかよく注意してご使用ください。'],
    proof: { rankTitle: '楽天ランキング1位', genre: '美容液', aggregationDate: '2026/7/14更新' },
    sales: { count: '163,991個', period: '2022.5/19-2026.4/29', reviewCount: '2,104', rating: '4.7' },
    test: {
      name: '効能評価試験済み',
      condition: '連用試験',
      institution: '第三者機関',
      date: '2026.04.15',
      sampleSize: '21名',
    },
    reviews: [{ text: '使い心地がよかったです。', rating: '5', age: '30代' }],
    promo: {
      setTitle: '2個セット',
      salePrice: '1,920',
      normalPrice: '2,610',
      normalPriceVerified: true,
      discountRate: '26',
      gift: 'ミニサイズ',
      qualifierChips: ['数量限定', '送料無料'],
      footnote: '※在庫がなくなり次第終了',
    },
    modelConsent: false,
    ...over,
  };
}

/** 펼친 필드에 폼 필수값을 얹어 FormData 로 만든다 */
function formOf(input: DetailInput): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(toFormFields(input))) fd.set(k, v);
  fd.set('productId', 'p-1');
  fd.set('templateId', 'D1');
  fd.set('platform', 'rakuten-official');
  return fd;
}

test('왕복 — 펴서 다시 접으면 같은 입력이다', () => {
  const original = sample();
  const parsed = parseDetailForm(formOf(original), []);
  assert.ok(!('error' in parsed), 'error' in parsed ? parsed.error : '');

  const got = parsed.detailInput;
  assert.deepEqual(got.spec, original.spec, '표시 의무 항목이 왕복에서 어긋나면 안 된다');
  assert.deepEqual(got.ingredients, original.ingredients);
  assert.deepEqual(got.freeOf, original.freeOf);
  assert.deepEqual(got.specs, original.specs);
  assert.deepEqual(got.howToSteps, original.howToSteps);
  assert.deepEqual(got.options, original.options);
  assert.deepEqual(got.cautions, original.cautions);
  assert.deepEqual(got.reviews, original.reviews);
  assert.deepEqual(got.proof, original.proof);
  assert.deepEqual(got.sales, original.sales);
  assert.deepEqual(got.test, original.test);
  assert.equal(got.productCategory, original.productCategory);
});

test('통상가 실적 확인은 되살리지 않는다 — 有利誤認 방지 장치는 매번 사람이 켠다', () => {
  const parsed = parseDetailForm(formOf(sample()), []);
  assert.ok(!('error' in parsed));
  assert.equal(parsed.detailInput.promo?.normalPriceVerified, false, '지난 생성의 체크를 물려주면 장치가 무력해진다');
  // 나머지 프로모 값은 그대로 온다
  assert.equal(parsed.detailInput.promo?.setTitle, '2個セット');
  assert.equal(parsed.detailInput.promo?.salePrice, '1,920');
});

test('제품을 고르지 않으면 파싱 자체가 막힌다', () => {
  const fd = formOf(sample());
  fd.delete('productId');
  const parsed = parseDetailForm(fd, []);
  assert.ok('error' in parsed && parsed.error.includes('제품'));
});

test('빈 값은 내려보내지 않는다 — 프리필이 사용자가 적은 칸을 지우지 않게', () => {
  const fields = toFormFields(
    sample({ freeOf: [], howToSteps: [], proof: null, sales: null, test: null, promo: null }),
  );
  assert.equal(fields.freeOf, undefined);
  assert.equal(fields.howToSteps, undefined);
  assert.equal(fields.proofRankTitle, undefined);
  assert.equal(fields.salesCount, undefined);
  assert.equal(fields.testName, undefined);
  assert.equal(fields.promoSetTitle, undefined);
});

/**
 * 규정 가드(§2-14) — 자동으로 채웠고 아직 확인하지 않은 全成分·성분표를 **서버가 빈 값으로 접는다.**
 *
 * 화면 잠금에 기대지 않는 것이 이 판정의 존재 이유다. 구 클라이언트나 우회 제출이 두 목록을
 * 보내지 않아도, 보내더라도 확인 표시가 없으면 서버가 같은 결론을 낸다.
 */
function guardForm(over: Record<string, string>): FormData {
  const fd = formOf(sample());
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
}

test('규정 가드 — 자동으로 채운 전성분은 확인 전까지 빈 값으로 접힌다', () => {
  const parsed = parseDetailForm(
    guardForm({ autoFilledFields: 'specFullIngredients,ingredientRows', reviewedFields: '' }),
    [],
  );
  assert.ok(!('error' in parsed), 'error' in parsed ? parsed.error : '');
  if ('error' in parsed) return;
  assert.equal(parsed.detailInput.spec.fullIngredients, '');
  assert.deepEqual(parsed.detailInput.ingredients, []);
  // 접은 칸의 이름이 남아야 checkRequirement 가 사유를 확인용으로 바꿀 수 있다
  assert.deepEqual(parsed.detailInput.pendingReview, ['specFullIngredients', 'ingredientRows']);
});

test('규정 가드 — 확인한 칸은 접지 않는다', () => {
  const parsed = parseDetailForm(
    guardForm({ autoFilledFields: 'specFullIngredients', reviewedFields: 'specFullIngredients' }),
    [],
  );
  if ('error' in parsed) throw new Error(parsed.error);
  assert.equal(parsed.detailInput.spec.fullIngredients, '水、BG、グリセリン');
  assert.deepEqual(parsed.detailInput.pendingReview, []);
});

test('규정 가드 — 사용자가 직접 적은 값은 접지 않는다', () => {
  // autoFilledFields 에 없으면 자동 채움이 아니다. 손으로 적은 값을 확인 대기로 묶으면
  // 지금까지 잘 쓰던 사용자의 블록이 갑자기 사라진다
  const parsed = parseDetailForm(guardForm({}), []);
  if ('error' in parsed) throw new Error(parsed.error);
  assert.equal(parsed.detailInput.spec.fullIngredients, '水、BG、グリセリン');
  assert.deepEqual(parsed.detailInput.pendingReview, []);
});

test('규정 가드 — 표시 의무 3칸은 접지 않는다(서버 400 이 먼저 걸린다)', () => {
  // 内容量·区分·販売元 을 접으면 파서가 400 을 내고 생성 경로가 통째로 막힌다.
  // 규정 민감 목록에 이 셋이 들어가면 안 되는 이유가 이것이다
  const parsed = parseDetailForm(guardForm({ autoFilledFields: 'specVolume,specManufacturer' }), []);
  if ('error' in parsed) throw new Error(parsed.error);
  assert.equal(parsed.detailInput.spec.volume, '50mL');
  assert.deepEqual(parsed.detailInput.pendingReview, []);
});
