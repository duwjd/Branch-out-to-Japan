/**
 * 밴드 리듬 검증 — 정본: docs/specs/02-detail-converter-spec.md §2-6.
 *
 * 여기서 지키는 것은 "블록들 사이에 관계가 있는가"다.
 * 전 템플릿에서 톤이 실제로 교대하는지, 총 높이가 결합 단계에서 각주를 잘라먹지 않는지,
 * 그리고 같은 입력이 같은 배열을 내는지(재생성 일관성).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDetailPack, getTemplate, planBlocks, type DetailInput, type TemplateId } from './blockPack';
import { MAX_TOTAL_HEIGHT } from './output';
import { HEIGHT_GUARD_RATIO, TONE_RHYTHM, planLayout, toneSummary, totalHeight } from './rhythm';

const TEMPLATES: TemplateId[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

/** 근거가 모두 갖춰진 입력 — 블록이 최대로 살아남는 최악 케이스로 총높이 가드를 민다. */
function fullInput(over: Partial<DetailInput> = {}): DetailInput {
  return {
    productCategory: 'skincare',
    sourceImagePaths: ['orig-a.png'],
    disabledBlocks: [],
    spec: {
      volume: '30mL',
      category: '化粧品',
      manufacturer: '株式会社HARUON',
      origin: '韓国',
      fullIngredients: '水、BG',
    },
    ingredients: [{ name: 'ナイアシンアミド', percent: '2%', purpose: '整肌成分' }],
    freeOf: ['アルコール'],
    specs: [{ label: 'SPF', value: '50+' }],
    howToSteps: ['洗顔後、肌をととのえます。'],
    options: [],
    cautions: ['お肌に異常が生じていないかよく注意してご使用ください。'],
    proof: { rankTitle: '楽天ランキング1位', genre: '美容液', aggregationDate: '2026年4月15日' },
    sales: { count: '163,991個', period: '2022年5月〜2026年4月' },
    test: {
      name: '保湿試験',
      condition: '4週間連用',
      institution: '第三者評価機関',
      date: '2026年4月15日',
      sampleSize: '21名',
    },
    reviews: [{ text: 'べたつかず、朝のメイクのりが安定しました。', rating: '5', age: '30代' }],
    promo: null,
    modelConsent: false,
    ...over,
  };
}

function layoutFor(t: TemplateId, over: Partial<DetailInput> = {}) {
  const input = fullInput(over);
  return planLayout(planBlocks(input, 'rakuten-official', t).blocks);
}

test('전 템플릿 — 텍스트 블록 기준 paper 연속이 2를 넘지 않는다', () => {
  for (const t of TEMPLATES) {
    const textBands = layoutFor(t).filter((b) => b.surface === 'inset');
    let run = 0;
    for (const b of textBands) {
      run = b.tone === 'paper' ? run + 1 : 0;
      assert.ok(run <= 2, `${t}: paper 가 ${run}연속 — 리듬이 없다(${toneSummary(layoutFor(t))})`);
    }
  }
});

test('전 템플릿 — accent·ink 는 각 2회 이하이고 서로 인접하지 않는다', () => {
  for (const t of TEMPLATES) {
    const layout = layoutFor(t);
    assert.ok(layout.filter((b) => b.tone === 'accent').length <= TONE_RHYTHM.maxAccent, `${t}: accent 초과`);
    assert.ok(layout.filter((b) => b.tone === 'ink').length <= TONE_RHYTHM.maxInk, `${t}: ink 초과`);
    for (let i = 1; i < layout.length; i++) {
      const strong = (x: string) => x === 'accent' || x === 'ink';
      assert.ok(!(strong(layout[i].tone) && strong(layout[i - 1].tone)), `${t}: ${i}번에서 강한 톤이 인접`);
    }
  }
});

test('전 템플릿 — 강한 톤이 사진 밴드에 인접하지 않는다(사진을 죽이지 않게)', () => {
  for (const t of TEMPLATES) {
    const layout = layoutFor(t);
    layout.forEach((b, i) => {
      if (b.tone !== 'accent' && b.tone !== 'ink') return;
      const near = [layout[i - 1], layout[i + 1]].filter(Boolean).some((n) => n.surface === 'photo');
      assert.ok(!near, `${t}: ${b.blockId} 이 사진 옆에서 ${b.tone}`);
    });
  }
});

test('전 템플릿 — 톤이 실제로 두 종류 이상 나온다(교대 장치가 도는가)', () => {
  for (const t of TEMPLATES) {
    const kinds = new Set(layoutFor(t).map((b) => b.tone));
    assert.ok(kinds.size >= 2, `${t}: 톤이 ${[...kinds].join(',')} 뿐 — 슬라이드 나열`);
  }
});

test('총 높이 안전판 — 상한의 85% 이내로 접힌다(각주 블록이 잘려나가지 않게)', () => {
  for (const t of TEMPLATES) {
    const layout = layoutFor(t);
    assert.ok(
      totalHeight(layout) <= MAX_TOTAL_HEIGHT * HEIGHT_GUARD_RATIO,
      `${t}: ${totalHeight(layout)}px > ${MAX_TOTAL_HEIGHT * HEIGHT_GUARD_RATIO}px`,
    );
  }
});

test('높이 프리셋 — 사진 블록만 프리셋을 갖고 텍스트 블록은 없다', () => {
  for (const b of layoutFor('D1')) {
    if (b.surface === 'photo') assert.ok(b.heightPreset, `${b.blockId}: 사진인데 프리셋 없음`);
    else assert.equal(b.heightPreset, null, `${b.blockId}: 텍스트인데 프리셋 있음`);
  }
});

test('결정성 — 같은 입력이면 같은 배열(블록 재생성이 흔들리지 않는다)', () => {
  for (const t of TEMPLATES) assert.deepEqual(layoutFor(t), layoutFor(t));
});

test('챕터 인덱스 — 오프너에만 붙고 1부터 총개수까지 이어진다', () => {
  const layout = layoutFor('D1');
  const chapters = layout.filter((b) => b.chapter);
  assert.ok(chapters.length >= 2, '챕터 오프너가 너무 적다');
  chapters.forEach((b, i) => {
    assert.equal(b.chapter?.index, i + 1);
    assert.equal(b.chapter?.total, chapters.length);
    assert.equal(b.density, 'spacious', '절 시작은 여유 간격을 받는다');
  });
});

test('이음새 노치 — 사진 밴드에는 붙지 않는다(사진을 해치지 않게)', () => {
  for (const t of TEMPLATES) {
    for (const b of layoutFor(t)) {
      if (b.seam === 'notch') assert.equal(b.surface, 'inset', `${t}/${b.blockId}: 사진 밴드에 노치`);
    }
  }
});

test('팩 v1.2.0 — 27블록 전부가 리듬 입력 4필드를 갖는다', () => {
  // 하나라도 비면 그 블록만 조용히 기본 톤으로 떨어져 리듬에서 빠진다
  for (const b of getDetailPack().blockCatalog) {
    assert.ok(b.tonePreference, `${b.id}: tonePreference 없음`);
    assert.ok(b.glyph, `${b.id}: glyph 없음`);
    assert.equal(typeof b.chapterOpener, 'boolean', `${b.id}: chapterOpener 없음`);
    if (b.renderKind !== 'text') assert.ok(b.heightPreset, `${b.id}: 사진 블록인데 heightPreset 없음`);
  }
});

test('팩 v1.2.0 — 템플릿 6종이 서로 다른 아트디렉션을 갖는다(D1≠D6 의 근거)', () => {
  const seen = new Set<string>();
  for (const t of TEMPLATES) {
    const def = getTemplate(t);
    assert.ok(def.artDirection.length > 40, `${t}: artDirection 빈약`);
    assert.ok(['low', 'medium', 'high'].includes(def.dramaLevel), `${t}: dramaLevel 이상`);
    assert.ok(['compact', 'normal', 'display'].includes(def.typeScale), `${t}: typeScale 이상`);
    assert.ok(!seen.has(def.artDirection), `${t}: 아트디렉션이 다른 템플릿과 같다`);
    seen.add(def.artDirection);
  }
});

test('색조 8색(D4) — 스와치 블록이 붙어도 총 높이 가드를 넘지 않는다', () => {
  const options = Array.from({ length: 8 }, (_, i) => ({
    axis: 'color' as const,
    name: `シェード${i + 1}`,
    swatchHex: '#c86a72',
  }));
  const layout = layoutFor('D4', { productCategory: 'makeup', options });
  assert.ok(totalHeight(layout) <= MAX_TOTAL_HEIGHT * HEIGHT_GUARD_RATIO, `D4 8색: ${totalHeight(layout)}px`);
  // 스와치는 사용자 입력 색이라 어두운 밴드 위에서 사라진다 — paper 고정이어야 한다
  for (const b of layout) {
    if (b.blockId === 'color-chip-grid' || b.blockId === 'color-chart-matrix') {
      assert.equal(b.tone, 'paper', `${b.blockId}: 스와치가 ${b.tone} 밴드 위`);
    }
  }
});
