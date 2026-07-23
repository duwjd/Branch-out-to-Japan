/**
 * 이메일 입력 헬퍼(순수) — 형식 검증과 소문자 정규화.
 * 저장·조회·중복검사는 모두 정규화된 값으로 통일한다(대소문자·주변 공백 차이로 중복 계정 방지).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 공백 제거 + 소문자화 — 저장/조회 전 항상 이 값으로 통일한다 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 최소 형식(로컬@도메인.tld) 검증 — 상세 RFC 준수보다 오탈자 차단이 목적 */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
