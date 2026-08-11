/**
 * 목(mock) 모드 픽스처 — LLM 키 없이도 상세페이지 한 장이 끝까지 나오게 한다.
 * 썸네일 fixtures.ts 와 같은 역할: 결정적(같은 입력 → 같은 값)이어야 회귀 테스트가 가능하다.
 *
 * ⚠ 여기 값은 **데모 카피**다. 실제 근거가 필요한 슬롯(가격·실적·시험·전성분)은
 *   목 모드에서도 채우지 않는다 — 코드 소유 슬롯이라 assembleBlockSlots 가 입력값으로만 채운다.
 */

import type { BlockType } from './output';
import type { ProductCategory } from './blockPack';

/** 카테고리별 데모 카피 축 — 무드가 상품 종류에 따라 달라진다는 요구를 목 모드에서도 지킨다. */
const AXIS: Record<ProductCategory, { concern: string; benefit: string; scene: string; texture: string }> = {
  skincare: { concern: '毛穴の目立ち', benefit: 'キメの整った肌印象へ', scene: '朝と夜のスキンケア', texture: 'とろみのある美容液' },
  suncare: { concern: '日焼けと乾燥', benefit: '白浮きしない仕上がり', scene: '通勤・レジャー・スポーツ', texture: 'みずみずしいミルク' },
  makeup: { concern: '色選びの迷い', benefit: '肌なじみのよい発色', scene: 'デイリーメイク', texture: 'なめらかなクリーム' },
  cleansing: { concern: 'メイクの洗い残し', benefit: 'つっぱらない洗い上がり', scene: '一日の終わりに', texture: 'やわらかなバーム' },
  haircare: { concern: '髪のパサつき', benefit: '指通りのよい髪へ', scene: 'バスタイム', texture: 'とろけるトリートメント' },
  etc: { concern: '肌の揺らぎ', benefit: '心地よい使用感', scene: '毎日のケア', texture: '軽やかなテクスチャー' },
};

/**
 * 블록별 LLM 슬롯 목 값. source:'llm' 슬롯만 채운다 —
 * 코드 소유 슬롯을 여기서 채우면 게이트를 우회하게 되므로 절대 넣지 않는다.
 */
export function mockLlmSlots(blockId: BlockType, category: ProductCategory, brandName: string): Record<string, string> {
  const a = AXIS[category] ?? AXIS.etc;

  switch (blockId) {
    case 'hero-product':
      return {
        productNameJa: `${brandName} デイリー トリートメント`,
        catchCopyJa: `${a.concern}が気になる方へ`,
        subCopyJa: `${a.benefit}。毎日続けやすい設計にしました。`,
        heroPlacement: 'right',
        backgroundVisual: 'a calm studio backdrop with soft gradient and gentle contact shadow',
      };
    case 'problem-hook':
      return {
        hookQuestionJa: 'こんなお悩みありませんか？',
        painPointsJa: [`${a.concern}が続いている`, '朝のメイクのりが安定しない', '季節の変わり目に揺らぎやすい'].join('\n'),
        empathyCopyJa: 'その原因は、ひとつではないかもしれません。',
        sceneDescription: 'a quiet morning bathroom counter with soft daylight',
        copyZone: 'left',
      };
    case 'cause-structure':
      return {
        titleJa: '原因は大きく3つ',
        causeItemsJa: [
          '乾燥による角質の乱れ|うるおいが行き渡らず、キメが乱れて見えることがあります。',
          '摩擦による負担|洗顔やタオルの摩擦が積み重なると、肌の負担になります。',
          '不十分な保湿|与えたうるおいを保つ設計がないと、続きにくくなります。',
        ].join('\n'),
        causeSummaryJa: 'だからこそ、与えて守る設計が必要です。',
      };
    case 'before-after-diagram':
      return {
        leftLabelJa: 'うるおいが届いていない肌',
        rightLabelJa: 'うるおいが届いている肌',
        diagramDescription: 'two simplified skin cross-sections side by side',
      };
    case 'mechanism-explainer':
      return {
        mechanismTitleJa: '与えて、守る。2段階の設計',
        stepsJa: [
          'うるおいを届ける|微細な設計で角質層のすみずみまでなじみます。',
          'うるおいを保つ|肌表面をととのえ、乾燥から守ります。',
        ].join('\n'),
      };
    case 'ingredient-card':
      return {
        headlineJa: '選び抜いた保湿成分を配合',
        bodyJa: `${a.concern}が気になる肌へ。角質層までうるおいを届け、キメを整えます。`,
      };
    case 'point-list':
      return {
        pointsJa: [
          `${a.benefit}|使用感を第一に設計しました。`,
          '毎日続けやすい設計|忙しい日でも手早くケアできます。',
          '心地よい使い心地|べたつきにくい仕上がりです。',
        ].join('\n'),
      };
    case 'spec-panel':
      return { highlightJa: 'スペックで選ぶ' };
    case 'usage-scene':
      return {
        scenesJa: a.scene.split('・').join('\n'),
        sceneNoteJa: '汗をかいたあとはこまめに塗り直してください。',
        sceneDescription: 'bright outdoor lifestyle scene with natural light',
      };
    case 'free-from-badges':
      return { headlineJa: '肌へのやさしさを考えた処方' };
    case 'color-chip-grid':
      return { headlineJa: '肌なじみで選べるカラー' };
    case 'personal-color-look':
      return {
        looksJa: ['01|ブルベ冬におすすめ|クリアで澄んだ印象に', '02|イエベ秋におすすめ|やわらかく落ち着いた印象に'].join('\n'),
        lookDescription: 'editorial beauty look using the supplied brand model cut',
      };
    case 'lineup-compare-chart':
      return { axesJa: ['うるおい', '軽さ', '香り'].join('\n') };
    case 'how-to-use':
      return { amountJa: 'さくらんぼ大', timingJa: '洗顔後すぐ' };
    case 'brand-story':
      return {
        conceptTitleJa: '毎日の肌に、無理のない選択を',
        storyBodyJa: `${brandName}は、続けられることを設計の起点に置いています。`,
        storyVisual: 'cinematic still life with restrained palette and soft light',
        copyZone: 'left',
      };
    case 'texture-shot':
      return { textureCopyJa: a.texture, textureDescription: `macro shot of ${a.texture}` };
    case 'swatch-demo':
      return { swatchDescription: 'orderly cosmetic swatches on a clean surface' };
    default:
      return {};
  }
}

// ── 콜⑧ inputTranslate 목 ────────────────────────────────────────────────────

/**
 * 목 모드용 소형 KR→JA 데모 사전.
 *
 * 일부러 **다 덮지 않는다**. 사전에 없는 표현은 한글이 남은 채로 돌아가고, 사후 검사가 그걸
 * `ok:false` 로 잡아 확인 패널에 「직접 일본어로 입력해 주세요」가 뜬다 —
 * 즉 목 모드에서도 **실패 경로가 그대로 재현**된다. 전부 성공하는 목은 실패 UX를 못 만든다.
 */
const MOCK_LEXICON: [string, string][] = [
  ['나이아신아마이드', 'ナイアシンアミド'],
  ['히알루론산', 'ヒアルロン酸'],
  ['세라마이드', 'セラミド'],
  ['판테놀', 'パンテノール'],
  ['병풀추출물', 'ツボクサエキス'],
  ['정제수', '水'],
  ['부틸렌글라이콜', 'BG'],
  ['글리세린', 'グリセリン'],
  ['피부결 정돈', '整肌成分'],
  ['보습', '保湿成分'],
  ['진정', '肌荒れ防止'],
  ['합성향료', '合成香料'],
  ['광물유', '鉱物油'],
  ['파라벤', 'パラベン'],
  ['에탄올', 'エタノール'],
  ['합성착색료', '合成着色料'],
  ['한국', '韓国'],
  ['일본', '日本'],
  ['주식회사', '株式会社'],
  ['누적 판매', '累計販売'],
  ['누적', '累計'],
  ['개', '個'],
  ['명', '名'],
  ['대', '代'],
  ['건', '件'],
  ['주간', '週間'],
  ['연용시험', '連用試験'],
  ['효능평가시험 완료', '効能評価試験済み'],
  ['제3자 평가기관', '第三者評価機関'],
  ['세트', 'セット'],
  ['미니사이즈', 'ミニサイズ'],
  ['쿠폰 적용 시 가격입니다.', 'クーポン適用時の価格です。'],
  ['상처 부위에는 사용하지 마세요.', '傷やはれもの、湿疹等、異常のある部位にはお使いにならないでください。'],
  ['직사광선을 피해 보관하세요.', '直射日光を避けて保管してください。'],
  ['세안 후', '洗顔後'],
  ['적당량을 손에 덜어', '適量を手にとり'],
  ['얼굴 전체에 펴 발라 주세요.', '顔全体になじませます。'],
  ['끈적임 없이 좋아요', 'べたつかず、使い心地がよいです'],
  ['년', '年'],
  ['월', '月'],
  ['일', '日'],
];

/**
 * 목 모드 KR→JA 변환 — 사전을 긴 표기부터 적용한다.
 * @param kr 원문
 */
export function mockTranslate(kr: string): string {
  const sorted = [...MOCK_LEXICON].sort((a, b) => b[0].length - a[0].length);
  let out = kr;
  for (const [k, v] of sorted) out = out.split(k).join(v);
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** 목 모드 이미지 아트 디렉션(영어) — 실제 콜은 원문 의도를 영어로 옮긴다. */
export function mockArtDirection(kr: string): string {
  return kr.trim() ? 'Follow the brand art direction requested by the client.' : '';
}
