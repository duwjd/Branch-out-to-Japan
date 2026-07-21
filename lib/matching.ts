/**
 * 기업 매칭 상수 — 폼('use client')과 서버 검증이 공유하는 잎 노드(positioning.ts 관례).
 * 파트너 유형은 service-wireframe §③ 유형 계승 + 기타(MATCH-02b).
 */

export const PARTNER_TYPES = ['유통·리테일', '물류·풀필먼트', 'PR·마케팅', '기타'] as const;

export const MATCH_CHANNELS = [
  { value: 'qoo10', label: 'Qoo10' },
  { value: 'rakuten', label: '라쿠텐' },
  { value: 'amazon-jp', label: '아마존JP' },
  { value: 'undecided', label: '미정' },
] as const;

export const MATCH_TIMINGS = ['3개월 이내', '6개월 이내', '1년 이내', '미정'] as const;
