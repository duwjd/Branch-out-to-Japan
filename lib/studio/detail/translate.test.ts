/**
 * 입력 변환(KR→JA)의 결정적 절반 단위 테스트.
 * 여기가 무너지면 (a) 한국어가 남아 블록이 사라지거나 (b) 가격·수량이 조용히 바뀐다 —
 * 둘 다 사용자가 결과물을 보고서야 알게 되는 실패라 반드시 사전에 잡아야 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGlossary,
  applyTranslations,
  collectForbidden,
  collectTranslatable,
  digitSignature,
  getAt,
  hasHangul,
  normalizeKubun,
  numbersPreserved,
  preTranslate,
  sourceSnapshot,
  verifyClientTranslation,
  verifyTranslation,
  type TranslatableField,
  type TranslatedField,
} from './translate';
import type { BrandKit, DetailInput } from '../../db/store';

function baseInput(over: Partial<DetailInput> = {}): DetailInput {
  return {
    productCategory: 'skincare',
    sourceImagePaths: [],
    disabledBlocks: [],
    spec: { volume: '30mL', category: '化粧品', manufacturer: '株式会社HARUON', origin: '韓国', fullIngredients: '水、BG' },
    ingredients: [],
    freeOf: [],
    specs: [],
    howToSteps: [],
    options: [],
    cautions: [],
    proof: null,
    sales: null,
    test: null,
    reviews: [],
    promo: null,
    modelConsent: false,
    ...over,
  };
}

// ── 한글 판정 ────────────────────────────────────────────────────────────────

test('hasHangul — 완성형뿐 아니라 자모 단독도 잡는다', () => {
  assert.equal(hasHangul('세라마이드'), true);
  assert.equal(hasHangul('ㄱㄴㄷ'), true, '자모는 JP 폰트 cmap에 있어 uncoveredGlyphs를 통과한다 — 여기서 잡아야 한다');
  assert.equal(hasHangul('ナイアシンアミド'), false);
  assert.equal(hasHangul('SPF50+ PA++++'), false);
  assert.equal(hasHangul('株式会社／2,610円'), false);
  assert.equal(hasHangul(''), false);
});

// ── 숫자 보존 ────────────────────────────────────────────────────────────────

test('digitSignature — 표기 형식 변화는 무시하고 수치만 본다', () => {
  // 날짜 재구성(가장 흔한 정상 변환)
  assert.equal(digitSignature('2026.04.15'), digitSignature('2026年4月15日'));
  assert.equal(digitSignature('2022.5/19-2026.4/29'), digitSignature('2022年5月19日〜2026年4月29日'));
  // 천단위 쉼표는 넣든 빼든 같은 값
  assert.equal(digitSignature('163,991'), digitSignature('163991'));
  // 전각 숫자
  assert.equal(digitSignature('２１名'), digitSignature('21名'));
});

test('numbersPreserved — 값이 실제로 바뀌면 즉시 갈린다', () => {
  assert.equal(numbersPreserved('누적 163,991개', '累計163,991個'), true);
  assert.equal(numbersPreserved('21명', '21名'), true);
  assert.equal(numbersPreserved('SPF 50+', 'SPF50+'), true);
  assert.equal(numbersPreserved('4주간 연용시험', '4週間連用試験'), true);
  assert.equal(numbersPreserved('—', '—'), true, '숫자가 없는 값끼리도 통과해야 한다');

  assert.equal(numbersPreserved('누적 163,991개', '累計163,000個'), false);
  assert.equal(numbersPreserved('21명', '20名'), false);
  assert.equal(numbersPreserved('통상가 2,610엔', '通常価格 2,610円 → 1,920円'), false, '없던 숫자가 생기면 실패');
});

// ── 区分 ─────────────────────────────────────────────────────────────────────

test('normalizeKubun — 문자열 비교로 히어로 라벨이 켜지므로 결정적으로 접는다', () => {
  assert.equal(normalizeKubun('의약외품'), '医薬部外品');
  assert.equal(normalizeKubun('의약부외품'), '医薬部外品');
  assert.equal(normalizeKubun('화장품'), '化粧品');
  assert.equal(normalizeKubun('화 장 품'), '化粧品', '공백은 무시한다');
  // 일본 医薬部外品은 일본 승인 사항이라 한국 기능성 인정으로 추정하지 않는다
  assert.equal(normalizeKubun('기능성화장품'), '化粧品');
  assert.equal(normalizeKubun('알수없는구분'), null, '모르면 콜⑧으로 넘긴다');
});

// ── 용어집 ───────────────────────────────────────────────────────────────────

test('applyGlossary — 긴 표기를 먼저 바꾼다', () => {
  const pairs = [
    { kr: '세라마이드', ja: 'セラミド' },
    { kr: '세라마이드 크림', ja: 'セラミドクリーム' },
  ];
  // 짧은 것을 먼저 바꾸면 「セラミド 크림」이 되어 등록한 제품명 표기가 깨진다
  assert.equal(applyGlossary('세라마이드 크림', pairs), 'セラミドクリーム');
  assert.equal(applyGlossary('세라마이드 크림을 바르세요', pairs), 'セラミドクリーム을 바르세요');
  assert.equal(applyGlossary('세라마이드 함유', pairs), 'セラミド 함유', '등록 안 된 조합은 짧은 표기가 적용된다');
  assert.equal(applyGlossary('빈 사전은 무해', []), '빈 사전은 무해');
});

// ── 수집 ─────────────────────────────────────────────────────────────────────

test('collectTranslatable — 일본어만 입력하면 빈 배열(콜 0)', () => {
  const input = baseInput({
    ingredients: [{ name: 'ナイアシンアミド', percent: '2%', purpose: '整肌成分' }],
    cautions: ['お肌に異常が生じないかよく注意してご使用ください。'],
  });
  assert.deepEqual(collectTranslatable(input, ''), []);
});

test('collectTranslatable — 한글 필드만 경로와 함께 모은다', () => {
  const input = baseInput({
    spec: { volume: '30mL', category: '의약외품', manufacturer: '株式会社HARUON', origin: '한국', fullIngredients: '水、BG' },
    ingredients: [
      { name: '나이아신아마이드', percent: '2%', purpose: '피부결 정돈' },
      { name: 'ヒアルロン酸Na', percent: '—', purpose: '保湿成分' },
    ],
    cautions: ['상처 부위에는 사용하지 마세요.', '直射日光を避けて保管してください。'],
    reviews: [{ text: '끈적임 없이 좋아요', rating: '★5', age: '30대' }],
  });
  const paths = collectTranslatable(input, '더 밝고 화사하게').map((f) => f.path);

  assert.deepEqual(paths.sort(), [
    'cautions[0]',
    'ingredients[0].name',
    'ingredients[0].purpose',
    'note',
    'reviews[0].age',
    'reviews[0].text',
    'spec.category',
    'spec.origin',
  ].sort());

  // 일본어로 이미 쓴 항목은 섞이지 않는다
  assert.ok(!paths.includes('ingredients[1].name'));
  assert.ok(!paths.includes('cautions[1]'));
});

test('collectTranslatable — null 그룹(proof·sales·test·promo)은 건너뛴다', () => {
  const input = baseInput({ proof: null, sales: null, test: null, promo: null });
  assert.deepEqual(collectTranslatable(input, ''), []);
});

test('collectTranslatable — kind 분류가 취급을 가른다', () => {
  const input = baseInput({
    spec: { volume: '30밀리리터', category: '의약외품', manufacturer: '한국법인', origin: '한국', fullIngredients: '정제수, 부틸렌글라이콜' },
  });
  const byPath = new Map(collectTranslatable(input, '밝게').map((f) => [f.path, f.kind]));
  assert.equal(byPath.get('spec.category'), 'regulated');
  assert.equal(byPath.get('spec.fullIngredients'), 'regulated');
  assert.equal(byPath.get('spec.volume'), 'numeric');
  assert.equal(byPath.get('spec.manufacturer'), 'free');
  assert.equal(byPath.get('note'), 'artDirection');
});

// ── 선처리 ───────────────────────────────────────────────────────────────────

test('preTranslate — 区分은 LLM 없이 확정된다', () => {
  const fields: TranslatableField[] = [
    { path: 'spec.category', label: '구분(区分)', kr: '의약외품', kind: 'regulated' },
    { path: 'spec.origin', label: '원산지', kr: '한국', kind: 'free' },
  ];
  const { resolved, remaining } = preTranslate(fields, null);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].ja, '医薬部外品');
  assert.equal(resolved[0].via, 'kubun');
  assert.deepEqual(remaining.map((f) => f.path), ['spec.origin']);
});

test('preTranslate — 용어집이 완전히 해소하면 확정, 일부만 바꾸면 콜⑧으로', () => {
  const kit: BrandKit = {
    productNamesJa: [{ kr: '세라마이드 크림', ja: 'セラミドクリーム' }],
    forbiddenTerms: [],
    toneGuide: '',
  };
  const fields: TranslatableField[] = [
    { path: 'options[0].name', label: '옵션 1 이름', kr: '세라마이드 크림', kind: 'free' },
    { path: 'cautions[0]', label: '주의사항 1', kr: '세라마이드 크림을 바른 뒤 주의하세요', kind: 'free' },
  ];
  const { resolved, remaining } = preTranslate(fields, kit);
  assert.deepEqual(resolved.map((f) => f.path), ['options[0].name']);
  assert.equal(resolved[0].via, 'glossary');
  assert.deepEqual(remaining.map((f) => f.path), ['cautions[0]'], '한글이 남으면 모델이 마저 처리한다');
});

// ── 사후 검사 ────────────────────────────────────────────────────────────────

test('verifyTranslation — 한글 잔존·숫자 변조는 채택하지 않는다', () => {
  const f: TranslatableField = { path: 'sales.count', label: '누적 판매', kr: '누적 163,991개', kind: 'numeric' };

  const ok = verifyTranslation(f, '累計163,991個');
  assert.equal(ok.ok, true);
  assert.equal(ok.ja, '累計163,991個');

  const bad = verifyTranslation(f, '累計163,000個');
  assert.equal(bad.ok, false);
  assert.equal(bad.ja, '累計163,000個', '실패해도 값은 남긴다 — 사용자가 보고 고친다');
  assert.match(bad.problem ?? '', /숫자/);

  const hangul = verifyTranslation(f, '누적 163,991개');
  assert.equal(hangul.ok, false);
  assert.match(hangul.problem ?? '', /한글/);

  const empty = verifyTranslation(f, '   ');
  assert.equal(empty.ok, false);
  assert.equal(empty.ja, f.kr, '빈 응답은 원문으로 되돌린다');
});

test('verifyTranslation — artDirection 은 영어이므로 숫자 검사를 하지 않는다', () => {
  const f: TranslatableField = { path: 'note', label: '추가 요청', kr: '전체적으로 더 밝고 화사하게', kind: 'artDirection' };
  const r = verifyTranslation(f, 'Brighter, airier overall tone with soft daylight.');
  assert.equal(r.ok, true);
  assert.equal(verifyTranslation(f, '더 밝게 brighter').ok, false, '한글이 남으면 실패');
});

test('collectForbidden — 금지 표현은 수집만 하고 변환을 되돌리지 않는다', () => {
  const kit: BrandKit = { productNamesJa: [], forbiddenTerms: [{ term: '完全', reason: '단정 표현 금지' }], toneGuide: '' };
  const fields: TranslatedField[] = [
    { path: 'cautions[0]', label: '주의사항 1', kr: '완전 차단', ja: '完全にブロック', kind: 'free', ok: true, via: 'llm' },
    { path: 'cautions[1]', label: '주의사항 2', kr: '보습', ja: '保湿', kind: 'free', ok: true, via: 'llm' },
  ];
  const hits = collectForbidden(fields, kit);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].path, 'cautions[0]');
  assert.equal(hits[0].term, '完全');
});

// ── 적용 ─────────────────────────────────────────────────────────────────────

test('applyTranslations — 경로대로 되쓰고 원본은 건드리지 않는다', () => {
  const input = baseInput({
    spec: { volume: '30mL', category: '의약외품', manufacturer: '株式会社', origin: '한국', fullIngredients: '水' },
    ingredients: [{ name: '나이아신아마이드', percent: '2%', purpose: '피부결 정돈' }],
    cautions: ['상처 부위 사용 금지', '直射日光を避ける'],
  });
  const fields: TranslatedField[] = [
    { path: 'spec.category', label: '구분(区分)', kr: '의약외품', ja: '医薬部外品', kind: 'regulated', ok: true, via: 'kubun' },
    { path: 'spec.origin', label: '원산지', kr: '한국', ja: '韓国', kind: 'free', ok: true, via: 'llm' },
    { path: 'ingredients[0].name', label: '성분 1 성분명', kr: '나이아신아마이드', ja: 'ナイアシンアミド', kind: 'free', ok: true, via: 'llm' },
    { path: 'cautions[0]', label: '주의사항 1', kr: '상처 부위 사용 금지', ja: '傷のある部位には使用しないでください', kind: 'free', ok: true, via: 'llm' },
  ];

  const next = applyTranslations(input, fields);
  assert.equal(next.spec.category, '医薬部外品');
  assert.equal(next.spec.origin, '韓国');
  assert.equal(next.ingredients[0].name, 'ナイアシンアミド');
  assert.equal(next.ingredients[0].percent, '2%', '건드리지 않은 필드는 그대로');
  assert.equal(next.cautions[0], '傷のある部位には使用しないでください');
  assert.equal(next.cautions[1], '直射日光を避ける');

  assert.equal(input.spec.category, '의약외품', '원본은 불변이어야 한다(sourceKo 스냅샷을 함께 든다)');
});

test('applyTranslations — ok:false 는 적용하지 않는다', () => {
  const input = baseInput({ sales: { count: '누적 163,991개', period: '2022년' } });
  const next = applyTranslations(input, [
    { path: 'sales.count', label: '누적 판매', kr: '누적 163,991개', ja: '累計163,000個', kind: 'numeric', ok: false, problem: '숫자', via: 'llm' },
  ]);
  assert.equal(next.sales?.count, '누적 163,991개', '검사 실패분은 원문이 남아 확인 패널에서 고쳐진다');
});

test('applyTranslations — note 는 DetailInput 밖이라 되쓰지 않는다', () => {
  const input = baseInput();
  const fields: TranslatedField[] = [
    { path: 'note', label: '추가 요청', kr: '밝게', ja: 'Brighter', kind: 'artDirection', ok: true, via: 'llm' },
  ];
  assert.deepEqual(applyTranslations(input, fields), input);
  assert.deepEqual(sourceSnapshot(fields), [], 'note 는 원문 스냅샷에도 들어가지 않는다(promptUsed 가 정본)');
});

// ── 클라이언트 캐시 재검증 ───────────────────────────────────────────────────

test('verifyClientTranslation — 원문이 그대로면 재사용(complete)', () => {
  const input = baseInput({ cautions: ['상처 부위 사용 금지'] });
  const r = verifyClientTranslation(input, '', [
    { path: 'cautions[0]', kr: '상처 부위 사용 금지', ja: '傷のある部位には使用しないでください' },
  ]);
  assert.equal(r.complete, true);
  assert.equal(r.fields[0].ok, true);
});

test('verifyClientTranslation — 원문이 바뀌면 캐시를 버린다', () => {
  // 확인 화면에서 블록을 껐다 켜는 사이 사용자가 입력을 바꾼 상황.
  // 숫자가 없는 필드라 다른 검사는 전부 통과한다 — kr 대조가 없으면 엉뚱한 일본어가 들어간다.
  const input = baseInput({ cautions: ['직사광선을 피해 보관하세요'] });
  const r = verifyClientTranslation(input, '', [
    { path: 'cautions[0]', kr: '상처 부위 사용 금지', ja: '傷のある部位には使用しないでください' },
  ]);
  assert.equal(r.complete, false, '캐시가 현재 입력을 못 덮으면 호출부가 콜⑧을 다시 태운다');
  assert.equal(r.fields[0].ok, false);
  assert.equal(r.fields[0].ja, '직사광선을 피해 보관하세요', '엉뚱한 번역이 아니라 원문이 남는다');
});

test('verifyClientTranslation — 사용자가 고친 값도 같은 검사를 통과해야 채택된다', () => {
  const input = baseInput({ sales: { count: '누적 163,991개', period: '2022년' } });
  const r = verifyClientTranslation(input, '', [
    { path: 'sales.count', kr: '누적 163,991개', ja: '累計999個' },
    { path: 'sales.period', kr: '2022년', ja: '2022年' },
  ]);
  const count = r.fields.find((f) => f.path === 'sales.count');
  assert.equal(count?.ok, false, '사람이 고쳤다고 숫자 변조가 안전해지지는 않는다');
  assert.equal(r.fields.find((f) => f.path === 'sales.period')?.ok, true);
});

test('getAt — 없는 경로는 undefined', () => {
  const input = baseInput();
  assert.equal(getAt(input, 'spec.volume'), '30mL');
  assert.equal(getAt(input, 'promo.setTitle'), undefined);
  assert.equal(getAt(input, 'ingredients[5].name'), undefined);
});
