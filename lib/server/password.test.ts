/**
 * password 단위 테스트 — 해시→검증 라운드트립·틀린 비번·포맷 불량·salt 랜덤성·길이 경계.
 * 러너: node:test(네이티브 의존 없음). 실행: npm run test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, isValidPassword, PASSWORD_MIN } from './password';

describe('password', () => {
  it('해시→검증 라운드트립', () => {
    const stored = hashPassword('correct horse battery');
    assert.ok(stored.startsWith('scrypt$'), 'scrypt$ 프리픽스 포맷');
    assert.equal(verifyPassword('correct horse battery', stored), true);
  });

  it('틀린 비밀번호는 false', () => {
    const stored = hashPassword('correct horse battery');
    assert.equal(verifyPassword('wrong password', stored), false);
  });

  it('포맷 불량 stored는 false(예외 없이)', () => {
    assert.equal(verifyPassword('x', 'not-a-valid-hash'), false);
    assert.equal(verifyPassword('x', 'scrypt$abc'), false); // 파트 수 부족
    assert.equal(verifyPassword('x', 'bcrypt$00$11'), false); // 프리픽스 불일치
    assert.equal(verifyPassword('x', ''), false);
  });

  it('같은 비밀번호도 salt로 매번 다른 해시', () => {
    assert.notEqual(hashPassword('same-secret'), hashPassword('same-secret'));
  });

  it('isValidPassword 길이 경계(≥8)', () => {
    assert.equal(PASSWORD_MIN, 8);
    assert.equal(isValidPassword('1234567'), false);
    assert.equal(isValidPassword('12345678'), true);
  });
});
