/**
 * 이메일 인증·비밀번호 재설정 토큰 헬퍼(순수 — node:crypto만 사용).
 * 원문(raw)은 메일 링크로만 전달하고, 저장·조회는 sha256 해시(tokenHash)로만 한다
 * (DB 유출 시에도 원문 토큰을 역산할 수 없게). session/route가 공용으로 쓴다.
 */

import { randomBytes, createHash } from 'node:crypto';

/** raw 토큰의 sha256 hex — 저장·조회 키(consumeAuthToken 인자) */
export function hashAuthToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * 새 토큰 발급.
 * @returns raw(메일 링크용 · base64url 32바이트) + tokenHash(저장용 sha256 hex)
 */
export function generateAuthToken(): { raw: string; tokenHash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, tokenHash: hashAuthToken(raw) };
}
