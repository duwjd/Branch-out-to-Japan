/**
 * 시즌 캘린더 상수 — 다음 메가와리 D-day는 사이드바 KPI·홈·라이브러리가 공유한다.
 * (일정 예약 도구가 아니라 "지금 무엇을 준비할지" 보는 조회 전용 데이터 — LIB-02 · ⓪ MAIN-12)
 */

export const NEXT_MEGAWARI = { label: '9월 메가와리', month: '9월', date: '2026-09-01' };

const MS_DAY = 86_400_000;

/** 대상 날짜까지 남은 일수(음수면 0) */
export function dDay(target: string): number {
  const diff = new Date(target).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / MS_DAY));
}

/** 시즌 이벤트 정의 — 월/일 기준(연도는 upcomingEvents가 now로 해석) */
interface SeasonEventDef {
  id: string;
  name: string;
  /** 'period' = 기간형(진행 중 가능) · 'point' = 시점형 */
  kind: 'period' | 'point';
  /** 시작(또는 시점) [월, 일] */
  from: [number, number];
  /** 종료 [월, 일] — period만 */
  to?: [number, number];
  /** 화면 표기용 기간 문구 */
  when: string;
  /** 준비 한 줄 */
  prep: string;
}

/**
 * 일본 뷰티 시즌 이벤트 — 메가와리 3·6·9·11월 · 크리스마스 코프레 · UV 상전 · 가을 신색.
 * 근거: research/beautyContent/일본_뷰티_인스타그램_컨텐츠_마케팅_리서치.md §11.
 * 라이브러리 시즌 타임라인(LIB-02)과 같은 좌표를 쓴다 — 조회 전용, 예약·발행 없음.
 */
const SEASON_EVENTS: SeasonEventDef[] = [
  {
    id: 'uv-shift',
    name: 'UV 상전',
    kind: 'period',
    from: [4, 1],
    to: [7, 31],
    when: '4월 ~ 7월 말 · 기간형',
    prep: '선케어 상세·톤업 소구를 일본 자외선 관례어로 다듬을 시점',
  },
  {
    id: 'autumn-shade',
    name: '가을 신색',
    kind: 'period',
    from: [7, 21],
    to: [9, 30],
    when: '7월 하순 ~ 9월 · 기간형',
    prep: '색조 신제품 컷과 발색 표현을 미리 정리할 시점',
  },
  {
    id: 'xmas-coffret',
    name: '크리스마스 코프레 정보 해금',
    kind: 'period',
    from: [8, 20],
    to: [10, 31],
    when: '8월 하순 해금 → 10월 하순 발매 · 기간형',
    prep: '한정 세트 구성과 数量限定 표기를 확정할 시점',
  },
  {
    id: 'megawari-9',
    name: '9월 메가와리',
    kind: 'point',
    from: [9, 1],
    when: '9월 초 · 시점형',
    prep: '프로모션 강조형 썸네일과 세트 가격 문구를 준비하는 시기',
  },
  {
    id: 'megawari-11',
    name: '11월 메가와리',
    kind: 'point',
    from: [11, 1],
    when: '11월 초 · 시점형',
    prep: '연말 세트·기프트 소구를 일본 구매 관례어로 준비할 시점',
  },
];

export interface UpcomingEvent {
  id: string;
  name: string;
  kind: 'period' | 'point';
  when: string;
  prep: string;
  /** 시작까지 남은 일수(진행 중이면 0) */
  dDay: number;
  /** 기간형이고 now가 구간 내면 true */
  inProgress: boolean;
}

/**
 * now 기준 다가오는 시즌 이벤트 — 임박순(dDay 오름차순, 진행 중이 앞) 정렬, 최대 limit건.
 * 이미 완전히 지난 이벤트는 다음 해 주기로 넘긴다. now를 인자로 받아 결정적이다(테스트 대상).
 * @param now 기준 시각
 * @param limit 최대 건수(기본 3)
 */
export function upcomingEvents(now: Date, limit = 3): UpcomingEvent[] {
  const year = now.getFullYear();
  const nowT = now.getTime();
  const at = (mo: number, d: number, yr: number): number => new Date(yr, mo - 1, d).getTime();

  return SEASON_EVENTS.map((e) => {
    // 종료(시점형은 시작)가 이미 지났으면 내년 주기로 이동
    const endThisYear = e.to ? at(e.to[0], e.to[1], year) : at(e.from[0], e.from[1], year);
    const yr = endThisYear < nowT ? year + 1 : year;
    const startT = at(e.from[0], e.from[1], yr);
    const endT = e.to ? at(e.to[0], e.to[1], yr) : startT;
    const inProgress = e.kind === 'period' && nowT >= startT && nowT <= endT;
    const dDayVal = inProgress ? 0 : Math.max(0, Math.ceil((startT - nowT) / MS_DAY));
    return { id: e.id, name: e.name, kind: e.kind, when: e.when, prep: e.prep, dDay: dDayVal, inProgress };
  })
    .sort((a, b) => a.dDay - b.dDay)
    .slice(0, limit);
}
