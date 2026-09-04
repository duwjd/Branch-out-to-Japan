/**
 * 출력 언어 계약 검사 단위 테스트.
 * 러너: node:test. 실행: npm run test.
 *
 * 이 테스트의 요점은 두 축을 **정책표에 직접 대고** 고정하는 것이다.
 *  ① 목 픽스처(계약 정본)는 위반 0건이어야 한다 — 정상 계약에도 일본어가 섞이므로,
 *    정책표에 `ko` 를 과하게 걸면 여기서 깨진다.
 *  ② `.data/llm-call-logs.jsonl` 에 남은 **실측 표류 응답**은 통째 표류로 잡혀야 한다 —
 *    이게 잡히지 않으면 브랜드 진단이 일본어 리포트를 그대로 발행한다.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGE_POLICY, slideLanguageRules } from './calls';
import { evaluateLanguage, isWholesaleDrift, languageRepairMessage } from './languageCheck';
import { mockCall1, mockCall2, mockCall3, mockCall4, mockCall5 } from './fixtures';
import type { AuditResult, PreSignals, Sentence } from '../types';
import { applicableItems } from '../rubric';

/** 사전 신호 없음 — 콜① 목 픽스처 입력용 */
const NO_SIGNALS: PreSignals = {
  hasNumericClaim: false,
  hasSpfPa: false,
  hasFootnoteMark: false,
  hasFreeLabel: false,
  hasThirdPartyProof: false,
  hasIngredientPercent: false,
  notes: [],
};

/** 콜③ 실측 표류 — real 모드 로그에서 그대로 옮긴 응답(값만 발췌) */
const DRIFTED_CALL3 = {
  persona: {
    name: '佐藤 由美子',
    ageRange: '20代後半〜30代前半',
    skinConcerns: ['乾燥', '肌あれ'],
    buyingMotive: '鎮静と保湿を同時に叶える、毎日安心して使える低刺激スキンケアを探している',
    checkBehaviors: ['@cosme・LIPSの口コミ確認'],
    priceSensitivity: '',
    trustTriggers: ['効能評価試験済み'],
  },
  journey: {
    stages: [
      '認知：SNS（インスタ/TikTok）でシカアンプルを発見し「低刺激」「鎮静」というキーワードに関心を持つ',
      '探索：@cosme・LIPSで敏感肌向け口コミを確認し、医薬部外品表記・成分リストの有無を比較する',
      '購入：詳細ページで皮膚科テストの根拠・無香料表記を再確認した上で購入を決定する',
    ],
    finalConfidencePoint: '詳細ページの根拠ラベルと第三者指標で最終的な確信を得る',
  },
  objections: [
    {
      question: '「皮膚科テスト済み」とあるが、どの機関・どんな基準のテストか分からない',
      why: '日本の敏感肌ユーザーは効能評価試験の実施機関や基準を確認する習慣があり、抽象的な表現だけでは根拠不足と読まれやすい',
    },
  ],
  uspTable: [
    {
      krAppeal: '피부과 테스트를 마친 성분만 사용',
      jpReading: 'テスト機関・基準が不明確なため『皮膚科テスト済み』の表現だけでは根拠不足として読まれる',
      redefinedUsp: '成分リストの全面公開と医薬部外品／化粧品の区分明示によって信頼を再構成する',
    },
  ],
  reviewNarrative: [
    {
      infoGap: '敏感肌向け製品において医薬部外品の有無や試験機関情報が明確に記載されていない',
      distrustSignal: '『低刺激』『鎮静』といった感情的表現のみで具体的な成分名・試験根拠が乏しい',
      dropOff: '口コミ探索段階で成分表を確認できなかったユーザーは購入直前で離脱する',
    },
  ],
};

describe('LANGUAGE_POLICY — 목 픽스처(계약 정본)는 위반 0건', () => {
  it('콜③ — 일본어 어휘 필드(name·skinConcerns·trustTriggers)를 오탐하지 않는다', () => {
    const report = evaluateLanguage(mockCall3('skincare'), LANGUAGE_POLICY.call3);
    assert.deepEqual(report.violations, [], JSON.stringify(report.violations, null, 2));
    assert.equal(isWholesaleDrift(report), false);
  });

  it('콜③ — suncare 카테고리도 통과(skinConcerns 가 갈린다)', () => {
    const report = evaluateLanguage(mockCall3('suncare'), LANGUAGE_POLICY.call3);
    assert.deepEqual(report.violations, []);
  });

  it('콜① — criterionRef 는 한국어, corpusRef 는 검사 대상이 아니다', () => {
    const items = applicableItems('skincare');
    const sentences: Sentence[] = [{ id: 'K1', text: '피부 진정에 탁월합니다' }];
    const data = mockCall1(items, NO_SIGNALS, sentences);
    assert.deepEqual(evaluateLanguage(data, LANGUAGE_POLICY.call1).violations, []);
  });

  it('콜② — reason 한국어 / altTextJa 일본어', () => {
    const sentences: Sentence[] = [{ id: 'K1', text: '주름이 사라집니다' }];
    const data = mockCall2(sentences);
    assert.deepEqual(evaluateLanguage(data, LANGUAGE_POLICY.call2).violations, []);
  });

  it('콜④ — afterJa 일본어 / afterKr·problem·reason 한국어', () => {
    const sentences: Sentence[] = [{ id: 'K1', text: '주름이 사라집니다' }];
    const audit = mockCall2(sentences) as AuditResult;
    const data = mockCall4(audit, sentences);
    assert.deepEqual(evaluateLanguage(data, LANGUAGE_POLICY.call4).violations, []);
  });

  it('콜⑤ — 두 모드 슬라이드 카피 전부 한국어', () => {
    for (const mode of ['brand', 'brandProduct'] as const) {
      const data = mockCall5(mode);
      const keys = Object.keys(data);
      assert.deepEqual(evaluateLanguage(data, slideLanguageRules(keys)).violations, [], mode);
    }
  });
});

describe('LANGUAGE_POLICY — 실측 표류를 잡는다', () => {
  const report = evaluateLanguage(DRIFTED_CALL3, LANGUAGE_POLICY.call3);

  it('한국어 서술 필드가 대부분 위반으로 잡힌다', () => {
    assert.ok(report.koViolated >= 8, `잡힌 위반 ${report.koViolated}건`);
    const paths = report.violations.map((v) => v.path);
    for (const expected of [
      'persona.buyingMotive',
      'journey.stages[0]',
      'objections[0].why',
      'uspTable[0].jpReading',
      'uspTable[0].redefinedUsp',
      'reviewNarrative[0].infoGap',
    ]) {
      assert.ok(paths.includes(expected), `${expected} 미검출`);
    }
  });

  it('통째 표류로 판정된다 — 브랜드 진단이 일본어 리포트를 발행하지 못하게 막는 선', () => {
    assert.equal(isWholesaleDrift(report), true, `${report.koViolated}/${report.koChecked}`);
  });

  it('일본어여야 하는 objections[].question 은 위반이 아니다', () => {
    assert.equal(
      report.violations.some((v) => v.path === 'objections[0].question'),
      false,
    );
  });

  it('빈 값(priceSensitivity)은 위반으로 세지 않는다 — 정당한 빈 값이 있다', () => {
    assert.equal(
      report.violations.some((v) => v.path === 'persona.priceSensitivity'),
      false,
    );
  });

  it('교정 지시에 위반 경로가 그대로 담긴다', () => {
    const msg = languageRepairMessage(report);
    assert.ok(msg);
    assert.match(msg, /한국어로 다시 쓸 것/);
    assert.match(msg, /journey\.stages\[0\]/);
  });
});

describe('부분 표류는 통째 표류가 아니다', () => {
  it('한 필드만 일본어면 repair 대상이지 계약 위반이 아니다', () => {
    const partial = structuredClone(mockCall3('skincare'));
    partial.persona.buyingMotive = '毎日安心して使える低刺激スキンケアを探している';
    const report = evaluateLanguage(partial, LANGUAGE_POLICY.call3);
    assert.equal(report.koViolated, 1);
    assert.equal(isWholesaleDrift(report), false);
    assert.ok(languageRepairMessage(report));
  });

  it('위반이 없으면 교정 지시는 null', () => {
    const report = evaluateLanguage(mockCall3('skincare'), LANGUAGE_POLICY.call3);
    assert.equal(languageRepairMessage(report), null);
  });
});

describe('경로 파서', () => {
  it('없는 경로는 조용히 건너뛴다 — 폴백 응답에 필드가 빠져 있어도 터지지 않는다', () => {
    const report = evaluateLanguage({}, LANGUAGE_POLICY.call4);
    assert.deepEqual(report.violations, []);
    assert.equal(report.koChecked, 0);
  });

  it('중첩 배열(rewrites[].whatAdded[])을 전개한다', () => {
    const data = { rewrites: [{ whatAdded: ['근거 라벨', '効能評価試験済みの明示'] }] };
    const report = evaluateLanguage(data, [{ path: 'rewrites[].whatAdded[]', policy: 'ko' }]);
    assert.equal(report.koChecked, 2);
    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].path, 'rewrites[0].whatAdded[1]');
  });
});
