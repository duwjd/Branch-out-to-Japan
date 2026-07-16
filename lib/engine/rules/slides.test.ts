/**
 * 슬라이드 렌더러 단위 테스트 — 스펙 AC-10.2~10.6 + v4 모드별 덱(§10.4).
 * renderDeckHtml은 순수 함수라 LLM 없이 전부 검증된다.
 * 픽스처는 캐스트 없이 완전한 BlocksJson을 만든다 — `as BlocksJson`은 타입 변경을 세탁하므로 금지.
 * 러너: node:test. 실행: npm run test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderDeckHtml, escapeHtml } from './slides';
import { SLIDE_KEYS_BRAND, SLIDE_KEYS_FULL } from '../types';
import type { BlocksJson, DeckSpec, PersonaResult, SlideCopy, SlideKey } from '../types';

/** 카피 1장 — 인자로 준 문자열을 그대로 심는다(이스케이프·숫자 테스트용) */
function copy(text = '카피'): SlideCopy {
  return { heading: text, lead: text, bullets: [text] };
}

/** 지정 키 전부 같은 카피로 채운 덱 spec */
function deck(keys: readonly SlideKey[], text?: string): DeckSpec {
  return Object.fromEntries(keys.map((k) => [k, copy(text)])) as DeckSpec;
}

/** 콜③ 산출 픽스처 — 두 모드 공통 블록(2·6)의 원천 */
function persona(): PersonaResult {
  return {
    persona: {
      name: '유이',
      ageRange: '20대 후반',
      skinConcerns: ['민감성', '붉은기'],
      buyingMotive: '진정 성분의 근거 확인 후 구매',
      checkBehaviors: ['@cosme 리뷰 확인', '성분표 대조'],
      priceSensitivity: '3,000엔 이하 선호',
      trustTriggers: ['효능 근거 라벨', '저자극 테스트 표기'],
    },
    journey: { stages: ['인지', '탐색', '구매'], finalConfidencePoint: '성분 근거 확인' },
    objections: [
      { question: '本当に敏感肌でも大丈夫？', why: '저자극 근거 미표기' },
      { question: '効果の根拠は？', why: '시험 근거 부재' },
    ],
    uspTable: [
      { krAppeal: '즉각 진정', jpReading: '근거 없는 단정으로 읽힘', redefinedUsp: '저자극 테스트를 마친 진정 처방' },
      { krAppeal: '고농축', jpReading: '수치 없이 과장으로 읽힘', redefinedUsp: '배합률을 명시한 성분 설계' },
      { krAppeal: '병원급 케어', jpReading: '의약품 오인 표현', redefinedUsp: '피부과 테스트 완료 표기' },
    ],
    reviewNarrative: [{ infoGap: '저자극 근거 부재', distrustSignal: '리뷰에서 자극 여부 질문 반복', dropOff: '장바구니 이탈' }],
  };
}

/** 브랜드+제품 진단(풀 모드) blocksJson — 렌더러가 읽는 모든 필드를 캐스트 없이 채운다 */
function fullBlocks(): BlocksJson {
  return {
    meta: {
      engineVersion: '0.1.0',
      llmMode: 'real',
      model: 'claude-sonnet-5',
      generatedAt: '2026-07-16',
      precisionLimited: false,
      mode: 'brandProduct',
      category: 'skincare',
      productClass: '화장품',
      productClassAssumed: false,
    },
    block0: {
      brandName: 'HARUON',
      productName: 'CICA 진정 앰플',
      categoryLabel: '스킨케어',
      productClassLabel: '화장품',
      priceLabel: '30만 원',
      issuedAt: '2026-07-16',
      scope: '범위',
      limitSummary: '한계',
    },
    block1: {
      scored: true,
      overallScore: 18,
      groupScores: { A: 10, B: 0, C: 33, D: 25, E: 13 },
      top3: [{ itemId: 'B1', title: '무첨가 라벨', score: 0 }],
      summaryText: '총평',
      trustBadges: ['채점 기준 공개'],
    },
    block2: persona(),
    block3: {
      gradeNote: '화장품 상정',
      gradeRows: [],
      sentences: [
        {
          sentenceId: 'K4',
          verdict: '불가',
          reason: '의약품적 효능',
          clauseRefs: ['2'],
          altTextJa: 'うるおいで整える',
          originalText: '재생시켜 근본부터 치료합니다',
        },
      ],
      summary: { ngCount: 6, conditionalCount: 5, okCount: 0, highestRiskId: 'K4' },
      disclaimer: '1차 스크리닝입니다',
    },
    block4: {
      sampleCount: 90,
      corpusQuotes: [],
      comparisonRows: [
        { device: '효능 근거 라벨', corpusExample: '効能評価試験済み', customerStatus: '미관찰', gapNote: 'A1 미탑재' },
        { device: '성분 배합률', corpusExample: 'グリシルグリシン 6%', customerStatus: '관찰됨', gapNote: '부분' },
      ],
      searchTermRows: [],
      narrative: '벤치마크 총평',
    },
    block5: {
      items: [],
      groupScores: { A: 10, B: 0, C: 33, D: 25, E: 13 },
      weights: { A: 0.3, B: 0.15, C: 0.25, D: 0.2, E: 0.1 },
    },
    block6: { narrative: persona().reviewNarrative, generalNote: '카테고리 일반형' },
    block7: {
      rewrites: [
        {
          sourceRef: 'K3',
          beforeKr: '즉각 진정',
          problem: '효과 보증',
          afterJa: 'うるおいでキメ整える',
          afterKr: '수분으로 결을 정돈한다',
          reason: '이유',
          whatAdded: ['각주'],
          uspRowIndex: 0,
        },
      ],
    },
    block8: { targetSection: '섹션', afterJaBlock: 'ブロック', afterKrBlock: '블록', isDemo: false },
    block9: {
      actions: [],
      sources: [],
      limits: [],
      funnel: [{ step: '① 진단', price: '30만 원', note: '이 리포트' }],
    },
  };
}

/** 브랜드 진단 blocksJson — 블록 3·5·7·8 = null(데이터 잠금), 대비표는 '미확인' */
function brandBlocks(): BlocksJson {
  const base = fullBlocks();
  return {
    ...base,
    meta: { ...base.meta, mode: 'brand', productClass: '미상', productClassAssumed: false },
    block0: { ...base.block0, productName: '(제품 정보 미입력)', productClassLabel: '—(제품 정보 미입력)' },
    block1: {
      scored: false,
      lockedReason: '고객 문장이 없어 산출 불가',
      unlockHint: '상세페이지 카피를 넣으면 점수·감사가 열립니다',
      summaryText: '브랜드 진단 요약',
      trustBadges: ['채점 기준 공개'],
    },
    block3: null,
    block4: {
      ...base.block4,
      comparisonRows: base.block4.comparisonRows.map((r) => ({ ...r, customerStatus: '미확인', gapNote: '콘텐츠 미제출' })),
    },
    block5: null,
    block7: null,
    block8: null,
  };
}

describe('renderDeckHtml — 브랜드+제품 덱(7장)', () => {
  it('AC-10.3 · 수치는 blocksJson에서만 나온다 — 카피의 틀린 숫자는 무시된다', () => {
    // LLM이 규칙을 어기고 카피에 엉뚱한 숫자를 넣은 상황을 재현
    const html = renderDeckHtml(deck(SLIDE_KEYS_FULL, '종합점수는 99점이고 불가는 1건입니다'), fullBlocks());

    // 렌더 결과는 blocksJson의 값을 쓴다
    assert.match(html, /<span class="n">18<\/span>/, '종합점수는 block1.overallScore(18)이어야 한다');
    assert.match(html, /<span class="n">6<\/span><span class="l">불가<\/span>/, '불가 건수는 block3.summary.ngCount(6)이어야 한다');
    assert.match(html, /<span class="n">5<\/span><span class="l">조건부<\/span>/);
    assert.match(html, /라쿠텐 상세 90건/, '표본 수는 block4.sampleCount여야 한다');
    assert.match(html, /30만 원/, '가격은 block9.funnel에서 와야 한다');

    // 카피의 숫자가 그대로 실려도 그건 카피 영역일 뿐 — 수치 슬롯을 오염시키지 않는다
    assert.doesNotMatch(html, /<span class="n">99<\/span>/, '카피의 99가 점수 자리에 들어가면 안 된다');
  });

  it('AC-10.4 · 모든 동적 문자열이 이스케이프된다', () => {
    const xss = '<script>alert(1)</script>';
    const blocks = fullBlocks();
    blocks.block0.brandName = xss;
    const html = renderDeckHtml(deck(SLIDE_KEYS_FULL, xss), blocks);

    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/, '원문 script 태그가 살아 있으면 안 된다');
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, '이스케이프된 형태로 나와야 한다');
    // 렌더러 자신의 스크립트 블록은 정확히 1개
    assert.equal((html.match(/<script>/g) ?? []).length, 1, '삽입된 script는 렌더러 것 하나뿐이어야 한다');
  });

  it('AC-10.5 · 결정적 — 같은 입력이면 바이트가 같다', () => {
    const a = renderDeckHtml(deck(SLIDE_KEYS_FULL), fullBlocks());
    const b = renderDeckHtml(deck(SLIDE_KEYS_FULL), fullBlocks());
    assert.equal(a, b);
  });

  it('AC-10.6 · 일본어 구간에 lang="ja"가 붙는다', () => {
    const html = renderDeckHtml(deck(SLIDE_KEYS_FULL), fullBlocks());
    assert.match(html, /<p lang="ja">うるおいでキメ整える<\/p>/, 'After(JP)에 lang=ja');
    assert.match(html, /lang="ja">効能評価試験済み/, '코퍼스 인용에 lang=ja');
    assert.match(html, /<html lang="ko">/, '문서 기본 언어는 한국어');
  });

  it('7장이 모두 렌더되고 카운터가 7이다', () => {
    const html = renderDeckHtml(deck(SLIDE_KEYS_FULL), fullBlocks());
    assert.equal((html.match(/<section class="s/g) ?? []).length, SLIDE_KEYS_FULL.length);
    assert.match(html, /1 \/ 7</);
  });

  it('재작성이 없어도 깨지지 않는다 (콜④ 실패 폴백 — 잠금과 다른 의미)', () => {
    const blocks = fullBlocks();
    blocks.block7 = { rewrites: [] };
    const html = renderDeckHtml(deck(SLIDE_KEYS_FULL), blocks);
    assert.match(html, /재작성 결과가 없습니다/);
  });

  it('목 모드 리포트는 배지를 단다', () => {
    const blocks = fullBlocks();
    blocks.meta.llmMode = 'mock';
    const html = renderDeckHtml(deck(SLIDE_KEYS_FULL), blocks);
    assert.match(html, /목\(mock\) 모드/);
  });
});

describe('renderDeckHtml — 브랜드 덱(4장 · 스펙 §10.4 v4)', () => {
  it('4장만 렌더되고 카운터가 4다 — 결론·점수·리스크·비포애프터 장이 존재하지 않는다', () => {
    const html = renderDeckHtml(deck(SLIDE_KEYS_BRAND), brandBlocks());
    assert.equal((html.match(/<section class="s/g) ?? []).length, SLIDE_KEYS_BRAND.length);
    assert.match(html, /1 \/ 4</);
    assert.doesNotMatch(html, /<div class="score">/, '점수 표시가 있으면 안 된다(산출 안 함)');
    assert.doesNotMatch(html, /불가<\/span>/, '감사 건수가 있으면 안 된다');
  });

  it('없는 수치를 0으로 위장하지 않는다 — 어떤 점수 슬롯도 렌더되지 않는다', () => {
    const html = renderDeckHtml(deck(SLIDE_KEYS_BRAND), brandBlocks());
    assert.doesNotMatch(html, /<span class="n">0<\/span>/, '0점·0건이 렌더되면 증거 원칙 위반');
  });

  it("대비표 '미확인'은 중립색(na) — 적색(ng·미관찰)이 아니다", () => {
    const html = renderDeckHtml(deck(SLIDE_KEYS_BRAND), brandBlocks());
    assert.match(html, /<td class="na">미확인<\/td>/);
    assert.doesNotMatch(html, /미관찰/, '찾아본 적 없는 것을 "미관찰"로 주장하면 안 된다');
  });

  it('포지셔닝 슬라이드가 block2.uspTable을 렌더한다', () => {
    const html = renderDeckHtml(deck(SLIDE_KEYS_BRAND), brandBlocks());
    assert.match(html, /저자극 테스트를 마친 진정 처방/);
    assert.match(html, /재정의된 구매 이유/);
  });

  it('AC-10.2 · 무의존 — 두 모드 공통', () => {
    for (const html of [
      renderDeckHtml(deck(SLIDE_KEYS_FULL), fullBlocks()),
      renderDeckHtml(deck(SLIDE_KEYS_BRAND), brandBlocks()),
    ]) {
      assert.doesNotMatch(html, /src="https?:/, '외부 src 금지');
      assert.doesNotMatch(html, /href="https?:/, '외부 href 금지');
      assert.doesNotMatch(html, /cdn\./i, 'CDN 참조 금지 — Chart.js를 다시 넣지 말 것');
      assert.doesNotMatch(html, /@import/, '외부 CSS import 금지');
      assert.doesNotMatch(html, /fonts\.googleapis/, '웹폰트 금지');
    }
  });

  it('AC-10.5 · 결정적 — 브랜드 덱도 같은 입력이면 바이트가 같다', () => {
    assert.equal(
      renderDeckHtml(deck(SLIDE_KEYS_BRAND), brandBlocks()),
      renderDeckHtml(deck(SLIDE_KEYS_BRAND), brandBlocks()),
    );
  });

  it('카피가 빠진 키는 조용히 넘어가지 않고 던진다', () => {
    const spec = deck(SLIDE_KEYS_BRAND);
    delete spec.positioning;
    assert.throws(() => renderDeckHtml(spec, brandBlocks()), /슬라이드 카피 누락: positioning/);
  });
});

describe('escapeHtml', () => {
  it('HTML 특수문자 5종을 모두 바꾼다', () => {
    assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  });

  it('& 를 먼저 바꿔 이중 이스케이프하지 않는다', () => {
    assert.equal(escapeHtml('<'), '&lt;');
    assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  });
});
