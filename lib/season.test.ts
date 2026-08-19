/**
 * 시즌 이벤트 헬퍼 단위 테스트 — 결정성·임박순·진행 중 판정 + 월별 조회·추천.
 * 러너: node:test (네이티브 의존 없음). 실행: npm run test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eventsInMonth, nextMegawari, seasonRecommendations, upcomingEvents } from './season';

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
    const evs = upcomingEvents(now, 7);
    for (let i = 1; i < evs.length; i++) {
      assert.ok(evs[i - 1].dDay <= evs[i].dDay, `${evs[i - 1].id} → ${evs[i].id} 임박순 위반`);
    }
  });

  it('진행 중 기간형은 dDay 0·inProgress=true', () => {
    // 가을 신색(7/21~9/30)은 7/23에 진행 중
    const autumn = upcomingEvents(now, 7).find((e) => e.id === 'autumn-shade');
    assert.ok(autumn, '가을 신색이 목록에 있어야 한다');
    assert.equal(autumn.inProgress, true);
    assert.equal(autumn.dDay, 0);
  });

  it('아직 시작 전 이벤트는 남은 일수를 센다', () => {
    // 9월 메가와리(9/1)는 7/23 기준 40일 뒤
    const mega = upcomingEvents(now, 7).find((e) => e.id === 'megawari-9');
    assert.ok(mega);
    assert.equal(mega.inProgress, false);
    assert.equal(mega.dDay, 40);
  });

  it('이미 지난 이벤트는 내년 주기로 넘어간다', () => {
    // 3월 메가와리는 7/23 기준 이미 지났으므로 2027-03-01 까지를 센다
    const mega3 = upcomingEvents(now, 7).find((e) => e.id === 'megawari-3');
    assert.ok(mega3);
    assert.ok(mega3.dDay > 200, `내년 주기여야 한다 — 실제 D-${mega3.dDay}`);
  });
});

describe('eventsInMonth', () => {
  it('해당 월에 걸치는 이벤트만 돌려준다', () => {
    const ids = eventsInMonth(2026, 9).map((e) => e.id);
    assert.ok(ids.includes('megawari-9'), '9월 메가와리 포함');
    assert.ok(ids.includes('autumn-shade'), '가을 신색(7/21~9/30) 걸침');
    assert.ok(ids.includes('xmas-coffret'), '크리스마스 코프레(8/20~10/31) 걸침');
    assert.ok(!ids.includes('megawari-3'), '3월 메가와리는 9월에 없다');
  });

  it('기간이 걸친 달 전부에서 같은 구간을 돌려준다(구간이 잘리지 않는다)', () => {
    const inAug = eventsInMonth(2026, 8).find((e) => e.id === 'xmas-coffret');
    const inOct = eventsInMonth(2026, 10).find((e) => e.id === 'xmas-coffret');
    assert.ok(inAug && inOct);
    assert.equal(inAug.startsAt, inOct.startsAt);
    assert.equal(inAug.endsAt, inOct.endsAt);
  });

  it('시점형은 시작=종료다', () => {
    const mega = eventsInMonth(2026, 11).find((e) => e.id === 'megawari-11');
    assert.ok(mega);
    assert.equal(mega.kind, 'point');
    assert.equal(mega.startsAt, mega.endsAt);
    assert.equal(mega.isMegawari, true);
  });

  it('시즌이 없는 달은 빈 배열이다', () => {
    // 1월·2월에는 정의된 이벤트가 없다
    assert.deepEqual(eventsInMonth(2026, 1), []);
  });

  it('연도가 달라도 같은 월 주기를 해석한다', () => {
    assert.equal(eventsInMonth(2027, 9).length, eventsInMonth(2026, 9).length);
  });
});

describe('nextMegawari', () => {
  it('가장 가까운 다음 메가와리를 고른다', () => {
    const r = nextMegawari(new Date(2026, 6, 23)); // 7/23 → 9/1
    assert.equal(r.id, 'megawari-9');
    assert.equal(r.dDay, 40);
  });

  it('연말에는 내년 3월로 넘어간다', () => {
    const r = nextMegawari(new Date(2026, 11, 10)); // 12/10 → 2027-03-01
    assert.equal(r.id, 'megawari-3');
    assert.ok(r.dDay > 0);
  });
});

describe('seasonRecommendations', () => {
  const now = new Date(2026, 6, 23);
  const ready = { hasReport: true, hasThumbnail: true, hasDetail: true };

  it('같은 입력 → 같은 결과(결정적)', () => {
    assert.deepEqual(seasonRecommendations(now, ready, 3), seasonRecommendations(now, ready, 3));
  });

  it('리포트가 없으면 진단 단계를 맨 앞에 세운다', () => {
    const [first] = seasonRecommendations(now, { hasReport: false, hasThumbnail: false, hasDetail: false }, 1);
    assert.equal(first.steps[0].axis, 'report');
    assert.match(first.steps[0].what, /진단/);
  });

  it('이미 만든 축의 단계는 뒤로 밀되 지우지 않는다', () => {
    const bare = seasonRecommendations(now, { hasReport: true, hasThumbnail: false, hasDetail: false }, 3);
    const withThumb = seasonRecommendations(now, { hasReport: true, hasThumbnail: true, hasDetail: false }, 3);
    for (let i = 0; i < bare.length; i++) {
      assert.equal(withThumb[i].steps.length, bare[i].steps.length, '항목 수가 줄면 안 된다');
    }
  });

  it('진행 중이거나 leadDays 안이면 urgent', () => {
    const recs = seasonRecommendations(now, ready, 7);
    const autumn = recs.find((r) => r.event.id === 'autumn-shade');
    assert.ok(autumn?.urgent, '진행 중은 urgent');
    const mega3 = recs.find((r) => r.event.id === 'megawari-3');
    if (mega3) assert.equal(mega3.urgent, false, '200일 넘게 남았으면 urgent 아님');
  });
});
