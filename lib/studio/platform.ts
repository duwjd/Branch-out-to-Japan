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

/** 생성중 단계 → 고객어(② RESULT-06 5종 축약 — analyze가 분석+카피 재설계를 겸한다) */
export const STUDIO_STAGE_LABELS: Record<string, string> = {
  analyze: '원본 분석 · 일본 고객 관점으로 카피 재설계 중',
  assemble: '프롬프트 조립 중',
  generate: '썸네일 생성 중',
  gate: '검수 게이트 확인 중',
};
