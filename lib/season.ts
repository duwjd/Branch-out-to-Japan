/**
 * 시즌 캘린더 데이터 정본 — 홈 위젯(⓪ MAIN-12)·시즌 캘린더 화면(SEASON-01~03)이 함께 쓴다.
 *
 * "지금 무엇을 준비할지"만 다루는 조회 데이터다. 예약·발행·알림 기능은 이 모듈로 만들지 않는다
 * (SNS 예약 발행툴은 금지 포지션 — docs/00-positioning.md).
 *
 * 2026-08-19 개편: 시즌 캘린더가 별도 화면(`/app/season`)으로 독립하면서
 *  ① `SEASON_EVENTS` 를 export 해 화면이 좌표를 다시 하드코딩하지 않게 하고
 *  ② 메가와리를 연 4회(3·6·9·11월) 전부 넣어 어느 달로 이동해도 시즌이 비지 않게 하고
 *  ③ 이벤트별 준비 항목(`prepSteps`)과 착수 시점(`leadDays`)을 데이터로 내려 추천을 규칙으로 만든다.
 * 근거: research/beautyContent/일본_뷰티_인스타그램_컨텐츠_마케팅_리서치.md §11.
 */

const MS_DAY = 86_400_000;

/** 시즌 준비 항목 1건 — 추천 패널의 체크리스트 줄이 된다 */
export interface SeasonPrepStep {
  /** 무엇을 준비하는가 */
  what: string;
  /** 왜 지금인가(일본 구매 관례 근거) */
  why: string;
  /** 이어지는 축 — 있으면 해당 화면으로 가는 링크를 그린다 */
  axis?: 'report' | 'thumbnail' | 'detail';
}

/** 시즌 이벤트 정의 — 월/일 기준(연도는 조회 함수가 now로 해석) */
export interface SeasonEventDef {
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
  /** 시작 이 일수 안으로 들어오면 "지금 착수할 시점"으로 본다 */
  leadDays: number;
  /** 준비 항목 — 추천 패널이 체크리스트로 편다 */
  prepSteps: SeasonPrepStep[];
}

/**
 * 일본 뷰티 시즌 이벤트 — 메가와리 3·6·9·11월 · 크리스마스 코프레 · UV 상전 · 가을 신색.
 * 정의 순서는 dDay 동률일 때의 표기 순서가 된다(정렬이 안정 정렬이므로).
 */
export const SEASON_EVENTS: SeasonEventDef[] = [
  {
    id: 'uv-shift',
    name: 'UV 상전',
    kind: 'period',
    from: [4, 1],
    to: [7, 31],
    when: '4월 ~ 7월 말 · 기간형',
    prep: '선케어 상세·톤업 소구를 일본 자외선 관례어로 다듬을 시점',
    leadDays: 45,
    prepSteps: [
      {
        what: 'SPF·PA 표기를 일본 표기 관례로 맞춘다',
        why: '일본 상세는 SPF50+/PA++++ 를 스펙 표가 아니라 첫 화면에서 읽게 둔다',
        axis: 'detail',
      },
      {
        what: '톤업·화장 밀림 소구를 일본 고민 어휘로 바꾼다',
        why: '「白浮き」「化粧崩れ」가 검색·리뷰에서 실제로 쓰이는 말이다',
        axis: 'report',
      },
      {
        what: '질감컷(밀림 없는 마무리)을 썸네일 1장으로 뽑는다',
        why: '선케어는 발림성 판단이 구매 직전 확인 지점이다',
        axis: 'thumbnail',
      },
    ],
  },
  {
    id: 'autumn-shade',
    name: '가을 신색',
    kind: 'period',
    from: [7, 21],
    to: [9, 30],
    when: '7월 하순 ~ 9월 · 기간형',
    prep: '색조 신제품 컷과 발색 표현을 미리 정리할 시점',
    leadDays: 45,
    prepSteps: [
      {
        what: '컬러칩·발색 스와치를 색 이름과 함께 정리한다',
        why: '일본 색조 상세는 색 이름·퍼스널컬러 축을 먼저 보여준다',
        axis: 'detail',
      },
      {
        what: '퍼스널컬러(イエベ·ブルベ) 축으로 색을 나눠 적는다',
        why: '가을 신색은 퍼스널컬러 검색과 함께 소비된다',
        axis: 'report',
      },
    ],
  },
  {
    id: 'xmas-coffret',
    name: '크리스마스 코프레 정보 해금',
    kind: 'period',
    from: [8, 20],
    to: [10, 31],
    when: '8월 하순 해금 → 10월 하순 발매 · 기간형',
    prep: '한정 세트 구성과 数量限定 표기를 확정할 시점',
    leadDays: 60,
    prepSteps: [
      {
        what: '세트 구성과 수량 한정 표기를 확정한다',
        why: '「数量限定」은 실제 수량 근거가 있을 때만 쓸 수 있는 표기다',
        axis: 'detail',
      },
      {
        what: '선물 소구(누구에게·왜)를 카피로 정리한다',
        why: '코프레는 본인용보다 기프트 문맥에서 먼저 검색된다',
        axis: 'report',
      },
      {
        what: '세트 전체가 한 컷에 보이는 썸네일을 만든다',
        why: '한정 세트는 구성이 한눈에 보여야 비교 대상에 오른다',
        axis: 'thumbnail',
      },
    ],
  },
  {
    id: 'megawari-3',
    name: '3월 메가와리',
    kind: 'point',
    from: [3, 1],
    when: '3월 초 · 시점형',
    prep: '신학기·환절기 소구와 세트 가격 문구를 준비하는 시기',
    leadDays: 30,
    prepSteps: [
      {
        what: '세트 가격·쿠폰 문구를 일본 구매 관례어로 쓴다',
        why: '메가와리는 가격 비교가 먼저다 — 할인율보다 실구매가 표기가 읽힌다',
        axis: 'thumbnail',
      },
      {
        what: '환절기 고민(건조·트러블)로 소구를 다시 잡는다',
        why: '3월은 환절기 피부 고민 검색이 오르는 구간이다',
        axis: 'report',
      },
    ],
  },
  {
    id: 'megawari-6',
    name: '6월 메가와리',
    kind: 'point',
    from: [6, 1],
    when: '6월 초 · 시점형',
    prep: '장마철·자외선 소구와 세트 가격 문구를 준비하는 시기',
    leadDays: 30,
    prepSteps: [
      {
        what: '세트 가격·쿠폰 문구를 일본 구매 관례어로 쓴다',
        why: '메가와리는 가격 비교가 먼저다 — 할인율보다 실구매가 표기가 읽힌다',
        axis: 'thumbnail',
      },
      {
        what: '장마철 습도·번들거림 소구를 정리한다',
        why: '6월은 「テカリ」「べたつき」 검색이 오르는 구간이다',
        axis: 'report',
      },
    ],
  },
  {
    id: 'megawari-9',
    name: '9월 메가와리',
    kind: 'point',
    from: [9, 1],
    when: '9월 초 · 시점형',
    prep: '프로모션 강조형 썸네일과 세트 가격 문구를 준비하는 시기',
    leadDays: 30,
    prepSteps: [
      {
        what: '프로모션 강조형 썸네일을 만든다',
        why: '메가와리 기간에는 목록 화면에서 가격·특전이 먼저 비교된다',
        axis: 'thumbnail',
      },
      {
        what: '세트 구성·특전을 일본 구매 관례어로 다시 쓴다',
        why: '「まとめ買い」「おまけ」처럼 일본 쪽에서 실제로 쓰는 말이 따로 있다',
        axis: 'report',
      },
      {
        what: '통상가 취소선을 쓸 근거가 있는지 확인한다',
        why: '실판매 실적 없는 통상가 병기는 有利誤認에 해당한다',
        axis: 'detail',
      },
    ],
  },
  {
    id: 'megawari-11',
    name: '11월 메가와리',
    kind: 'point',
    from: [11, 1],
    when: '11월 초 · 시점형',
    prep: '연말 세트·기프트 소구를 일본 구매 관례어로 준비할 시점',
    leadDays: 30,
    prepSteps: [
      {
        what: '연말 기프트 세트 구성을 정리한다',
        why: '11월 메가와리는 연말 선물 수요와 겹친다',
        axis: 'detail',
      },
      {
        what: '기프트 소구 썸네일을 준비한다',
        why: '선물 문맥은 본인용과 첫 컷 문법이 다르다',
        axis: 'thumbnail',
      },
    ],
  },
];

/** 메가와리 이벤트만 추린 id 집합 — 화면이 노드를 강조할 때 쓴다 */
const MEGAWARI_IDS = new Set(['megawari-3', 'megawari-6', 'megawari-9', 'megawari-11']);

/** 로컬 자정 기준 타임스탬프 */
function at(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getTime();
}

/**
 * now가 속한 날의 로컬 자정 — 시즌 판정은 전부 이 값으로 한다.
 * 시각(nowT)으로 비교하면 ① 이벤트 당일 오전에 이미 "지났다"고 판정돼 다음 해 주기로 넘어가고
 * (9월 1일에 9월 메가와리가 D-365로 표기되던 문제) ② 같은 날에도 몇 시에 보느냐에 따라
 * D-day가 흔들린다. 날 단위로 끊어 두 가지를 함께 없앤다.
 */
function startOfDay(now: Date): number {
  return at(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** 그 해 주기로 해석한 이벤트 구간 */
function resolveIn(e: SeasonEventDef, year: number): { startsAt: number; endsAt: number } {
  const startsAt = at(year, e.from[0], e.from[1]);
  const endsAt = e.to ? at(year, e.to[0], e.to[1]) : startsAt;
  return { startsAt, endsAt };
}

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
  const todayT = startOfDay(now);

  return SEASON_EVENTS.map((e) => {
    // 종료(시점형은 시작)가 이미 지났으면 내년 주기로 이동 — 당일은 아직 지난 게 아니다
    const thisYear = resolveIn(e, year);
    const yr = thisYear.endsAt < todayT ? year + 1 : year;
    const { startsAt, endsAt } = resolveIn(e, yr);
    const inProgress = e.kind === 'period' && todayT >= startsAt && todayT <= endsAt;
    const dDayVal = inProgress ? 0 : Math.max(0, Math.ceil((startsAt - todayT) / MS_DAY));
    return { id: e.id, name: e.name, kind: e.kind, when: e.when, prep: e.prep, dDay: dDayVal, inProgress };
  })
    .sort((a, b) => a.dDay - b.dDay)
    .slice(0, limit);
}

/** 특정 연도 주기로 해석한 시즌 이벤트 — 캘린더 셀 렌더 입력 */
export interface ResolvedSeasonEvent {
  id: string;
  name: string;
  kind: 'period' | 'point';
  when: string;
  prep: string;
  /** 실제 시작 자정(ms) */
  startsAt: number;
  /** 실제 종료 자정(ms) — 시점형은 startsAt과 같다 */
  endsAt: number;
  /** 메가와리 계열인가 — 화면이 노드를 코랄로 강조한다 */
  isMegawari: boolean;
}

/**
 * 해당 월(1~12)에 하루라도 걸치는 시즌 이벤트를 실제 날짜로 해석해 돌려준다.
 * 앞뒤 해 주기까지 훑어 연말·연초를 넘나드는 구간도 놓치지 않는다.
 * 시작이 이른 순 → 기간이 긴 순으로 정렬해 캘린더 바가 위에서부터 안정적으로 쌓이게 한다.
 * @param year 대상 연도
 * @param month 대상 월(1~12)
 */
export function eventsInMonth(year: number, month: number): ResolvedSeasonEvent[] {
  const monthStart = at(year, month, 1);
  const monthEnd = new Date(year, month, 0).getTime(); // 다음 달 0일 = 이번 달 말일

  const out: ResolvedSeasonEvent[] = [];
  for (const e of SEASON_EVENTS) {
    for (const yr of [year - 1, year, year + 1]) {
      const { startsAt, endsAt } = resolveIn(e, yr);
      if (endsAt < monthStart || startsAt > monthEnd) continue;
      out.push({
        id: e.id,
        name: e.name,
        kind: e.kind,
        when: e.when,
        prep: e.prep,
        startsAt,
        endsAt,
        isMegawari: MEGAWARI_IDS.has(e.id),
      });
    }
  }
  const span = (e: ResolvedSeasonEvent): number => e.endsAt - e.startsAt;
  return out.sort((a, b) => a.startsAt - b.startsAt || span(b) - span(a));
}

/** 다음 메가와리 — 홈 KPI·라이브러리 제안 카드가 같은 값을 쓴다 */
export function nextMegawari(now: Date): { id: string; label: string; month: string; dDay: number } {
  const mega = SEASON_EVENTS.filter((e) => MEGAWARI_IDS.has(e.id));
  const year = now.getFullYear();
  const todayT = startOfDay(now);
  const resolved = mega
    .map((e) => {
      // 당일(D-0)은 아직 다음 메가와리다 — 오전에 다음 해 주기로 넘어가지 않게 자정 기준으로 본다
      const yr = resolveIn(e, year).startsAt < todayT ? year + 1 : year;
      return { id: e.id, label: e.name, month: `${e.from[0]}월`, startsAt: resolveIn(e, yr).startsAt };
    })
    .sort((a, b) => a.startsAt - b.startsAt);
  const next = resolved[0];
  return {
    id: next.id,
    label: next.label,
    month: next.month,
    dDay: Math.max(0, Math.ceil((next.startsAt - todayT) / MS_DAY)),
  };
}

/** 추천 계산에 쓰는 브랜드 준비 상태 — 자산 유무만 본다(수치·성과는 보지 않는다) */
export interface BrandReadiness {
  hasReport: boolean;
  hasThumbnail: boolean;
  hasDetail: boolean;
}

export interface SeasonRecommendation {
  event: UpcomingEvent;
  /** leadDays 안에 들어왔거나 진행 중 — 지금 착수할 시점 */
  urgent: boolean;
  steps: SeasonPrepStep[];
}

/**
 * 다가오는 시즌별 준비 추천 — 규칙 기반이다(LLM 호출 없음).
 * 이벤트가 정의한 `prepSteps` 를 그대로 쓰되, 브랜드가 아직 밟지 않은 단계를 앞에 세운다.
 * 없는 실적·수치를 만들어 내지 않는다 — 추천은 "무엇을 준비할지"까지만 말한다(증거 원칙).
 * @param now 기준 시각
 * @param ctx 브랜드가 이미 가진 자산 상태
 * @param limit 최대 건수(기본 3)
 */
export function seasonRecommendations(now: Date, ctx: BrandReadiness, limit = 3): SeasonRecommendation[] {
  const byId = new Map(SEASON_EVENTS.map((e) => [e.id, e]));

  return upcomingEvents(now, limit).map((event) => {
    const def = byId.get(event.id)!;
    const urgent = event.inProgress || event.dDay <= def.leadDays;

    // 진단이 없으면 시즌 카피의 재료 자체가 없다 — 어느 시즌이든 이게 먼저다
    const steps: SeasonPrepStep[] = ctx.hasReport
      ? [...def.prepSteps]
      : [
          {
            what: '먼저 진단으로 시즌 카피의 재료를 만든다',
            why: '재설계한 USP·구매 이유가 그대로 시즌 콘텐츠의 입력이 된다',
            axis: 'report' as const,
          },
          ...def.prepSteps,
        ];

    // 이미 만든 축은 뒤로 — 아직 안 만든 축을 위에 둔다(순서만 바꾸고 항목을 지우지 않는다)
    const done = (axis?: SeasonPrepStep['axis']): boolean =>
      (axis === 'thumbnail' && ctx.hasThumbnail) || (axis === 'detail' && ctx.hasDetail);
    const pending = steps.filter((s) => !done(s.axis));
    const already = steps.filter((s) => done(s.axis));

    return { event, urgent, steps: [...pending, ...already] };
  });
}

/**
 * 시즌 눈금 한 칸의 긴급도 — 색이 아니라 의미로 정의한다(면 색은 화면이 고른다).
 * 'now'   = 진행 중이거나 곧 시작 — 지금 손대는 시즌
 * 'prep'  = 이벤트별 착수 권장 구간(leadDays) 안 — 지금 준비를 시작할 시즌
 * 'later' = 아직 먼 시즌
 */
export type SeasonPhase = 'now' | 'prep' | 'later';

/** 진행 중이 아니어도 이 일수 안에 시작하면 'now'로 본다 */
const IMMINENT_DAYS = 7;

export interface SeasonRunwayStep {
  id: string;
  name: string;
  /** 시작까지 남은 일수(진행 중이면 0) */
  dDay: number;
  inProgress: boolean;
  phase: SeasonPhase;
}

/**
 * 홈 히어로 시즌 눈금 — 임박순 시즌 이벤트 N건에 긴급도를 매긴다(MAIN-03).
 * 전부 날짜만으로 결정된다 — 없는 진척·실적을 만들어 내지 않는다(증거 원칙).
 * @param now 기준 시각
 * @param limit 눈금 칸 수(기본 6)
 */
export function seasonRunway(now: Date, limit = 6): SeasonRunwayStep[] {
  const byId = new Map(SEASON_EVENTS.map((e) => [e.id, e]));

  return upcomingEvents(now, limit).map((e) => {
    const leadDays = byId.get(e.id)?.leadDays ?? 30;
    const phase: SeasonPhase = e.inProgress || e.dDay <= IMMINENT_DAYS ? 'now' : e.dDay <= leadDays ? 'prep' : 'later';
    return { id: e.id, name: e.name, dDay: e.dDay, inProgress: e.inProgress, phase };
  });
}
