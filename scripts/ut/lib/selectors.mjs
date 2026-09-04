/**
 * 화면 선택자·라벨 맵 — 한 곳에 모은다.
 *
 * 라벨이 화면마다 다른 함정이 있다: `unset` 이 썸네일 폼에서는 「전체」, 상세 폼에서는 「미정」이다.
 * 하나로 하드코딩하면 다른 쪽이 조용히 안 눌린다.
 */

export const CATEGORY_CHIP = { skincare: '스킨케어', makeup: '메이크업', suncare: '선케어', cleansing: '클렌징' };
export const PRODUCT_CLASS_CHIP = { 화장품: '화장품', 의약외품: '의약외품', 미상: '잘 모르겠음' };
export const ONBOARDING_CATEGORY = CATEGORY_CHIP;

export const PLATFORM_THUMB = {
  unset: '전체',
  'amazon-jp': '아마존JP',
  'rakuten-official': '라쿠텐 공식샵',
  'rakuten-reseller': '라쿠텐 리셀러',
  qoo10: 'Qoo10',
};
export const PLATFORM_DETAIL = { ...PLATFORM_THUMB, unset: '미정' };

export const DETAIL_CATEGORY = {
  skincare: '스킨케어',
  suncare: '선케어',
  makeup: '색조',
  cleansing: '클렌징',
  haircare: '헤어',
  etc: '기타',
};

export const DETAIL_TEMPLATE = {
  D1: '문제해결 서사형',
  D2: '성분 근거형',
  D3: '스펙·씬 신뢰형',
  D4: '컬러 배리에이션형',
  D5: '저자극·편의형',
  D6: '브랜드 프리미엄형',
};

export const THUMB_STYLE = {
  A: '클린 스튜디오 단독컷',
  B: '제품+텍스처 스와치',
  C: '공식샵 신뢰 배지형',
  D: '캐치카피+성분 비주얼형',
  E: '수상 실적 스택형',
  F: '모델+카피형',
  G: '프로모션 강조형',
  H: '프리미엄 무드형',
};

export const JP_CHANNEL = { qoo10: 'Qoo10', rakuten: '라쿠텐', 'amazon-jp': '아마존JP', undecided: '미정' };

/** 16종 포지셔닝 태그 — lib/engine/rules/positioning.ts 와 값·라벨이 같아야 한다 */
export const POSITIONING_TAGS = [
  ['sensitive', '민감 피부·저자극'],
  ['freeFormula', '무첨가·프리 처방'],
  ['ingredientLed', '성분 집중'],
  ['derma', '더마·피부과학'],
  ['cleanVegan', '클린·비건'],
  ['moisture', '보습·장벽'],
  ['calming', '진정 케어'],
  ['pore', '모공·피지 케어'],
  ['tone', '톤·브라이트닝'],
  ['firming', '탄력·안티에이징'],
  ['efficacy', '효능 근거·기능성'],
  ['mens', '남성 특화'],
  ['kTrend', 'K뷰티 트렌드'],
  ['value', '가성비'],
  ['sensorial', '향·질감 감성'],
  ['minimal', '미니멀 처방'],
];

export const REPORT_TAB_LABELS = ['시장', '진단', '처방'];

export const STAGE_LABEL = {
  extract: '원문 추출',
  normalize: '정규화',
  presignals: '사전 신호',
  llmCalls: '진단 생성',
  persona: '페르소나',
  aggregate: '집계',
  benchmark: '벤치마크',
  call4: '처방',
  assemble: '조립',
  humanize: '윤문',
  analyze: '분석',
  plan: '블록 설계',
  copy: '카피 생성',
  blocks: '블록 생성',
  compose: '결합',
  slice: '분할',
  gate: '검수',
  generate: '이미지 생성',
};
