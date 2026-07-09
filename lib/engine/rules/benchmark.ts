/**
 * 파이프라인 4단계 — 카테고리 경쟁 벤치마크 (규칙 · MVP).
 * 사전집계 실측 인용 + 사전 신호 기반 간이 대비표(스펙 블록4 — MVP는 규칙 흡수, 문장화는 콜④).
 * 가짜 수치 생성 금지: 인용은 사전집계 안의 실측 표현만.
 */

import type { BenchmarkData, Category, PreSignals } from '../types';
import { getCategoryAggregate, getLexiconTop } from '../grounding';

/** 신뢰 장치별 코퍼스 대표 표현을 찾는다(키워드 매칭 — 결정적) */
function pickQuote(badges: { text: string; count: number }[], patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const hit = badges.find((b) => pattern.test(b.text));
    if (hit) return hit.text;
  }
  return '';
}

/** 사전집계 + 사전 신호로 벤치마크 데이터를 만든다 */
export function buildBenchmark(category: Category, signals: PreSignals): BenchmarkData {
  const agg = getCategoryAggregate(category);
  if (!agg) {
    return { sampleCount: 0, corpusQuotes: [], comparisonRows: [], searchTermRows: [] };
  }

  const devices: { device: string; patterns: RegExp[]; customerHas: boolean; gapNote: string }[] = [
    {
      device: '효능 근거 라벨',
      patterns: [/効能評価|試験/],
      customerHas: false, // 근거 라벨 존재는 콜①(A1)이 판정 — 여기선 각주·수치 신호로 근사
      gapNote: '효능 주장에 시험·근거 라벨을 세트로 붙이는 것이 관례 (루브릭 A1)',
    },
    {
      device: '조건 각주(※/＊)',
      patterns: [/※|＊/],
      customerHas: signals.hasFootnoteMark,
      gapNote: '주장의 범위를 스스로 한정하는 각주 문화 (루브릭 A2)',
    },
    {
      device: '프리 처방(무첨가) 라벨',
      patterns: [/フリー|無添加|無香料|無着色/],
      customerHas: signals.hasFreeLabel,
      gapNote: '"무엇을 뺐나"를 배지로 명시 (루브릭 B1)',
    },
    {
      device: '제3자 지표(랭킹·리뷰·수상)',
      patterns: [/ランキング|1位|受賞|レビュー|ベストコスメ/],
      customerHas: signals.hasThirdPartyProof,
      gapNote: '자화자찬 대신 검증 가능한 외부 지표 + 집계일 (루브릭 A4)',
    },
    {
      device: '성분 정량(%)·기전',
      patterns: [/\d+(\.\d+)?%|配合/],
      customerHas: signals.hasIngredientPercent,
      gapNote: '성분명 + 농도·기전까지 제시 (루브릭 D1·D2)',
    },
  ];

  const corpusQuotes: BenchmarkData['corpusQuotes'] = [];
  const comparisonRows: BenchmarkData['comparisonRows'] = [];
  for (const d of devices) {
    const quote = pickQuote(agg.topTrustBadges, d.patterns) || pickQuote(
      agg.appealExamples.map((text) => ({ text, count: 1 })),
      d.patterns,
    );
    if (quote) corpusQuotes.push({ device: d.device, quote });
    comparisonRows.push({
      device: d.device,
      corpusExample: quote || '(이 표본에서 대표 표현 미발견)',
      customerStatus: d.customerHas ? '관찰됨' : '미관찰',
      gapNote: d.gapNote,
    });
  }

  return {
    sampleCount: agg.sampleCount,
    corpusQuotes: corpusQuotes.slice(0, 4),
    comparisonRows,
    searchTermRows: getLexiconTop(8).map((t) => ({ term: t.term, reading: t.reading, frequency: t.frequency })),
  };
}
