/**
 * 인증 화면 공용 유틸 — 클라이언트 즉시 피드백용 최소 판정.
 * 최종 검증은 서버 API가 다시 수행하므로(계정 존재 비노출·정책 판정), 여기선 형식만 본다.
 */

/** 이메일 형식 최소 검증 — 빈 값·`@`·점 유무만 즉시 판단(서버가 재검증) */
export function isEmailish(value: string): boolean {
  return /.+@.+\..+/.test(value.trim());
}
