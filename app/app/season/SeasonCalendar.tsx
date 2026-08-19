'use client';

/**
 * 시즌 캘린더 그리드(SEASON-02·03) — 월 이동 · 시즌 구간 표기 · 날짜/기간 메모.
 *
 * 조회와 기록만 한다. 예약·발행·알림은 만들지 않는다(금지 포지션 — docs/00-positioning.md).
 * 시즌 바·메모 바는 시각 레이어라 `aria-hidden` 이고, 스크린리더는 날짜 셀의 `aria-label`
 * 하나로 그 날의 시즌·메모를 모두 읽는다. 편집도 날짜 셀 → 날짜 모달 한 경로로만 들어간다
 * (절대 배치된 바에 포커스를 흩지 않기 위해서다).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { buttonClass, inputClass, textareaClass, fieldLabelClass } from '@/components/ui/primitives';
import { IconChevronLeft } from '@/components/ui/icons';

/** 직렬화된 시즌 이벤트 — 서버에서 ms 타임스탬프로 내려온다 */
export interface CalendarEvent {
  id: string;
  name: string;
  kind: 'period' | 'point';
  when: string;
  prep: string;
  startsAt: number;
  endsAt: number;
  isMegawari: boolean;
}

export interface CalendarMemo {
  id: string;
  startDate: string;
  endDate: string | null;
  body: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** 메모 본문 상한 — lib/server/seasonMemo.ts MEMO_MAX_LENGTH 와 같은 값 */
const MEMO_MAX_LENGTH = 300;

/**
 * 월 이동 아이콘 버튼 — 정사각이라 buttonClass 를 쓰지 않는다.
 * buttonClass('secondary','sm')는 `px-3.5`를 포함해서, 폭을 34px로 줄이면 좌우 패딩 28px가
 * 남아 아이콘이 4px로 눌린다(패딩 유틸리티는 클래스 나열 순서로 덮이지 않는다).
 */
const NAV_BTN =
  'inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-btn border border-border-strong bg-canvas text-ink no-underline transition-colors hover:bg-n-150 active:bg-n-200';

/** 로컬 기준 'YYYY-MM-DD' — toISOString()은 UTC로 밀려 하루가 어긋난다 */
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → 그 날 자정(로컬) */
function dayStart(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** "9월 12일 (토)" */
function labelOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

/** 한 주(7칸) 안의 바 하나 — 겹치지 않게 레인을 나눠 쌓는다 */
interface Bar {
  key: string;
  /** 0~6 */
  from: number;
  to: number;
  label: string;
  cls: string;
  lane: number;
}

/**
 * 비어 있는 첫 레인에 차례로 넣는다(그리디 구간 패킹).
 *
 * **입력 순서를 그대로 쓴다 — 주마다 다시 정렬하지 않는다.** 주 안의 좌표(시작 열·길이)로
 * 정렬하면 같은 이벤트가 주마다 다른 레인에 놓인다. 예를 들어 가을 신색이 월말에 잘리는 주에서는
 * 더 긴 크리스마스 코프레가 앞으로 와 두 바의 위아래가 뒤집힌다. 호출부가 넘기는 순서는
 * `eventsInMonth`의 시작일 순(이후 메모)이라 달 전체에서 일관된다.
 * @param bars lane 미할당 바 목록(표시 우선순위 순)
 */
function packLanes(bars: Omit<Bar, 'lane'>[]): Bar[] {
  const laneEnds: number[] = [];
  return bars.map((bar) => {
    let lane = laneEnds.findIndex((end) => end < bar.from);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = bar.to;
    return { ...bar, lane };
  });
}

export function SeasonCalendar({
  year,
  month,
  events,
  memos,
  todayIso,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  memos: CalendarMemo[];
  /** 서버 기준 오늘 — 클라이언트 시계와 어긋나 "오늘"이 두 곳에 찍히는 걸 막는다 */
  todayIso: string;
}) {
  const router = useRouter();
  const [openDay, setOpenDay] = useState<string | null>(null);

  // ── 월 그리드 좌표 ────────────────────────────────────────────────────────
  const first = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0).getDate();
  const leading = first.getDay(); // 그 달 1일이 놓일 요일 칸
  const cellCount = Math.ceil((leading + lastDate) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => new Date(year, month - 1, i - leading + 1));
  const weeks = Array.from({ length: cellCount / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const ym = (y: number, m: number) => `/app/season?ym=${y}-${String(m).padStart(2, '0')}`;

  /** 그 날짜에 걸치는 시즌 이벤트 */
  const eventsOn = (iso: string): CalendarEvent[] => {
    const t = dayStart(iso);
    return events.filter((e) => t >= e.startsAt && t <= e.endsAt);
  };
  /** 그 날짜에 걸치는 메모 */
  const memosOn = (iso: string): CalendarMemo[] => {
    const t = dayStart(iso);
    return memos.filter((m) => t >= dayStart(m.startDate) && t <= dayStart(m.endDate ?? m.startDate));
  };

  /** 한 주에 놓일 바 목록 — 시즌이 위, 메모가 아래 */
  function barsForWeek(week: Date[]): Bar[] {
    const from = week[0].getTime();
    const to = week[6].getTime();
    const colOf = (t: number): number =>
      Math.min(6, Math.max(0, Math.round((t - from) / 86_400_000)));

    const seasonBars = events
      .filter((e) => e.endsAt >= from && e.startsAt <= to)
      .map((e) => {
        const live = dayStart(todayIso) >= e.startsAt && dayStart(todayIso) <= e.endsAt;
        return {
          key: `e-${e.id}-${from}`,
          from: colOf(Math.max(e.startsAt, from)),
          to: colOf(Math.min(e.endsAt, to)),
          label: e.kind === 'point' ? `● ${e.name}` : live ? `${e.name} · 진행 중 △` : e.name,
          cls:
            e.kind === 'point'
              ? 'bg-coral text-white'
              : live
                ? 'border border-amber/45 bg-amber-bg text-amber-text'
                : 'border border-card-border bg-n-100 text-ink-mute',
        };
      });

    const memoBars = memos
      .filter((m) => dayStart(m.endDate ?? m.startDate) >= from && dayStart(m.startDate) <= to)
      .map((m) => ({
        key: `m-${m.id}-${from}`,
        from: colOf(Math.max(dayStart(m.startDate), from)),
        to: colOf(Math.min(dayStart(m.endDate ?? m.startDate), to)),
        label: `✎ ${m.body}`,
        cls: 'border border-coral/30 bg-coral-tint text-coral-strong',
      }));

    return packLanes([...seasonBars, ...memoBars]);
  }

  return (
    <>
      <section className="rounded-card border border-card-border bg-canvas p-5 shadow-card max-sm:p-3.5">
        {/* 월 이동(SEASON-02) */}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="tnum text-[17px] font-extrabold tracking-[-0.01em] text-ink">
            {year}년 {month}월
          </h2>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href={ym(prev.y, prev.m)} aria-label={`${prev.y}년 ${prev.m}월 보기`} className={NAV_BTN}>
              <IconChevronLeft size={18} />
            </Link>
            <Link href={ym(next.y, next.m)} aria-label={`${next.y}년 ${next.m}월 보기`} className={`${NAV_BTN} rotate-180`}>
              <IconChevronLeft size={18} />
            </Link>
            <Link href="/app/season" className={buttonClass('secondary', 'sm', 'no-underline')}>
              오늘
            </Link>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div role="grid" aria-label={`${year}년 ${month}월 시즌 캘린더`} className="min-w-[560px]">
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map((w, i) => (
                <span
                  key={w}
                  role="columnheader"
                  className={`pb-2 text-center text-[11.5px] font-bold ${
                    i === 0 ? 'text-danger-text' : i === 6 ? 'text-coral-strong' : 'text-ink-mute'
                  }`}
                >
                  {w}
                </span>
              ))}
            </div>

            {weeks.map((week) => {
              const bars = barsForWeek(week);
              const laneCount = bars.length === 0 ? 0 : Math.max(...bars.map((b) => b.lane)) + 1;
              return (
                <div key={week[0].toISOString()} role="row" className="relative grid grid-cols-7">
                  {week.map((d) => {
                    const iso = isoOf(d);
                    const inMonth = d.getMonth() === month - 1;
                    const isToday = iso === todayIso;
                    const dayEvents = eventsOn(iso);
                    const dayMemos = memosOn(iso);
                    const summary = [
                      ...dayEvents.map((e) => e.name),
                      ...dayMemos.map((m) => `메모 ${m.body}`),
                    ].join(', ');
                    return (
                      <button
                        key={iso}
                        type="button"
                        role="gridcell"
                        onClick={() => setOpenDay(iso)}
                        aria-label={`${labelOf(iso)}${summary ? ` — ${summary}` : ' — 등록된 시즌·메모 없음'}. 메모를 추가하거나 편집합니다`}
                        // flex-col/justify-start 로 고정 — 버튼은 UA 기본이 내용을 세로 가운데
                        // 정렬해서, 날짜 숫자가 셀 한가운데로 내려가 시즌 바와 겹친다
                        className={`flex min-h-[112px] cursor-pointer flex-col items-start justify-start border-t border-r border-hairline p-1.5 text-left transition-colors first:border-l hover:bg-n-50 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-coral ${
                          inMonth ? '' : 'bg-n-50/60'
                        }`}
                      >
                        <span
                          className={`tnum inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[12px] font-bold ${
                            isToday
                              ? 'bg-coral text-white'
                              : inMonth
                                ? 'text-ink'
                                : 'text-ink-faint'
                          }`}
                        >
                          {d.getDate()}
                        </span>
                      </button>
                    );
                  })}

                  {/* 시즌·메모 바 레이어 — 시각 표기 전용(정보는 셀 aria-label이 읽는다) */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-[30px] grid grid-cols-7 gap-x-1 gap-y-[3px] px-1"
                  >
                    {bars.map((b) => (
                      <span
                        key={b.key}
                        style={{ gridColumn: `${b.from + 1} / ${b.to + 2}`, gridRow: b.lane + 1 }}
                        className={`truncate rounded-full px-2 py-[2px] text-[10.5px] font-bold ${b.cls}`}
                      >
                        {b.label}
                      </span>
                    ))}
                    {/* 레인이 늘어도 날짜 숫자를 덮지 않도록 주 높이를 함께 밀어 준다 */}
                    {laneCount > 3 && <span className="col-span-7" style={{ gridRow: laneCount }} />}
                  </div>
                </div>
              );
            })}
            <div className="border-t border-hairline" />
          </div>
        </div>

        <p className="mt-3.5 text-[12px] text-ink-mute">
          날짜를 누르면 그날의 시즌과 메모를 보고, 메모를 추가할 수 있습니다.
        </p>
      </section>

      {openDay && (
        <DayModal
          iso={openDay}
          events={eventsOn(openDay)}
          memos={memosOn(openDay)}
          onClose={() => setOpenDay(null)}
          onSaved={() => {
            setOpenDay(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/** 날짜 모달(SEASON-03) — 그날의 시즌 조회 + 메모 추가·편집·삭제 */
function DayModal({
  iso,
  events,
  memos,
  onClose,
  onSaved,
}: {
  iso: string;
  events: CalendarEvent[];
  memos: CalendarMemo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<CalendarMemo | null>(null);
  const [startDate, setStartDate] = useState(iso);
  const [endDate, setEndDate] = useState('');
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 편집 대상을 폼에 싣는다 — 새 메모는 null로 초기화 */
  function loadForm(memo: CalendarMemo | null) {
    setEditing(memo);
    setStartDate(memo?.startDate ?? iso);
    setEndDate(memo?.endDate ?? '');
    setBody(memo?.body ?? '');
    setError(null);
  }

  /** 저장(생성·편집 공용) — 성공하면 호출부가 서버 데이터를 다시 읽는다 */
  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/season/memo/${editing.id}` : '/api/season/memo', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate: endDate || null, body }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '메모를 저장하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  /** 삭제 — 되돌릴 수 없어 확인 후 진행한다 */
  async function remove(id: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/season/memo/${id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? '메모를 삭제하지 못했습니다.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '메모를 삭제하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="season-day-title">
      <h2 id="season-day-title" className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">
        {labelOf(iso)}
      </h2>

      {events.length > 0 && (
        <section className="mt-4">
          <h3 className="text-[12px] font-bold text-ink-mute">이 날의 시즌</h3>
          <ul className="mt-2 flex list-none flex-col gap-2 p-0">
            {events.map((e) => (
              <li key={e.id} className="rounded-[10px] border border-card-border bg-n-50 p-3">
                <p className="text-[13px] font-bold text-ink">{e.name}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-mute">{e.when}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-body [text-wrap:pretty]">{e.prep}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {memos.length > 0 && (
        <section className="mt-4">
          <h3 className="text-[12px] font-bold text-ink-mute">이 날의 메모</h3>
          <ul className="mt-2 flex list-none flex-col gap-2 p-0">
            {memos.map((m) => (
              <li key={m.id} className="flex items-start gap-2 rounded-[10px] border border-coral/25 bg-coral-tint p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-relaxed break-words text-ink">{m.body}</p>
                  <p className="tnum mt-1 text-[11px] text-ink-mute">
                    {m.startDate}
                    {m.endDate ? ` ~ ${m.endDate}` : ''}
                  </p>
                </div>
                <div className="flex flex-none gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadForm(m)}
                    className={buttonClass('ghost', 'sm', 'px-2.5')}
                    disabled={pending}
                  >
                    편집
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className={buttonClass('ghost', 'sm', 'px-2.5 text-danger-text')}
                    disabled={pending}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5 border-t border-hairline pt-4">
        <h3 className="text-[12px] font-bold text-ink-mute">{editing ? '메모 편집' : '메모 추가'}</h3>
        <div className="mt-2.5 flex gap-3 max-sm:flex-col">
          <div className="flex-1">
            <label className={fieldLabelClass} htmlFor="memo-start">
              시작 날짜
            </label>
            <input
              id="memo-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className={fieldLabelClass} htmlFor="memo-end">
              종료 날짜 <span className="font-semibold text-ink-faint">(기간 메모일 때만)</span>
            </label>
            <input
              id="memo-end"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <label className={`${fieldLabelClass} mt-3`} htmlFor="memo-body">
          내용
        </label>
        <textarea
          id="memo-body"
          rows={3}
          maxLength={MEMO_MAX_LENGTH}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="예) 라쿠텐 메가와리 소재 마감 — 세트 가격 문구 확정"
          className={textareaClass}
        />

        {error && (
          <p role="alert" className="mt-2.5 text-[12.5px] font-semibold text-danger-text">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {editing && (
            <button type="button" onClick={() => loadForm(null)} className={buttonClass('ghost', 'md')} disabled={pending}>
              새 메모로
            </button>
          )}
          <button type="button" onClick={onClose} className={buttonClass('secondary', 'md')} disabled={pending}>
            닫기
          </button>
          <button type="button" onClick={save} className={buttonClass('primary', 'md')} disabled={pending || !body.trim()}>
            {pending ? '저장 중…' : editing ? '메모 수정' : '메모 저장'}
          </button>
        </div>
      </section>
    </Modal>
  );
}
