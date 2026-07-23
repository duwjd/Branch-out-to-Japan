/**
 * 시즌 이벤트 헬퍼 단위 테스트 — upcomingEvents 결정성·임박순·진행 중 판정.
 * 러너: node:test (네이티브 의존 없음). 실행: npm run test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { upcomingEvents } from './season';

describe('upcomingEvents', () => {
  const now = new Date(2026, 6, 23); // 2026-07-23 (로컬)

  it('같은 now → 같은 결과(결정적)', () => {
    assert.deepEqual(upcomingEvents(now, 3), upcomingEvents(now, 3));
  });

  it('limit 건수를 넘지 않는다', () => {
    assert.equal(upcomingEvents(now, 3).length, 3);
    assert.equal(upcomingEvents(now, 2).length, 2);
  });

  it('dDay 오름차순으로 정렬된다(임박순)', () => {
    const evs = upcomingEvents(now, 5);
    for (let i = 1; i < evs.length; i++) {
      assert.ok(evs[i - 1].dDay <= evs[i].dDay, `${evs[i - 1].id} → ${evs[i].id} 임박순 위반`);
    }
  });

  it('진행 중 기간형은 dDay 0·inProgress=true', () => {
    // 가을 신색(7/21~9/30)은 7/23에 진행 중
    const autumn = upcomingEvents(now, 5).find((e) => e.id === 'autumn-shade');
    assert.ok(autumn, '가을 신색이 목록에 있어야 한다');
    assert.equal(autumn.inProgress, true);
    assert.equal(autumn.dDay, 0);
  });

  it('아직 시작 전 이벤트는 남은 일수를 센다', () => {
    // 9월 메가와리(9/1)는 7/23 기준 40일 뒤
    const mega = upcomingEvents(now, 5).find((e) => e.id === 'megawari-9');
    assert.ok(mega);
    assert.equal(mega.inProgress, false);
    assert.equal(mega.dDay, 40);
  });
});
