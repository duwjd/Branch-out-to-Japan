/**
 * 비밀번호 해시(순수 모듈 — next 비의존, node:crypto만 사용).
 * scrypt 파생키 + 랜덤 salt로 저장 문자열 `"scrypt$<saltHex>$<hashHex>"`을 만든다.
 * 검증은 동일 파라미터로 다시 파생해 timingSafeEqual로 상수시간 비교한다.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** 비밀번호 최소 길이 — 폼·서버 이중 검증 공용 상수 */
export const PASSWORD_MIN = 8;

const SALT_LEN = 16; // salt 바이트 수
const KEY_LEN = 64; // 파생키 바이트 수

/** 길이 기준 유효성(≥PASSWORD_MIN) — 세부 규칙(대소문자·기호)은 아직 요구하지 않는다 */
export function isValidPassword(pw: string): boolean {
  return typeof pw === 'string' && pw.length >= PASSWORD_MIN;
}

/**
 * 평문 비밀번호를 저장 가능한 해시 문자열로 만든다.
 * @returns `"scrypt$<saltHex>$<hashHex>"` — salt는 매번 랜덤이라 같은 비밀번호도 결과가 다르다.
 */
export function hashPassword(pw: string): string {
  const salt = randomBytes(SALT_LEN);
  const derived = scryptSync(pw, salt, KEY_LEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * 평문 비밀번호가 저장된 해시와 일치하는지 검증한다.
 * 포맷 불량(파트 수·프리픽스·바이트 길이 불일치)은 즉시 false — 예외를 던지지 않는다.
 */
export function verifyPassword(pw: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  // 잘린 hex(홀수 자리 등)로 길이가 어긋나면 위조·손상으로 보고 거절
  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
  const derived = scryptSync(pw, salt, KEY_LEN);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
