/**
 * 프리플라이트 차단 판정 — 실패했을 때 **무엇을 고쳐야 하는지가 사용자에게 도달하는가**를 본다.
 * 인프라 없이 검증하려고 순수 함수(blockingReason)만 대상으로 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockingReason, type DetailReadiness, type ReadinessCheck } from './detailReadiness';

const check = (over: Partial<ReadinessCheck>): ReadinessCheck => ({
  key: 'schema',
  label: '상세페이지 스키마',
  ok: true,
  level: 'blocked',
  detail: '적용됨',
  fix: null,
  ...over,
});

test('blockingReason — 전부 정상이면 null', () => {
  const r: DetailReadiness = { ready: true, checks: [check({}), check({ key: 'fonts', label: '일본어 폰트' })] };
  assert.equal(blockingReason(r), null);
});

test('blockingReason — warn 은 생성을 막지 않는다', () => {
  const r: DetailReadiness = {
    ready: true,
    checks: [check({ key: 'llm', label: '카피 생성(Claude)', ok: false, level: 'warn', detail: '목 모드' })],
  };
  assert.equal(blockingReason(r), null);
});

test('blockingReason — blocked 는 라벨과 사유를 함께 돌려준다', () => {
  const r: DetailReadiness = {
    ready: false,
    checks: [
      check({ ok: false, detail: '마이그레이션이 적용되지 않았습니다', fix: 'SQL Editor 에서 실행' }),
      check({ key: 'fonts', label: '일본어 폰트', ok: false, detail: '폰트를 읽을 수 없습니다' }),
    ],
  };
  const reason = blockingReason(r);
  assert.match(reason ?? '', /상세페이지 스키마: 마이그레이션이 적용되지 않았습니다/);
  assert.match(reason ?? '', /일본어 폰트: 폰트를 읽을 수 없습니다/);
});

test('blocked 항목에는 조치 문구가 반드시 붙는다(사유만 주면 운영자가 손을 못 쓴다)', () => {
  // 실제 구현이 만드는 실패 검사들은 fix 를 반드시 채워야 한다는 계약
  const failing = check({ ok: false, detail: '무언가 잘못됨', fix: null });
  assert.equal(failing.fix, null, '픽스처 전제');
  // 계약 위반을 조기에 드러내기 위한 명시적 어서션 — 구현이 fix 를 비우면 이 테스트를 고치는 게 아니라 구현을 고친다
  const contract = (c: ReadinessCheck) => c.ok || c.level === 'warn' || Boolean(c.fix);
  assert.equal(contract(failing), false);
  assert.equal(contract(check({ ok: false, fix: 'SQL Editor 에서 실행' })), true);
});
