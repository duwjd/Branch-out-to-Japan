/**
 * 콘텐츠 게이트 규칙 — 단일 정의(스펙 §3 텍스트 길이 이중 기준).
 * 이전에는 50자 규칙이 폼(page.tsx)·라우트(route.ts)·정규화(normalize.ts) 세 곳에,
 * 200자 규칙이 두 곳에 중복돼 있었다 — 전부 여기를 부른다.
 *
 * ⚠ 폼('use client')에서도 import되므로 아무것도 import하지 않는 잎 노드로 유지할 것(node:fs 금지).
 */

/** 50자 = 하드 게이트: 미만이면 진단 자체를 차단(버튼 잠금 + 서버 400 + 파이프라인 재검증) */
export const HARD_GATE_CHARS = 50;

/** 200자 = 소프트 품질선: 미만이면 생성되나 "정밀도 제한" 배지(precisionLimited) */
export const SOFT_LINE_CHARS = 200;

/** 공백 제외 글자수 — 게이트 판정과 폼 카운터가 같은 셈법을 쓴다 */
export function contentCharCount(text: string): number {
  return text.replace(/\s/g, '').length;
}

/**
 * 텍스트 콘텐츠의 게이트 상태.
 * empty: 입력 없음 / blocked: 50자 미만(하드) / limited: 50~199자(소프트) / ok: 200자 이상
 */
export function contentGate(text: string): 'empty' | 'blocked' | 'limited' | 'ok' {
  const count = contentCharCount(text);
  if (count === 0) return 'empty';
  if (count < HARD_GATE_CHARS) return 'blocked';
  if (count < SOFT_LINE_CHARS) return 'limited';
  return 'ok';
}

/** http(s) URL 형식 검증 — 폼 버튼 잠금과 서버 400이 같은 규칙을 쓴다 */
export function isValidHttpUrl(url: string): boolean {
  return /^https?:\/\//.test(url.trim());
}
