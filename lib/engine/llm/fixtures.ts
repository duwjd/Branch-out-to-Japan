/**
 * 목(mock) 모드 픽스처 — ANTHROPIC_API_KEY 없이 전체 플로우를 확인하기 위한 결정적 가짜 판정.
 * 간단한 키워드 휴리스틱으로 "그럴듯한" 리포트 모양을 만들지만, 판정 품질은 실모드와 무관하다.
 * 리포트 메타(llmMode=mock)와 화면 배지로 목 모드임을 항상 표시한다.
 */

import type {
  AuditResult,
  AuditSentenceResult,
  Category,
  DeckSpec,
  PersonaResult,
  PreSignals,
  ReportMode,
  RewriteResult,
  ScoredItem,
  Sentence,
} from '../types';
import type { RubricItem } from '../rubric';

/** 콜① 목: 사전 신호가 있으면 1점, 없으면 0점 — KR 카피 특유의 저점 패턴을 흉내 */
export function mockCall1(items: RubricItem[], signals: PreSignals, sentences: Sentence[]): { items: ScoredItem[] } {
  const firstQuote = sentences[0]?.text ?? '';
  const scoreFor = (item: RubricItem): 0 | 1 | 2 => {
    switch (item.id) {
      case 'A2': return signals.hasFootnoteMark ? 1 : 0;
      case 'A4': return signals.hasThirdPartyProof ? 1 : 0;
      case 'B1': return signals.hasFreeLabel ? 1 : 0;
      case 'B2': return signals.hasFreeLabel ? 1 : 0;
      case 'D1': return signals.hasIngredientPercent ? 2 : 0;
      case 'D4': return 1;
      case 'C1': return 1;
      case 'E1': return signals.hasSpfPa ? 2 : 0;
      default: return 0;
    }
  };
  return {
    items: items.map((item) => ({
      itemId: item.id,
      score: scoreFor(item),
      evidenceQuote: scoreFor(item) > 0 ? firstQuote : '',
      criterionRef: item.criterion,
      corpusRef: '(목 모드 — 실제 코퍼스 인용은 실모드에서)',
    })),
  };
}

const NG_PATTERNS: { pattern: RegExp; reason: string; clauses: string[]; alt: string }[] = [
  {
    pattern: /(재생|치료|치유|수복|修復|재건)/,
    reason: '「再生/治療」계열은 의약품적 효능 표현 — 화장품·의약외품 어느 등급으로도 불가',
    clauses: ['2', '3', '6'],
    alt: 'うるおいで肌を整え、なめらかな肌へ導きます。',
  },
  {
    pattern: /(사라집니다|사라진|없애|싹|해결|끝내)/,
    reason: '「消える/解消」계열 효과 보증 표현 — 표현 불가',
    clauses: ['1', '6'],
    alt: '乾燥による肌あれ※が気になる肌を、うるおいで整えます。※角質層まで',
  },
  {
    pattern: /(병원|피부과|시술|처방)/,
    reason: '의료 행위·의료기관 연관 암시 — 표현 불가',
    clauses: ['2', '3'],
    alt: 'パッチテスト済み※。毎日のケアに。※すべての方に刺激が起きないわけではありません',
  },
  {
    pattern: /(깊은 곳|깊숙|속까지|진피)/,
    reason: '침투 표현은 角質層まで 한정 필요 — 무한정 침투 암시는 불가',
    clauses: ['2', '4'],
    alt: '角層のすみずみ※まで、うるおいで満たします。※角質層まで',
  },
];

const CONDITIONAL_PATTERNS: { pattern: RegExp; reason: string; clauses: string[]; alt: string }[] = [
  {
    pattern: /(\d+\s*(시간|일|주|개월)|즉각|즉시|바르는 순간)/,
    reason: '수치·지속·즉효 단정에는 効能評価試験 근거 + ※조건 각주가 필요',
    clauses: ['5', '6'],
    alt: '（効能評価試験の裏づけがある場合のみ）効能評価試験済み表記+※条件footnoteで再設計',
  },
  {
    pattern: /(완판|판매량|1위|랭킹|만 병|만병|리뷰)/,
    reason: '판매 실적·순위는 사실이면 가능하나 집계 시점·출처 명기가 필요(景表法)',
    clauses: ['7'],
    alt: 'おかげさまで、累計出荷◯本を突破しました。※◯年◯月時点・自社出荷実績',
  },
];

/** 콜② 목: 키워드 휴리스틱으로 문장별 판정 생성 */
export function mockCall2(sentences: Sentence[]): AuditResult {
  const results: AuditSentenceResult[] = sentences.map((s) => {
    const ng = NG_PATTERNS.find((p) => p.pattern.test(s.text));
    if (ng) {
      return { sentenceId: s.id, verdict: '불가', reason: ng.reason, clauseRefs: ng.clauses, altTextJa: ng.alt };
    }
    const cond = CONDITIONAL_PATTERNS.find((p) => p.pattern.test(s.text));
    if (cond) {
      return { sentenceId: s.id, verdict: '조건부', reason: cond.reason, clauseRefs: cond.clauses, altTextJa: cond.alt };
    }
    return { sentenceId: s.id, verdict: '가능', reason: '규정 저촉 신호 미관찰(목 모드 판정)', clauseRefs: [], altTextJa: '' };
  });
  const ngCount = results.filter((r) => r.verdict === '불가').length;
  const conditionalCount = results.filter((r) => r.verdict === '조건부').length;
  return {
    sentences: results,
    summary: {
      ngCount,
      conditionalCount,
      okCount: results.length - ngCount - conditionalCount,
      highestRiskId: results.find((r) => r.verdict === '불가')?.sentenceId ?? results[0]?.sentenceId ?? 'K1',
    },
  };
}

/** 콜③ 목: 카테고리별 고정 페르소나 템플릿 */
export function mockCall3(category: Category): PersonaResult {
  return {
    persona: {
      name: 'ユイ',
      ageRange: '20대 후반~30대 초반',
      skinConcerns: category === 'suncare' ? ['白浮き', '崩れ'] : ['乾燥', '肌あれ', '毛穴'],
      buyingMotive: '고민을 확실히 다뤄준다는 "근거"가 보일 때 산다',
      checkBehaviors: ['@cosme·LIPS 리뷰 확인', '成分·フリー処方 라벨 확인', 'ランキング·수상 이력 확인'],
      priceSensitivity: '2,000~3,500엔대 — 근거가 보이면 상향 허용',
      trustTriggers: ['効能評価試験済み', '※조건 각주', '第三者 지표+集計日'],
    },
    journey: {
      stages: ['인지: 인스타/틱톡에서 발견', '탐색: 口コミ·랭킹에서 검증', '구매: 상세페이지에서 근거 최종 확인'],
      finalConfidencePoint: '상세페이지의 근거 라벨·각주·제3자 지표에서 최종 확신을 얻는다',
    },
    objections: [
      { question: '「化粧品でそんな効果出るの?」', why: '과장 광고 학습 효과 — 근거 없는 단정은 오히려 감점' },
      { question: '「口コミ本当?集計日は?」', why: '자화자찬 실적은 집계일·출처 없으면 불신 트리거' },
    ],
    uspTable: [
      { krAppeal: '즉각 효과 강조', jpReading: '근거 없는 단정 = 과장으로 읽혀 감점', redefinedUsp: '근거 라벨+각주로 "검증된 안심"을 판다' },
      { krAppeal: '감성 형용사 소구', jpReading: '정보가 없다고 읽힘', redefinedUsp: '성분 정량·기전 등 정보 구조로 재설계' },
      { krAppeal: '판매 실적 과시', jpReading: '집계일 없는 실적 = 의심 유발', redefinedUsp: '集計時点 명기한 제3자 검증 프레임' },
    ],
    reviewNarrative: [
      {
        infoGap: '근거 라벨·각주 부재',
        distrustSignal: '「本当に効くの?」류 의심 리뷰가 붙기 쉬움',
        dropOff: '口コミ 탐색 단계에서 이탈',
      },
      {
        infoGap: '성분 정량·기전 정보 부재',
        distrustSignal: '「何が入ってるの?」 — 성분 검색 후 미복귀',
        dropOff: '상세 확인 단계에서 장바구니 포기',
      },
    ],
  };
}

/** 콜④ 목: 불가/조건부 문장에서 재작성 카드 생성 */
export function mockCall4(audit: AuditResult, sentences: Sentence[]): RewriteResult {
  const textById = new Map(sentences.map((s) => [s.id, s.text]));
  const targets = audit.sentences.filter((s) => s.verdict !== '가능').slice(0, 4);
  const rewrites = targets.map((t, i) => ({
    sourceRef: t.sentenceId,
    beforeKr: textById.get(t.sentenceId) ?? '',
    problem: t.reason,
    afterJa: t.altTextJa || 'うるおいで肌を整える毎日のケアへ。',
    afterKr: '(목 모드 역해설) 효과 단정 대신 "정돈한다" 프레임으로 낮춰 합법화한 문장입니다.',
    reason: '의약품적 효능·무근거 단정을 제거하고 일본 관례(근거+절제) 구조로 재배열',
    whatAdded: ['※조건 각주', '등급 내 효능 프레임'],
    uspRowIndex: i % 3,
  }));
  return {
    headline: {
      summary:
        '(목 모드 총평) 감성·즉효 중심의 한국식 소구가 다수 관찰됩니다. 일본 관례상 근거 라벨·조건 각주·제3자 지표가 없으면 신뢰를 얻기 어렵습니다 — 저점 항목부터 정보 구조를 재설계하세요.',
    },
    rewrites,
    sample: {
      targetSection: '히어로 카피 블록',
      afterJaBlock: 'ゆらぎがちな肌に、うるおいという選択を。\n角層のすみずみ※まで満たすCICAアンプル。\n※角質層まで',
      afterKrBlock: '(목 모드) 흔들리기 쉬운 피부에, 수분이라는 선택을. 각질층 구석구석까지 채우는 CICA 앰플. — 공감→약속 구조.',
      isDemo: false,
    },
    benchmarkNarrative:
      '(목 모드) 이 카테고리 상위 제품은 근거 라벨·프리 처방·제3자 지표를 세트로 노출하는 반면, 진단 대상 카피에서는 해당 장치가 관찰되지 않았습니다.',
  };
}

/**
 * 콜⑤ 목: 슬라이드 7장 카피 — 결정적 고정 문구.
 * 실모드와 동일하게 **숫자를 한 개도 쓰지 않는다**(수치는 렌더러가 blocksJson에서 인용 — 스펙 §10.3).
 */
export function mockCall5(mode: ReportMode = 'brandProduct'): DeckSpec {
  if (mode === 'brand') {
    return {
      cover: {
        heading: '일본 시장 진입 브랜드 진단 결과',
        lead: '(목 모드) 브랜드 포지셔닝을 일본 고객 관점으로 진단했습니다. 제품 콘텐츠는 제출되지 않았습니다.',
        bullets: ['상세페이지 카피를 넣으면 약기법 감사·문법 점수가 열림', '진단 범위와 한계를 문서에 명시'],
      },
      positioning: {
        heading: '일본 고객은 이 브랜드를 이렇게 읽습니다',
        lead: '(목 모드) 한국식 소구가 일본 고객에게 어떻게 읽히는지, 구매 이유를 어떻게 재정의해야 하는지 정리했습니다.',
        bullets: ['타깃 페르소나와 구매 전 확인 행동을 구체화', '소구별 재정의된 구매 이유(USP)를 표로 제시'],
      },
      benchmark: {
        heading: '일본 상위 제품은 신뢰를 이렇게 쌓습니다',
        lead: '(목 모드) 실측 코퍼스에서 관찰된 신뢰 장치입니다. 고객 콘텐츠 대비는 콘텐츠 제출 후 열립니다.',
        bullets: ['상위 제품은 효능 뒤에 근거 라벨을 붙임', '내 콘텐츠와의 대비는 상세페이지 카피 제출 후 산출'],
      },
      nextStep: {
        heading: '다음 단계',
        lead: '(목 모드) 상세페이지 카피를 넣으면 문장 단위 감사와 점수가 열립니다.',
        bullets: ['약기법 전수 감사·A~E 문법 점수·NG/OK 재작성이 추가됨', '고정가라 견적 왕복이 없음'],
      },
    };
  }
  return {
    cover: {
      heading: '일본 시장 진입 진단 결과',
      lead: '(목 모드) 상세페이지 카피를 일본 시장 관례 기준으로 진단했습니다.',
      bullets: ['고정가 1회 · 추가 과금 없음', '진단 범위와 한계를 문서에 명시'],
    },
    conclusion: {
      heading: '번역이 아니라 신뢰 구조가 없습니다',
      lead: '(목 모드) 지금 카피를 그대로 일본어로 옮기면 소구력을 잃기 전에 광고가 내려갈 수 있습니다.',
      bullets: [
        '일본 고객이 근거로 삼는 정보 구조가 카피에 없음',
        '약기법상 표현 불가·조건부 문장이 다수',
        '고칠 문장과 대체 표현을 문장 단위로 제시함',
      ],
    },
    score: {
      heading: '어느 축이 비었는가',
      lead: '(목 모드) 점수가 낮은 축은 번역 품질이 아니라 신뢰 장치의 부재를 가리킵니다.',
      bullets: ['근거 라벨·조건 각주가 관찰되지 않음', '무첨가·안전 소구가 부재', '축별 통과 기준과 내 문장을 리포트에 공개'],
    },
    risk: {
      heading: '상장 전에 걸러야 할 문장',
      lead: '(목 모드) 광고 정지·수정 리스크를 상품 등록 전에 제거하는 것이 이 진단의 첫 값어치입니다.',
      bullets: ['문장별로 불가·조건부·가능을 판정', '판정마다 규정 조항을 각주로 제시', '1차 스크리닝이며 상장 전 약무 전문가 확인 권고'],
    },
    benchmark: {
      heading: '일본 상위 제품과 무엇이 다른가',
      lead: '(목 모드) 감이 아니라 실측 코퍼스 대비로 빠진 신뢰 장치를 짚었습니다.',
      bullets: ['상위 제품은 효능 뒤에 근거 라벨을 붙임', '수치는 크기보다 정확도로 신뢰를 얻음'],
    },
    beforeAfter: {
      heading: '문장 하나가 이렇게 달라집니다',
      lead: '(목 모드) 효과 단정을 지우고 등급 안에서 소구를 살린 재설계안입니다.',
      bullets: ['일본어 문장마다 한국어 역해설 병기', '일본어를 몰라도 무엇이 바뀌었는지 확인 가능'],
    },
    nextStep: {
      heading: '다음 단계',
      lead: '(목 모드) 진단만 받고 끝내도 됩니다. 제작이 필요할 때만 확장합니다.',
      bullets: ['고정가라 견적 왕복이 없음', '스튜디오 첫 달은 진단비를 공제함'],
    },
  };
}

/** 체커 목: 콜② 휴리스틱의 경량판 */
export function mockChecker(text: string): { violations: { quote: string; verdict: '불가' | '조건부'; clauseRef: string; shortHint: string }[]; okCount: number } {
  const violations: { quote: string; verdict: '불가' | '조건부'; clauseRef: string; shortHint: string }[] = [];
  for (const p of NG_PATTERNS) {
    const m = text.match(p.pattern);
    if (m) violations.push({ quote: m[0], verdict: '불가', clauseRef: p.clauses[0], shortHint: p.reason });
  }
  for (const p of CONDITIONAL_PATTERNS) {
    const m = text.match(p.pattern);
    if (m) violations.push({ quote: m[0], verdict: '조건부', clauseRef: p.clauses[0], shortHint: p.reason });
  }
  return { violations, okCount: violations.length === 0 ? 1 : 0 };
}
