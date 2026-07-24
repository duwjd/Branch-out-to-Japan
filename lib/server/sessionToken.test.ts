/**
 * sessionToken 단위 테스트 — sign→verify 라운드트립·서명 변조·만료·프리픽스·페이로드 위조.
 * 러너: node:test(네이티브 의존 없음). 실행: npm run test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signSession, verifySession, type SessionPayload } from './sessionToken';

describe('sessionToken', () => {
  const base: SessionPayload = { userId: 'user-1', provider: 'email', exp: Date.now() + 60_000 };

  it('sign→verify 라운드트립', () => {
    const token = signSession(base);
    assert.deepEqual(verifySession(token), base);
  });

  it('서명 변조 시 null', () => {
    const token = signSession(base);
    const last = token.at(-1);
    const tampered = token.slice(0, -1) + (last === 'a' ? 'b' : 'a'); // hex 유지, 값만 변경
    assert.equal(verifySession(tampered), null);
  });

  it('만료(exp 과거) 시 null', () => {
    const token = signSession({ ...base, exp: Date.now() - 1000 });
    assert.equal(verifySession(token), null);
  });

  it('v1. 프리픽스 없으면 null', () => {
    assert.equal(verifySession('kakao'), null);
    assert.equal(verifySession('v2.abc.def'), null);
    assert.equal(verifySession(''), null);
  });

  it('페이로드만 바꾸고 원 서명 재사용 시 null', () => {
    const token = signSession(base);
    const sig = token.split('.')[2];
    const forged = Buffer.from(JSON.stringify({ ...base, userId: 'attacker' })).toString('base64url');
    assert.equal(verifySession(`v1.${forged}.${sig}`), null);
  });
});
