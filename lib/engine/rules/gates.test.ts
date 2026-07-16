/**
 * 게이트 규칙 단위 테스트 — 50자 하드 게이트 · 200자 소프트선 · URL 형식 (스펙 §3).
 * 러너: node:test. 실행: npm run test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HARD_GATE_CHARS, SOFT_LINE_CHARS, contentCharCount, contentGate, isValidHttpUrl } from './gates';

describe('contentCharCount', () => {
  it('공백을 제외하고 센다 — 스페이스·개행·탭 전부', () => {
    assert.equal(contentCharCount('가 나\n다\t라 '), 4);
    assert.equal(contentCharCount(''), 0);
    assert.equal(contentCharCount('   \n\t'), 0);
  });
});

describe('contentGate', () => {
  it('빈 입력은 empty', () => {
    assert.equal(contentGate(''), 'empty');
    assert.equal(contentGate('  \n '), 'empty');
  });

  it('50자 미만은 blocked (하드 게이트)', () => {
    assert.equal(contentGate('가'.repeat(HARD_GATE_CHARS - 1)), 'blocked');
    // 공백은 셈에서 빠진다 — 공백으로 50자를 채울 수 없다
    assert.equal(contentGate('가 '.repeat(HARD_GATE_CHARS - 1)), 'blocked');
  });

  it('경계값 — 정확히 50자는 limited, 정확히 200자는 ok', () => {
    assert.equal(contentGate('가'.repeat(HARD_GATE_CHARS)), 'limited');
    assert.equal(contentGate('가'.repeat(SOFT_LINE_CHARS - 1)), 'limited');
    assert.equal(contentGate('가'.repeat(SOFT_LINE_CHARS)), 'ok');
  });
});

describe('isValidHttpUrl', () => {
  it('http/https만 통과한다', () => {
    assert.equal(isValidHttpUrl('https://example.com/item'), true);
    assert.equal(isValidHttpUrl('http://example.com'), true);
    assert.equal(isValidHttpUrl('  https://example.com  '), true, '앞뒤 공백은 무시');
  });

  it('그 외 스킴·빈 값은 거부한다', () => {
    assert.equal(isValidHttpUrl(''), false);
    assert.equal(isValidHttpUrl('ftp://example.com'), false);
    assert.equal(isValidHttpUrl('example.com'), false);
    assert.equal(isValidHttpUrl('javascript:alert(1)'), false);
  });
});
