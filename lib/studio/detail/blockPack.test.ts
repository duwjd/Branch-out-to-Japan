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
  type TemplateId,
} from './blockPack';
import { MAX_AI_BLOCKS } from './output';
import { resolveTheme } from './theme';

/**
 * `buildBlockPrompt` 문맥 — 종전 위치 인자 `(category, isFromKoreanDetail, userNote)` 를 대체한다.
 * 시그니처가 객체로 바뀐 이유는 **templateId 가 아예 없었기 때문**이다: D1 과 D6 이 같은
 * 카테고리면 이미지 지시가 바이트 단위로 동일해 템플릿이 결과물에 드러나지 않았다.
 */
function promptCtx(isFromKoreanDetail: boolean, userNote?: string, templateId: TemplateId = 'D1') {
  const t = resolveTheme({ source: 'palette', paletteId: 'clinical-blue' }, 'skincare');
  return {
    templateId,
    category: 'skincare' as const,
    theme: { surface: t.surface, accent: t.accent, accentNameEn: t.accentNameEn, moodKeywords: t.moodKeywords },
    isFromKoreanDetail,
    userNote,
  };
}

/** 모든 근거가 갖춰진 입력 — 여기서 하나씩 빼며 게이트를 확인한다. */
function fullInput(over: Partial<DetailInput> = {}): DetailInput {
  return {
    productCategory: 'skincare',
    sourceImagePaths: [],
    disabledBlocks: [],
    spec: {
      volume: '30mL',
      category: '化粧品',
      manufacturer: '株式会社YOAKE',
      origin: '韓国',
      fullIngredients: '水、BG、グリセリン',
    },
    ingredients: [{ name: 'グリシルグリシン', percent: '6%', purpose: '整肌成分' }],
    freeOf: ['合成香料', '鉱物油'],
    specs: [{ label: 'SPF', value: '50+' }],
    howToSteps: ['洗顔後、適量を顔全体になじませます。'],
    options: [],
    cautions: ['お肌に異常が生じないかよく注意してご使用ください。'],
    proof: { rankTitle: '楽天ランキング1位', genre: '美容液', aggregationDate: '2026/7/14更新' },
    sales: { count: '163,991個', period: '2022.5/19-2026.4/29' },
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
      gift: '',
      qualifierChips: [],
      footnote: '',
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
    fullInput({
      options: [
        { axis: 'size', name: '175mL' },
        { axis: 'size', name: '450mL' },
      ],
    }),
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
  const p = buildBlockPrompt('hero-product', { backgroundVisual: 'soft studio backdrop' }, promptCtx(true));
  assert.match(p, /No text, letters, kana, kanji, hangul/);
  assert.match(p, /Strict requirements:/);
  // KR 상세 입력이면 cleanup 프리펜드
  assert.match(p, /Korean product detail page/);
  assert.match(p, /soft studio backdrop/);
});

test('buildBlockPrompt — 사용자 요청은 제약보다 앞에 온다(우선순위 보존)', () => {
  const p = buildBlockPrompt('hero-product', { backgroundVisual: 'x' }, promptCtx(false, 'もっと明るく'));
  assert.ok(p.indexOf('Additional art direction') < p.indexOf('Strict requirements:'));
});

test('buildBlockPrompt — 텍스트 전용 블록은 AI 프롬프트가 없다', () => {
  assert.throws(() => buildBlockPrompt('product-spec-table', {}, promptCtx(false)), /no AI prompt/);
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
    assert.ok(b.productPresence === 'source' || b.productPresence === 'none', `${b.id}: productPresence 미지정`);
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
    promptCtx(false),
  );
  assert.match(banned, /Do not depict any cosmetic container/);

  // 원본을 받는 블록에는 붙으면 안 된다 — 붙으면 실제 제품까지 지워진다
  const withSource = buildBlockPrompt('hero-product', { backgroundVisual: 'x' }, promptCtx(false));
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

// ── 카테고리 샷 플랜 (팩 v1.3.0) ──────────────────────────────────────
// 여기서 지키는 것: **어떤 템플릿을 고르든 그 카테고리의 필수 컷이 사진으로 나온다.**
// 종전에는 사진 블록이 100% template.blockSequence 였고 카테고리는 기본 템플릿 추천에만 쓰여서,
// 사용컷은 D3에만 있고 제형컷은 D2·D4에 아예 없었다.

const ALL_TEMPLATES: TemplateId[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const ALL_CATEGORIES: DetailInput['productCategory'][] = [
  'skincare',
  'suncare',
  'makeup',
  'cleansing',
  'haircare',
  'etc',
];

/** 그 샷타입을 만드는 블록이 **배경컷을 받은 채로**(text 강등이 아니라) 들어갔는가. */
function hasImageForShot(r: ReturnType<typeof planBlocks>, shot: string): boolean {
  return r.blocks.some((b) => getBlock(b.blockId).shotType === shot && b.renderKind !== 'text');
}

test('카테고리 필수 샷 — 6카테고리 × 6템플릿 36조합 전부에서 이미지를 받는다', () => {
  const pack = getDetailPack();
  for (const category of ALL_CATEGORIES) {
    const must = pack.categoryShotPlan[category].must;
    for (const templateId of ALL_TEMPLATES) {
      // 색조 필수 컷(swatch)은 색상 옵션 게이트를 그대로 탄다 — 옵션을 채워 조건을 만족시킨다
      const r = planBlocks(
        fullInput({
          productCategory: category,
          options: [
            { axis: 'color', name: '01 ローズ', sku: 'A', swatchHex: '#d4837f' },
            { axis: 'color', name: '02 コーラル', sku: 'B', swatchHex: '#e08a6e' },
          ],
          modelConsent: true,
        }),
        'rakuten-official',
        templateId,
      );
      for (const shot of must) {
        assert.ok(
          hasImageForShot(r, shot),
          `${category}/${templateId}: 필수 컷 ${shot} 이 사진으로 들어가지 않았다 — ${idsOf(r).join(',')}`,
        );
      }
    }
  }
});

test('카테고리 필수 샷 — 옵션·근거가 하나도 없는 최소 입력에서도 확보된다', () => {
  const pack = getDetailPack();
  for (const category of ALL_CATEGORIES) {
    // swatch 는 색상 옵션 2개가 있어야 성립하는 컷이라, 없으면 prefer 로 떨어지는 게 정상이다
    const must = pack.categoryShotPlan[category].must.filter((s) => s !== 'swatch');
    const r = planBlocks(
      fullInput({ productCategory: category, options: [], modelConsent: false }),
      'rakuten-official',
      'D2', // 사진 블록이 히어로 하나뿐이던 최악의 템플릿
    );
    for (const shot of must) {
      assert.ok(hasImageForShot(r, shot), `${category}/D2: ${shot} 누락 — ${idsOf(r).join(',')}`);
    }
  }
});

test('D2(성분근거형) — 히어로 한 장짜리 페이지가 더는 나오지 않는다', () => {
  const r = planBlocks(fullInput({ productCategory: 'skincare' }), 'rakuten-official', 'D2');
  assert.ok(r.aiBlockCount >= 3, `이미지 ${r.aiBlockCount}장 — 예산이 놀고 있다`);
  assert.ok(idsOf(r).includes('texture-shot'), '제형컷이 없다');
});

test('보강 컷은 마무리 구간(사용법·스펙표·각주) 앞에 들어간다', () => {
  const ids = idsOf(planBlocks(fullInput({ productCategory: 'suncare' }), 'rakuten-official', 'D2'));
  const usage = ids.indexOf('usage-scene');
  assert.ok(usage >= 0, '사용컷이 보강되지 않았다');
  for (const closing of ['how-to-use', 'product-spec-table', 'footnote-block'] as const) {
    const at = ids.indexOf(closing);
    if (at >= 0) assert.ok(usage < at, `${closing}(${at}) 보다 뒤(${usage})에 앉았다 — 서사가 끊긴다`);
  }
});

test('AI 예산 — 상한을 넘지 않고, 히어로와 필수 샷은 절대 강등되지 않는다', () => {
  for (const category of ALL_CATEGORIES) {
    for (const templateId of ALL_TEMPLATES) {
      const r = planBlocks(
        fullInput({
          productCategory: category,
          options: [
            { axis: 'color', name: '01', sku: 'A', swatchHex: '#d4837f' },
            { axis: 'color', name: '02', sku: 'B', swatchHex: '#e08a6e' },
            { axis: 'size', name: 'L', sku: 'C' },
            { axis: 'size', name: 'S', sku: 'D' },
          ],
          modelConsent: true,
        }),
        'rakuten-official',
        templateId,
      );
      assert.ok(r.aiBlockCount <= MAX_AI_BLOCKS, `${category}/${templateId}: ${r.aiBlockCount}장`);
      const hero = r.blocks.find((b) => b.blockId === 'hero-product');
      assert.equal(hero?.renderKind, 'hybrid', `${category}/${templateId}: 히어로가 강등됐다`);
    }
  }
});

test('AI 예산 — 결정성: 같은 입력이면 같은 시퀀스와 같은 렌더킨드', () => {
  const mk = () => planBlocks(fullInput({ productCategory: 'suncare' }), 'qoo10', 'D3');
  const a = mk();
  const b = mk();
  assert.deepEqual(idsOf(a), idsOf(b));
  assert.deepEqual(
    a.blocks.map((x) => x.renderKind),
    b.blocks.map((x) => x.renderKind),
  );
});

// ── 연출 문법 · 드라마 친화도 ─────────────────────────────────────────

test('shotGrammar — 같은 컷이라도 카테고리마다 연출이 갈린다', () => {
  const skin = buildBlockPrompt(
    'texture-shot',
    { textureDescription: 'x' },
    { ...promptCtx(false), category: 'skincare' },
  );
  const sun = buildBlockPrompt(
    'texture-shot',
    { textureDescription: 'x' },
    { ...promptCtx(false), category: 'suncare' },
  );
  assert.notEqual(skin, sun, '카테고리가 달라도 제형컷 지시가 같다');
  assert.match(sun, /white cast|sunlight/i, '선케어 제형컷에 백탁·직사광 문법이 없다');
});

test('shotGrammar — 치환 자리가 비어 남지 않는다', () => {
  const pack = getDetailPack();
  for (const def of pack.blockCatalog) {
    if (!def.promptTemplate) continue;
    for (const category of ALL_CATEGORIES) {
      const p = buildBlockPrompt(def.id, {}, { ...promptCtx(false), category });
      assert.ok(!p.includes('{{'), `${def.id}/${category}: 미치환 자리 남음`);
      assert.ok(!/grammar[^.]*:\s*\./i.test(p), `${def.id}/${category}: 빈 문법 문장`);
    }
  }
});

test('dramaAffinity — 평면 벡터 도해에는 조명·연출 지시가 붙지 않는다', () => {
  // before-after-diagram 은 자기 프롬프트가 "clean flat vector-style infographic" 인데
  // 여태 모든 AI 블록에 "Never flat, evenly-lit" 가 덧씌워지고 있었다(정면 모순).
  const p = buildBlockPrompt('before-after-diagram', { diagramDescription: 'x' }, promptCtx(false));
  assert.ok(!p.includes('Never flat'), '도해에 조명 지시가 붙었다');
  assert.ok(!p.includes('Stage a real moment'), '도해에 연출 지시가 붙었다');
  assert.ok(p.includes('flat vector-style infographic, not a photograph'), '그래픽 제약이 안 붙었다');
});

test('dramaAffinity — 사진 블록에는 연출 강도와 조명 지시가 붙는다', () => {
  const p = buildBlockPrompt('texture-shot', { textureDescription: 'x' }, promptCtx(false));
  assert.ok(p.includes('Never flat, evenly-lit'), '사진 블록에 조명 지시가 없다');
  assert.ok(p.includes('Stage a real moment'), '사진 블록에 연출 지시가 없다');
  assert.ok(!p.includes('flat vector-style infographic'), '사진에 그래픽 제약이 붙었다');
});

test('팩 무결성 — 샷 정체성·연출 문법·샷 플랜이 서로 어긋나지 않는다', () => {
  const pack = getDetailPack();
  const shots = new Set(pack.blockCatalog.filter((b) => b.shotType).map((b) => b.shotType!));

  for (const b of pack.blockCatalog) {
    // AI 블록은 전부 샷 정체성을 가져야 한다 — 없으면 연출 문법이 조용히 빈 문자열이 된다
    if (b.promptTemplate) {
      assert.ok(b.shotType, `${b.id}: shotType 없음`);
      assert.ok(b.dramaAffinity, `${b.id}: dramaAffinity 없음`);
    } else {
      assert.equal(b.shotType, undefined, `${b.id}: 텍스트 블록에 shotType`);
    }
    // 같은 샷타입을 두 블록이 가지면 blockForShot 이 어느 쪽을 고를지 불확정해진다
    if (b.shotType) {
      const dup = pack.blockCatalog.filter((x) => x.shotType === b.shotType);
      assert.equal(dup.length, 1, `shotType ${b.shotType} 중복: ${dup.map((x) => x.id).join(',')}`);
    }
  }

  for (const category of ALL_CATEGORIES) {
    const grammar = pack.shotGrammar[category];
    assert.ok(grammar, `shotGrammar 에 ${category} 없음`);
    for (const shot of shots) {
      assert.ok(grammar[shot]?.trim(), `shotGrammar[${category}][${shot}] 비어 있음`);
    }
    const plan = pack.categoryShotPlan[category];
    assert.ok(plan, `categoryShotPlan 에 ${category} 없음`);
    for (const shot of [...plan.must, ...plan.prefer]) {
      assert.ok(shots.has(shot), `categoryShotPlan[${category}] 의 ${shot} 를 만드는 블록이 없다`);
    }
  }
});
