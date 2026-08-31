/**
 * 상세페이지 출력 규격 — 클라이언트 안전 잎 노드(fs 미사용).
 * 폼('use client')과 서버 파이프라인이 같은 정의를 공유한다(platform.ts 관례).
 *
 * 왜 "결합 1장"만으로는 안 되는가:
 *  라쿠텐 R-Cabinet은 이미지 1장당 최대 3840px·2MB다. 즉 1200×14000 마스터는
 *  **업로드 자체가 물리적으로 불가능**하다. 결합본은 사용자의 확인·승인·공유용이고,
 *  몰에 실제로 올라가는 것은 분할본이다. 화면도 이 관계를 그대로 말해야 한다.
 */

import type { Platform } from '../platform';

/** 상세페이지를 구성하는 블록 타입 — 정본은 docs/research/jp-detail-style-taxonomy.md */
export type BlockType =
  | 'mall-promo-banner' // B01 몰 프로모 배너
  | 'set-offer-table' // B02 세트·수량 오퍼표
  | 'hero-product' // B03 히어로 제품컷·캐치카피
  | 'ranking-stack' // B04 랭킹·수상 스택
  | 'cumulative-sales' // B05 누적 판매·리뷰 수
  | 'problem-hook' // B06 문제 제기·공감
  | 'cause-structure' // B07 원인 구조화
  | 'before-after-diagram' // B08 비교 도해(일러스트)
  | 'mechanism-explainer' // B09 기전 도해
  | 'ingredient-card' // B10 성분 카드
  | 'quant-data-graph' // B11 정량 데이터·그래프
  | 'test-evidence-label' // B12 시험·근거 라벨
  | 'point-list' // B13 POINT 나열
  | 'spec-panel' // B14 스펙 수치 패널
  | 'usage-scene' // B15 사용 씬
  | 'free-from-badges' // B16 무첨가·프리 처방
  | 'color-chip-grid' // B17 컬러 칩 그리드
  | 'color-chart-matrix' // B18 컬러 차트 매트릭스
  | 'personal-color-look' // B19 퍼스널컬러 룩
  | 'lineup-compare-chart' // B20 라인업 비교 차트
  | 'swatch-demo' // B21 발색·텍스처 시연
  | 'how-to-use' // B22 사용법 STEP
  | 'brand-story' // B23 브랜드 스토리
  | 'texture-shot' // B24 텍스처·질감 컷
  | 'customer-review' // B25 리뷰·구매자 목소리
  | 'product-spec-table' // B26 제품 스펙표
  | 'footnote-block'; // B27 각주 모음

/**
 * 렌더 경로.
 *  - 'text'      : satori 단독. AI 미개입 — 법적 블록은 팩에서 이 값으로 고정된다.
 *  - 'ai-visual' : AI 배경컷이 블록 전면(텍스트 없음)
 *  - 'hybrid'    : AI 배경컷 위에 satori 텍스트를 얹는다(블록당 satori 1패스)
 */
export type RenderKind = 'text' | 'ai-visual' | 'hybrid';

/**
 * 텍스트를 AI에게 절대 그리게 하지 않는 블록.
 * 근거 표기(効能評価試験済み·集計日·全成分)는 한 글자만 변형돼도 근거로서 무효가 되고
 * 그게 곧 법적 리스크다. 확산 모델의 글리프 정확도는 문자 수에 대해 곱셈으로 떨어지므로
 * 200자 이상 블록은 사실상 0%다 — 그래서 이 목록은 팩에서 덮어쓸 수 없다.
 */
export const TEXT_ONLY_BLOCKS: readonly BlockType[] = [
  'mall-promo-banner',
  'set-offer-table',
  'ranking-stack',
  'cumulative-sales',
  'quant-data-graph',
  'test-evidence-label',
  'spec-panel',
  'free-from-badges',
  'lineup-compare-chart',
  'customer-review',
  'product-spec-table',
  'footnote-block',
];

/** 작업 캔버스 폭. 세 몰의 권장 상한 이상이라 출력은 다운스케일만 한다(업스케일 없음). */
export const CANVAS_WIDTH = 1200;

/** 총 세로 상한. 1500px × 12장 = 라쿠텐 20장 제한 안쪽. 초과분은 잘라내고 게이트에 경고를 남긴다. */
export const MAX_TOTAL_HEIGHT = 18_000;

/** 가변 높이 블록을 렌더할 때 쓰는 넉넉한 캔버스 높이(센티넬로 실측 후 크롭). */
export const BLOCK_CANVAS_HEIGHT = 4_000;

/**
 * 배경컷이 깔리는 블록(hybrid·ai-visual)의 고정 높이.
 * 텍스트 블록처럼 콘텐츠 높이에 맞춰 줄이면 배경 사진의 윗부분만 남아 제품이 잘려 나간다.
 * 비주얼 밴드는 "디자인된 높이"를 갖는 게 맞고, 생성 크기(1024×1536 ≒ 2:3)와도 맞물린다.
 */
export const VISUAL_BLOCK_HEIGHT = 1_500;

/**
 * AI 이미지 생성 블록 수 하드캡(2026-08-18 4 → 6).
 *
 * 4였을 때 카테고리 필수 컷(사용컷·제형컷)이 들어갈 자리가 없었다 — D2는 히어로 한 장짜리였다.
 * 초과분은 planBlocks() 가 우선순위대로 잘라 'text'로 강등한다.
 *
 * ⚠ **IMAGE_CONCURRENCY 와 같은 값을 유지할 것.** 소요를 결정하는 건 장수가 아니라 웨이브 수다.
 *   gpt-image-2 1장이 40~90초라, 동시성보다 큰 값을 주면 2웨이브가 되어 300초 예산을 넘긴다.
 */
export const MAX_AI_BLOCKS = 6;

/**
 * 이미지 생성 동시 실행 수 — 6장을 **한 웨이브**로 끝내기 위한 값이다(2026-08-18 4 → 6).
 * maxDuration=300 은 Vercel Hobby 플랫폼 상한이라 올릴 수 없으므로(11 §2),
 * 시간을 더 사는 대신 웨이브를 늘리지 않는 쪽으로 예산을 맞춘다.
 *
 * 대가는 OpenAI images 분당 제한(429) 위험 상승이다. 봉쇄 장치는 두 겹:
 * imageGen 의 IMAGE_MAX_RETRIES 백오프, 그리고 실패 블록만 텍스트로 강등하는 detailJob 의 경로.
 * 실사용에서 429가 반복되면 이 값만 5로 내린다 — 캡은 6으로 두고 budget.ts 가 2웨이브를 흡수한다.
 */
export const IMAGE_CONCURRENCY = 6;

export interface OutputProfile {
  /** 출력 폭(px) */
  width: number;
  /** 몰 업로드용 분할 1장의 높이(px) */
  sliceHeight: number;
  /** JPEG 품질 기준값 */
  quality: number;
  /** 분할 장수 상한 */
  maxSlices: number;
  /** 분할 1장의 바이트 상한 — 초과 시 품질을 낮춰 재인코딩 */
  maxBytesPerSlice: number;
  /** 화면에 그대로 쓰는 안내 문구 */
  note: string;
}

/**
 * 플랫폼별 출력 프로파일.
 * 라쿠텐: R-Cabinet 1장 최대 3840px·2MB, 스마트폰 상품페이지 이미지 최대 20장.
 * Qoo10 : 모바일 폭 800px 전후(최대 820), 추가 이미지 최대 50장.
 * 아마존: A+ 모듈 폭 970px, 1장당 2MB. v1은 자유 분할, 모듈 정합은 v2.
 */
const PROFILES: Record<Platform, OutputProfile> = {
  'rakuten-official': {
    width: 1200,
    sliceHeight: 1500,
    quality: 88,
    maxSlices: 20,
    maxBytesPerSlice: 2 * 1024 * 1024,
    note: '라쿠텐은 이미지 1장당 3840px·2MB 제한이라, 분할본을 R-Cabinet에 올립니다.',
  },
  'rakuten-reseller': {
    width: 1200,
    sliceHeight: 1500,
    quality: 88,
    maxSlices: 20,
    maxBytesPerSlice: 2 * 1024 * 1024,
    note: '라쿠텐은 이미지 1장당 3840px·2MB 제한이라, 분할본을 R-Cabinet에 올립니다.',
  },
  qoo10: {
    width: 800,
    sliceHeight: 2000,
    quality: 85,
    maxSlices: 10,
    maxBytesPerSlice: 2 * 1024 * 1024,
    note: 'Qoo10은 사용자 대부분이 모바일 앱이라 폭 800px로 맞춥니다.',
  },
  'amazon-jp': {
    width: 970,
    sliceHeight: 1200,
    quality: 88,
    maxSlices: 12,
    maxBytesPerSlice: 2 * 1024 * 1024,
    note: 'A+ 콘텐츠는 모듈 폭 970px입니다. 프로모션·가격 블록은 규정상 넣지 않습니다.',
  },
  unset: {
    width: 1200,
    sliceHeight: 1500,
    quality: 88,
    maxSlices: 20,
    maxBytesPerSlice: 2 * 1024 * 1024,
    note: '플랫폼을 고르면 그 몰 규격에 맞춰 분할합니다.',
  },
};

/** 플랫폼별 출력 프로파일 조회 — 미지 플랫폼은 unset 기본값. */
export function outputProfile(platform: Platform): OutputProfile {
  return PROFILES[platform] ?? PROFILES.unset;
}

/** 프로모 레이어를 넣을 수 있는 플랫폼인가 — A+ 콘텐츠는 가격·프로모션 표기가 규정상 금지. */
export function allowsPromoLayer(platform: Platform): boolean {
  return platform !== 'amazon-jp';
}
