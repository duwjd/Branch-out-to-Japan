/**
 * 플랫폼·단계 라벨 — 클라이언트 안전 잎 노드(fs 미사용). promptPack이 재수출한다.
 * 폼('use client')과 서버 조립이 같은 정의를 공유한다(positioning.ts 관례).
 */

export type Platform = 'unset' | 'amazon-jp' | 'rakuten-official' | 'rakuten-reseller' | 'qoo10';

export const PLATFORM_LABELS: Record<Platform, string> = {
  unset: '미정',
  'amazon-jp': '아마존JP',
  'rakuten-official': '라쿠텐 공식샵',
  'rakuten-reseller': '라쿠텐 리셀러',
  qoo10: 'Qoo10',
};

export const PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];

/**
 * 생성중 단계 → 고객어(② RESULT-06). analyze 는 분석과 카피 재설계를 겸하지만,
 * 라벨에는 "분석"만 남긴다 — 재설계 중이라는 사실은 결과 화면 코랄 서브라인이 말한다.
 */
export const STUDIO_STAGE_LABELS: Record<string, string> = {
  analyze: '원본 이미지를 분석하는 중',
  assemble: '프롬프트 조립 중',
  generate: '썸네일 생성 중',
  gate: '검수 게이트 확인 중',
};

/**
 * 상세페이지 생성 단계 → 고객어(② DETAIL RESULT-D06).
 * 썸네일과 달리 blocks 단계가 길어 진행률(blockDone/blockTotal)을 함께 표시한다.
 */
export const DETAIL_STAGE_LABELS: Record<string, string> = {
  analyze: '원본·브랜드 자산 분석 중',
  plan: '상세페이지 구성 설계 중',
  copy: '일본 고객 관점으로 카피 재설계 중',
  blocks: '블록 이미지 생성 중',
  compose: '세로로 이어붙이는 중',
  slice: '몰 업로드용 분할 중',
  gate: '검수 게이트 확인 중',
};
