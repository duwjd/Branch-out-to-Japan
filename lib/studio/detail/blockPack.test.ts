/**
 * planBlocks 게이트 단위 테스트 — "근거가 없으면 그 블록이 없는 것이 정상"을 코드가 강제하는지.
 * 썸네일 promptPack.test.ts 와 같은 성격: 법적 게이트가 프롬프트가 아니라 코드에 있어야 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBlockPrompt,
  getBlock,
  getDetailPack,
  planBlocks,
  templateUiMetas,
  usesProductSource,
  type DetailInput,
} from './blockPack';
import { MAX_AI_BLOCKS } from './output';

/** 모든 근거가 갖춰진 입력 — 여기서 하나씩 빼며 게이트를 확인한다. */
function fullInput(over: Partial<DetailInput> = {}): DetailInput {
  return {
    productCategory: 'skincare',
    sourceImagePaths: [],
    disabledBlocks: [],
    spec: { volume: '30mL', category: '化粧品', manufacturer: '株式会社KGLOW', origin: '韓国', fullIngredients: '水、BG、グリセリン' },
    ingredients: [{ name: 'グリシルグリシン', percent: '6%', purpose: '整肌成分' }],
    freeOf: ['合成香料', '鉱物油'],
    specs: [{ label: 'SPF', value: '50+' }],
    howToSteps: ['洗顔後、適量を顔全体になじませます。'],
    options: [],
    cautions: ['お肌に異常が生じないかよく注意してご使用ください。'],
    proof: { rankTitle: '楽天ランキング1位', genre: '美容液', aggregationDate: '2026/7/14更新' },
    sales: { count: '163,991個', period: '2022.5/19-2026.4/29' },
    test: { name: '効能評価試験済み', condition: '連用試験', institution: '第三者機関', date: '2026.04.15', sampleSize: '21名' },
    reviews: [{ text: '使い心地がよかったです。', rating: '5', age: '30代' }],
    promo: {
      setTitle: '2個セット', salePrice: '1,920', normalPrice: '2,610',
      normalPriceVerified: true, discountRate: '26', gift: '', qualifierChips: [], footnote: '',
    },
    modelConsent: false,
    ...over,
  };
}

const idsOf = (r: ReturnType<typeof planBlocks>) => r.blocks.map((b) => b.blockId);
const excludedIds = (r: ReturnType<typeof planBlocks>) => r.excluded.map((e) => e.blockId);

test('planBlocks — 근거가 다 있으면 필수 블록이 전부 들어간다', () => {
  const r = planBlocks(fullInput(), 'rakuten-official');
  const ids = idsOf(r);
  for (const must of ['hero-product', 'point-list', 'product-spec-table', 'footnote-block']) {
    assert.ok(ids.includes(must as never), `필수 블록 누락: ${must}`);
  }
  assert.equal(r.templateId, 'D1', 'skincare 기본 템플릿');
});

test('planBlocks — 각주 블록은 항상 마지막', () => {
  for (const cat of ['skincare', 'suncare', 'makeup', 'cleansing'] as const) {
    const r = planBlocks(fullInput({ productCategory: cat }), 'rakuten-official');
    assert.equal(idsOf(r).at(-1), 'footnote-block', `${cat}: 각주가 마지막이 아님`);
  }
});

test('planBlocks — 성분 데이터 없으면 성분·기전 블록 제외(성분명 창작 금지)', () => {
  // D1(문제해결 서사형)에는 기전 도해가 들어 있다
  const d1 = planBlocks(fullInput({ ingredients: [] }), 'rakuten-official', 'D1');
  assert.ok(!idsOf(d1).includes('mechanism-explainer'));
  assert.match(d1.excluded.find((e) => e.blockId === 'mechanism-explainer')?.reason ?? '', /지어내지 않습니다/);

  // 성분 카드는 D2(성분 근거형)의 서명 블록 — 거기서 게이트를 확인한다
  const d2 = planBlocks(fullInput({ ingredients: [] }), 'rakuten-official', 'D2');
  assert.ok(!idsOf(d2).includes('ingredient-card'));
  assert.match(d2.excluded.find((e) => e.blockId === 'ingredient-card')?.reason ?? '', /지어내지 않습니다/);
  assert.equal(d2.excluded.find((e) => e.blockId === 'ingredient-card')?.fixHint, '성분 데이터');

  // 성분이 있으면 같은 템플릿에서 살아난다 — 게이트가 성분 유무 때문임을 대조로 확인
  assert.ok(idsOf(planBlocks(fullInput(), 'rakuten-official', 'D2')).includes('ingredient-card'));
});

test('planBlocks — 프로모 입력 없으면 가격 블록 제외(가격 창작 금지)', () => {
  const r = planBlocks(fullInput({ promo: null }), 'rakuten-official');
  assert.ok(!idsOf(r).includes('mall-promo-banner'));
  assert.ok(!idsOf(r).includes('set-offer-table'));
  assert.match(r.excluded.find((e) => e.blockId === 'set-offer-table')?.reason ?? '', /지어내지 않습니다/);
});

test('planBlocks — 실적 3필드 중 하나만 비어도 배지 블록 제외', () => {
  const partial = { rankTitle: '楽天ランキング1位', genre: '美容液', aggregationDate: '  ' };
  const r = planBlocks(fullInput({ proof: partial }), 'rakuten-official');
  assert.ok(!idsOf(r).includes('ranking-stack'));
  assert.match(r.excluded.find((e) => e.blockId === 'ranking-stack')?.reason ?? '', /집계일/);
});

test('planBlocks — 시험 근거 미완비면 시험 라벨·정량 그래프 제외', () => {
  const r = planBlocks(fullInput({ test: null }), 'rakuten-official');
  assert.ok(!idsOf(r).includes('test-evidence-label'));
  assert.ok(!idsOf(r).includes('quant-data-graph'));
});

test('planBlocks — 리뷰 원문 없으면 리뷰 블록 제외(후기 생성 금지)', () => {
  const r = planBlocks(fullInput({ reviews: [], productCategory: 'skincare' }), 'rakuten-official', 'D6');
  assert.ok(!idsOf(r).includes('customer-review'));
  assert.match(r.excluded.find((e) => e.blockId === 'customer-review')?.reason ?? '', /생성하지 않습니다/);
});

test('planBlocks — 아마존JP는 프로모 레이어를 통째로 차단(A+ 규정)', () => {
  const r = planBlocks(fullInput(), 'amazon-jp');
  assert.ok(!idsOf(r).includes('mall-promo-banner'));
  assert.ok(!idsOf(r).includes('set-offer-table'));
  assert.match(r.excluded.find((e) => e.blockId === 'mall-promo-banner')?.reason ?? '', /A\+/);
  // 라쿠텐이면 같은 입력으로 들어간다 — 차단이 플랫폼 때문임을 대조로 확인
  assert.ok(idsOf(planBlocks(fullInput(), 'rakuten-official')).includes('mall-promo-banner'));
});

test('planBlocks — 옵션 개수에 따라 색상 블록이 단계적으로 붙는다', () => {
  const color = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ axis: 'color' as const, name: `カラー${i + 1}`, swatchHex: '#ff6464' }));

  const none = planBlocks(fullInput({ productCategory: 'makeup', options: [] }), 'qoo10');
  assert.ok(!idsOf(none).includes('color-chip-grid'));

  const one = planBlocks(fullInput({ productCategory: 'makeup', options: color(1) }), 'qoo10');
  assert.ok(!idsOf(one).includes('color-chip-grid'), '1개면 옵션 블록 없음');

  const two = planBlocks(fullInput({ productCategory: 'makeup', options: color(2) }), 'qoo10');
  assert.ok(idsOf(two).includes('color-chip-grid'));
  assert.ok(!idsOf(two).includes('color-chart-matrix'), '2개면 차트는 아직');

  const six = planBlocks(fullInput({ productCategory: 'makeup', options: color(6) }), 'qoo10');
  assert.ok(idsOf(six).includes('color-chart-matrix'), '6개부터 차트');

  const twelve = planBlocks(fullInput({ productCategory: 'makeup', options: color(12) }), 'qoo10');
  assert.ok(idsOf(twelve).includes('color-chip-grid'));
  assert.ok(idsOf(twelve).includes('color-chart-matrix'));
});

test('planBlocks — 비색상 옵션 2개 이상이면 라인업 비교가 붙는다', () => {
  const r = planBlocks(
    fullInput({ options: [{ axis: 'size', name: '175mL' }, { axis: 'size', name: '450mL' }] }),
    'rakuten-official',
  );
  assert.ok(idsOf(r).includes('lineup-compare-chart'));
});

test('planBlocks — 모델컷 동의 없으면 퍼스널컬러 블록만 빠지고 생성은 계속된다', () => {
  const opts = Array.from({ length: 4 }, (_, i) => ({ axis: 'color' as const, name: `C${i}` }));
  const r = planBlocks(fullInput({ productCategory: 'makeup', options: opts, modelConsent: false }), 'qoo10');
  assert.ok(!idsOf(r).includes('personal-color-look'));
  assert.ok(idsOf(r).includes('color-chip-grid'), '다른 옵션 블록은 살아 있어야 한다');
  assert.match(r.excluded.find((e) => e.blockId === 'personal-color-look')?.reason ?? '', /동의/);
});

test('planBlocks — AI 블록은 상한을 넘지 않는다', () => {
  const opts = Array.from({ length: 8 }, (_, i) => ({ axis: 'color' as const, name: `C${i}` }));
  const r = planBlocks(fullInput({ productCategory: 'makeup', options: opts, modelConsent: true }), 'qoo10');
  const aiBlocks = r.blocks.filter((b) => b.renderKind !== 'text');
  assert.ok(aiBlocks.length <= MAX_AI_BLOCKS, `AI 블록 ${aiBlocks.length}개 > 상한 ${MAX_AI_BLOCKS}`);
  assert.equal(r.aiBlockCount, aiBlocks.length);
});

test('planBlocks — 법적 블록은 어떤 경우에도 text 렌더(AI 미개입)', () => {
  const r = planBlocks(fullInput(), 'rakuten-official');
  const legal = ['product-spec-table', 'footnote-block', 'test-evidence-label', 'set-offer-table'];
  for (const b of r.blocks) {
    if (legal.includes(b.blockId)) assert.equal(b.renderKind, 'text', `${b.blockId} 가 AI 렌더로 새어나감`);
  }
});

test('planBlocks — 결정성: 같은 입력이면 같은 시퀀스', () => {
  const a = planBlocks(fullInput(), 'rakuten-official');
  const b = planBlocks(fullInput(), 'rakuten-official');
  assert.deepEqual(idsOf(a), idsOf(b));
  assert.deepEqual(excludedIds(a), excludedIds(b));
});

test('planBlocks — 제외 사유에는 중복이 없고 전부 한국어 설명이 붙는다', () => {
  const r = planBlocks(fullInput({ ingredients: [], promo: null, test: null, reviews: [] }), 'amazon-jp');
  assert.equal(new Set(excludedIds(r)).size, r.excluded.length, '같은 블록이 두 번 제외됨');
  for (const e of r.excluded) assert.ok(e.reason.length > 5, `${e.blockId}: 사유 없음`);
});

test('buildBlockPrompt — 글자 금지가 negative 제약에 포함된다', () => {
  const p = buildBlockPrompt('hero-product', { backgroundVisual: 'soft studio backdrop' }, 'skincare', true);
  assert.match(p, /No text, letters, kana, kanji, hangul/);
  assert.match(p, /Strict requirements:/);
  // KR 상세 입력이면 cleanup 프리펜드
  assert.match(p, /Korean product detail page/);
  assert.match(p, /soft studio backdrop/);
});

test('buildBlockPrompt — 사용자 요청은 제약보다 앞에 온다(우선순위 보존)', () => {
  const p = buildBlockPrompt('hero-product', { backgroundVisual: 'x' }, 'skincare', false, 'もっと明るく');
  assert.ok(p.indexOf('Additional art direction') < p.indexOf('Strict requirements:'));
});

test('buildBlockPrompt — 텍스트 전용 블록은 AI 프롬프트가 없다', () => {
  assert.throws(() => buildBlockPrompt('product-spec-table', {}, 'skincare', false), /no AI prompt/);
});

test('팩 무결성 — 템플릿·레이어의 블록 참조가 전부 존재하고 rubric이 붙어 있다', () => {
  for (const t of templateUiMetas()) {
    assert.ok(t.sequencePreview.length > 0, `${t.id} 시퀀스 비어 있음`);
  }
  // 법적 게이트가 걸린 블록은 반드시 requires 를 갖는다
  for (const id of ['ranking-stack', 'test-evidence-label', 'customer-review', 'set-offer-table'] as const) {
    assert.ok(getBlock(id).requires.length > 0, `${id} 에 게이트가 없음`);
  }
});

test('제품 노출 정책 — AI 블록은 전부 source·none 중 하나를 갖는다(중간 없음)', () => {
  // 정책이 비면 그 블록은 원본 없이 제품을 그리게 되고, 히어로와 다른 용기가 나온다
  const aiBlocks = getDetailPack().blockCatalog.filter((b) => b.renderKind !== 'text');
  assert.ok(aiBlocks.length > 0, 'AI 블록이 하나도 없음');
  for (const b of aiBlocks) {
    assert.ok(
      b.productPresence === 'source' || b.productPresence === 'none',
      `${b.id}: productPresence 미지정`,
    );
  }
});

test('제품 노출 정책 — 히어로·텍스처는 원본을 쓰고, 도해·문제제기는 용기를 그리지 않는다', () => {
  assert.equal(usesProductSource('hero-product'), true);
  assert.equal(usesProductSource('texture-shot'), true);
  assert.equal(usesProductSource('before-after-diagram'), false);
  assert.equal(usesProductSource('problem-hook'), false);
});

test('buildBlockPrompt — 원본을 안 받는 블록에는 용기 금지 문구가 붙는다', () => {
  const banned = buildBlockPrompt(
    'before-after-diagram',
    { diagramDescription: 'moisture retention cross-section' },
    'skincare',
    false,
  );
  assert.match(banned, /Do not depict any cosmetic container/);

  // 원본을 받는 블록에는 붙으면 안 된다 — 붙으면 실제 제품까지 지워진다
  const withSource = buildBlockPrompt('hero-product', { backgroundVisual: 'x' }, 'skincare', false);
  assert.doesNotMatch(withSource, /Do not depict any cosmetic container/);
});

test('슬롯 설명 — 번호 배지는 코드 소유임을 팩이 명시한다', () => {
  for (const [id, slot] of [
    ['cause-structure', 'causeItemsJa'],
    ['point-list', 'pointsJa'],
    ['how-to-use', 'stepsJa'],
  ] as const) {
    assert.match(
      getBlock(id).slots[slot].description,
      /코드가 배지로 자동으로 붙이므로/,
      `${id}.${slot}: 번호 라벨 금지 안내가 없음`,
    );
  }
});
