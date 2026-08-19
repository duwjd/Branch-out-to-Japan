/**
 * 언어 판정 단위 테스트 — 임계값 0.35의 회귀 방어선.
 * 러너: node:test. 실행: npm run test.
 *
 * 두 축을 같이 고정한다.
 *  ① **정상 계약**(목 픽스처 `mockCall3` 실제 값)이 오탐되지 않을 것 — 정상값에도 일본어가 섞인다.
 *  ② **실측 표류**(`.data/llm-call-logs.jsonl` real 모드 콜③ 응답 원문)가 전부 검출될 것.
 * 임계값을 조정하려면 두 배열을 먼저 보라. 한쪽만 보고 올리거나 내리면 반대쪽이 깨진다.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasHangul, hasKanaOrKanji, isJapanese, isKoreanDominant, koreanRatio, stripQuotedSpans } from './lang';

/** 콜③ 실측 표류 — 한국어여야 할 서술이 통째로 일본어로 나온 실제 응답값 */
const DRIFTED_KO_FIELDS = [
  '鎮静と保湿を同時に叶える、毎日安心して使える低刺激スキンケアを探している',
  '認知：SNS（インスタ/TikTok）でシカアンプルを発見し「低刺激」「鎮静」というキーワードに関心を持つ',
  '日本の敏感肌ユーザーは効能評価試験の実施機関や基準を確認する習慣があり、抽象的な『皮膚科テスト済み』表現だけでは根拠不足と読まれやすい',
  '敏感肌向け製品において医薬部外品の有無や試験機関情報が詳細ページに明確に記載されていない場合、購入前に情報不足と感じる傾向が観察される',
  'テスト機関・基準が不明確なため『皮膚科テスト済み』の表現だけでは根拠不足として読まれる',
  '成分リストの全面公開と医薬部外品／化粧品の区分明示によって信頼を再構成する',
];

/** 목 픽스처(계약 정본)의 `ko` 정책 필드 — 일본어 관례어가 섞여 있어도 통과해야 한다 */
const CONTRACT_KO_FIELDS = [
  '20대 후반~30대 초반',
  '고민을 확실히 다뤄준다는 "근거"가 보일 때 산다',
  '2,000~3,500엔대 — 근거가 보이면 상향 허용',
  '인지: 인스타/틱톡에서 발견',
  '탐색: 口コミ·랭킹에서 검증',
  '구매: 상세페이지에서 근거 최종 확인',
  '상세페이지의 근거 라벨·각주·제3자 지표에서 최종 확신을 얻는다',
  '과장 광고 학습 효과 — 근거 없는 단정은 오히려 감점',
  '자화자찬 실적은 집계일·출처 없으면 불신 트리거',
  '근거 없는 단정 = 과장으로 읽혀 감점',
  '근거 라벨+각주로 "검증된 안심"을 판다',
  '集計時点 명기한 제3자 검증 프레임',
  '근거 라벨·각주 부재',
  '「本当に効くの?」류 의심 리뷰가 붙기 쉬움',
  '「何が入ってるの?」 — 성분 검색 후 미복귀',
  '口コミ 탐색 단계에서 이탈',
  '의약품적 효능·무근거 단정을 제거하고 일본 관례(근거+절제) 구조로 재배열',
];

describe('koreanRatio', () => {
  it('인용 스팬을 걷어낸 뒤 센다 — 「」 안 일본어는 계약이 권장하는 형태다', () => {
    assert.equal(stripQuotedSpans('「本当に効くの?」류 의심 리뷰').includes('本当'), false);
    // 인용을 세면 0.5 아래로 떨어지지만, 걷어내면 본문은 한국어뿐이다
    assert.equal(koreanRatio('「本当に効くの?」류 의심 리뷰가 붙기 쉬움'), 1);
  });

  it('문자 종류가 없으면(숫자·기호·영문) 1 — 판정 대상이 아니다', () => {
    assert.equal(koreanRatio('2,000~3,500 / SPF50+ PA++++'), 1);
    assert.equal(koreanRatio(''), 1);
  });

  it('순 일본어는 0', () => {
    assert.equal(koreanRatio('医薬部外品の有無'), 0);
  });
});

describe('isKoreanDominant — 정상 계약을 오탐하지 않는다', () => {
  for (const text of CONTRACT_KO_FIELDS) {
    it(`통과: ${text.slice(0, 24)}`, () => {
      assert.equal(isKoreanDominant(text), true, `ratio=${koreanRatio(text)}`);
    });
  }

  it('빈 값은 통과 — 증거 원칙상 정당한 빈 값이 있다(가격 미제공 → priceSensitivity)', () => {
    assert.equal(isKoreanDominant(''), true);
    assert.equal(isKoreanDominant('   '), true);
  });
});

describe('isKoreanDominant — 실측 표류를 전부 검출한다', () => {
  for (const text of DRIFTED_KO_FIELDS) {
    it(`검출: ${text.slice(0, 24)}`, () => {
      assert.equal(isKoreanDominant(text), false, `ratio=${koreanRatio(text)}`);
    });
  }
});

describe('isJapanese — 일본어 필수 필드', () => {
  it('일본어만 있으면 통과', () => {
    assert.equal(isJapanese('うるおいで肌を整える毎日のケアへ。'), true);
    assert.equal(isJapanese('効能評価試験済み'), true);
  });

  it('한글이 섞이면 거부 — 렌더 폰트가 그리지 못하는 자리에 한글이 남는 문제', () => {
    assert.equal(isJapanese('うるおいで 피부를 整える'), false);
    assert.equal(isJapanese('수분으로 피부를 정돈한다'), false);
  });

  it('빈 값은 통과 — altTextJa 는 "가능" 판정이면 빈 문자열이 계약이다', () => {
    assert.equal(isJapanese(''), true);
  });
});

describe('문자 검출 기본', () => {
  it('hasHangul 은 자모 단독도 잡는다', () => {
    assert.equal(hasHangul('가'), true);
    assert.equal(hasHangul('ㄱ'), true);
    assert.equal(hasHangul('ㅏ'), true);
    assert.equal(hasHangul('あ漢'), false);
  });

  it('hasKanaOrKanji 는 가나·한자·반각 가타카나를 잡는다', () => {
    assert.equal(hasKanaOrKanji('あ'), true);
    assert.equal(hasKanaOrKanji('ア'), true);
    assert.equal(hasKanaOrKanji('ｱ'), true);
    assert.equal(hasKanaOrKanji('漢'), true);
    assert.equal(hasKanaOrKanji('한글 abc 123'), false);
  });
});
