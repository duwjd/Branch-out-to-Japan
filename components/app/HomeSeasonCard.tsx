import type { SeasonWindow, UpcomingEvent } from '@/lib/season';
import { HomeCard } from '@/components/app/homeUi';

/**
 * 홈 시즌 카드(MAIN-12) — "언제까지"를 맡는다. 다음 단계 카드 옆에 나란히 선다.
 *
 * 2026-08-20 판은 D-day 를 100px 로 세웠고, 2026-11-24 1차 개편은 반대로 한 줄 문장과 행 목록으로
 * 낮췄다. 둘 다 "앞으로 몇 달이 어떻게 생겼나"는 보여 주지 못했다. 그래서 가장 가까운 시즌의 D-day 를
 * 카드 안에서 가장 큰 숫자로 두되(화면 전체에서는 2단), 그 아래에 **6개월 타임라인**을 그린다 —
 * 메가와리는 점, 기간형 시즌은 막대, 착수 권장 구간은 옅은 띠. 위치는 전부 날짜에서 계산한다
 * (`lib/season.ts seasonWindow`). 조회 전용이다: 예약·발행·알림 없음(금지 포지션).
 */

/** 0~1 비율 → CSS 퍼센트 */
function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

/** D-day 글자 — 색만으로 읽히지 않게 상태를 글자·기호로 적는다 */
function dDayText(e: { dDay: number; inProgress: boolean }): string {
  if (e.inProgress) return '진행 중 △';
  return e.dDay === 0 ? '오늘 시작' : `D-${e.dDay}`;
}

/** 6개월 타임라인 — 그림은 aria-hidden 이고 같은 내용을 sr-only 문장과 아래 목록이 글자로 전한다 */
function SeasonTimeline({ win, focusId }: { win: SeasonWindow; focusId: string }) {
  const focus = win.spans.find((s) => s.id === focusId) ?? null;
  const periods = win.spans.filter((s) => s.kind === 'period');
  const points = win.spans.filter((s) => s.kind === 'point');
  // 왼쪽 끝 "오늘" 라벨·오른쪽 끝과 겹치는 월 라벨은 뺀다
  const monthLabels = win.months.filter((m) => m.ratio > 0.1 && m.ratio < 0.94);

  return (
    <div className="mt-6">
      <p className="sr-only">
        앞으로 {Math.round(win.days / 30)}개월 안의 시즌: {win.spans.map((s) => s.name).join(', ') || '없음'}
      </p>

      <div aria-hidden className="relative h-10">
        {win.months.map((m) => (
          <span key={m.label} className="absolute top-0 bottom-0 w-px bg-n-150" style={{ left: pct(m.ratio) }} />
        ))}
        <span className="absolute inset-x-0 top-1/2 h-px bg-n-200" />

        {/* 착수 권장 구간 — 앞세운 시즌이 아직 시작 전일 때만 */}
        {focus && focus.startRatio > focus.leadRatio && (
          <span
            className="absolute top-2 bottom-2 rounded-[4px] bg-coral-tint"
            style={{ left: pct(focus.leadRatio), width: pct(focus.startRatio - focus.leadRatio) }}
          />
        )}

        {periods.map((s) => (
          <span
            key={`${s.id}-${s.startRatio}`}
            className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${s.id === focusId ? 'bg-bar-mid' : 'bg-bar-light'}`}
            style={{ left: pct(s.startRatio), width: pct(Math.max(s.endRatio - s.startRatio, 0.015)) }}
          />
        ))}

        {points.map((s) => (
          <span
            key={`${s.id}-${s.startRatio}`}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-coral ring-2 ring-canvas ${
              s.id === focusId ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'
            }`}
            style={{ left: pct(s.startRatio) }}
          />
        ))}

        <span className="absolute top-0 bottom-0 left-0 w-0.5 rounded-full bg-ink" />
      </div>

      <div aria-hidden className="relative mt-1.5 h-4 text-[11px] text-ink-mute">
        <span className="absolute left-0 font-bold text-ink">오늘</span>
        {monthLabels.map((m) => (
          <span key={m.label} className="absolute pl-1.5" style={{ left: pct(m.ratio) }}>
            {m.label}
          </span>
        ))}
      </div>

      <p aria-hidden className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-ink-mute">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-coral" />
          메가와리
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-bar-light" />
          기간형 시즌
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[3px] bg-coral-tint ring-1 ring-coral/20" />
          준비 구간
        </span>
      </p>
    </div>
  );
}

/**
 * 시즌 카드 본체.
 * @param focus 홈이 앞세운 시즌 1건(`seasonFocus`)
 * @param inLeadWindow 착수 구간 안 — D-day 를 코랄로 올린다
 * @param leadDays 착수 권장 일수 — 아직 멀 때 "준비는 D-30부터"
 * @param win 오늘부터 6개월 창(`seasonWindow`)
 * @param next 그다음 시즌들(앞세운 시즌 제외, 임박순)
 */
export function HomeSeasonCard({
  focus,
  inLeadWindow,
  leadDays,
  win,
  next,
  urgentIds,
}: {
  focus: UpcomingEvent;
  inLeadWindow: boolean;
  leadDays: number;
  win: SeasonWindow;
  next: UpcomingEvent[];
  urgentIds: ReadonlySet<string>;
}) {
  const hint = focus.inProgress
    ? '시즌이 진행 중이에요'
    : inLeadWindow
      ? '지금 준비를 시작할 시점이에요'
      : `준비는 D-${leadDays}부터`;

  return (
    <HomeCard
      title="다가오는 시즌"
      titleId="season-t"
      action={{ href: '/app/season', label: '시즌 캘린더 →' }}
      className="h-full"
    >
      <p className="mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span
          className={`tnum text-[28px] leading-none font-extrabold tracking-[-0.03em] ${
            focus.inProgress ? 'text-amber-text' : inLeadWindow ? 'text-coral-strong' : 'text-ink'
          }`}
        >
          {dDayText(focus)}
        </span>
        <span className="text-[16px] font-bold text-ink">{focus.name}</span>
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">
        {focus.when}
        <span aria-hidden className="mx-1.5 text-ink-ghost">
          ·
        </span>
        <span className={inLeadWindow ? 'font-bold text-coral-strong' : ''}>{hint}</span>
      </p>

      <SeasonTimeline win={win} focusId={focus.id} />

      {next.length > 0 && (
        <ul className="mt-auto list-none p-0 pt-5">
          {next.map((e) => {
            const chipTone = e.inProgress
              ? 'bg-amber-bg text-amber-text'
              : urgentIds.has(e.id)
                ? 'bg-coral-tint text-coral-strong'
                : 'bg-n-150 text-ink-mute';
            return (
              <li key={e.id} className="flex items-center gap-2.5 border-t border-n-150 py-2.5 last:pb-0">
                <span
                  className={`tnum inline-flex h-[22px] flex-none items-center rounded-full px-2.5 text-[11.5px] font-bold ${chipTone}`}
                >
                  {dDayText(e)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{e.name}</span>
                <span className="flex-none text-[12px] text-ink-mute">{e.when.split(' · ')[0]}</span>
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}
