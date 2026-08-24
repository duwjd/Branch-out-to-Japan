import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { eventsInMonth, nextMegawari, seasonRecommendations, type SeasonPrepStep } from '@/lib/season';
import { StatusBadge, buttonClass, cardClass } from '@/components/ui/primitives';
import { SeasonCalendar, type CalendarEvent, type CalendarMemo } from './SeasonCalendar';

/**
 * ③ 운영 · 시즌 캘린더(SEASON-00~04) — 일본 뷰티 시즌을 달력으로 보고, 준비할 것을 확인하는 화면.
 *
 * 2026-08-19 신설. 구 구조에서는 자산 라이브러리 상단의 타임라인 스트립(LIB-02)이었는데,
 * "자산을 다시 꺼내 보는 화면"과 "다음 시즌을 준비하는 화면"이 한 페이지에 섞여 둘 다 얕았다.
 * 별도 화면으로 떼면서 좌표 하드코딩도 없앴다 — 시즌 데이터 정본은 `lib/season.ts` 하나다.
 *
 * 서버 컴포넌트 + `?ym=YYYY-MM` 링크 전환(라이브러리 `?tab=` 과 같은 문법). 메모 CRUD만 클라이언트.
 * 예약·발행·알림 기능은 만들지 않는다(금지 포지션 — docs/00-positioning.md).
 * 디자인 정본: docs/specs/04-operations/04-operations-ui-기획서.md # 5
 */

/** 준비 항목이 이어지는 축 → 이동 링크. 없으면 링크를 그리지 않는다 */
const AXIS_LINK: Record<NonNullable<SeasonPrepStep['axis']>, { href: string; label: string }> = {
  report: { href: '/app/report/new', label: '진단으로' },
  thumbnail: { href: '/app/studio/thumbnail', label: '썸네일 만들기' },
  detail: { href: '/app/studio/detail', label: '상세페이지 만들기' },
};

/** `?ym=2026-09` → { year, month }. 형식이 어긋나면 오늘이 속한 달로 떨어진다 */
function parseYm(raw: string | undefined, today: Date): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(raw ?? '');
  if (!m) return { year: today.getFullYear(), month: today.getMonth() + 1 };
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  }
  return { year, month };
}

export default async function SeasonPage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const brand = await getActiveBrand();
  if (!brand) redirect('/app'); // 브랜드 미등록 → 홈 온보딩(브랜드 관리와 같은 규칙)

  const { ym } = await searchParams;
  const today = new Date();
  const { year, month } = parseYm(ym, today);

  const store = await getStore();
  const [memos, requests, assets] = await Promise.all([
    store.listSeasonMemos(brand.id),
    store.listRequests(brand.id),
    store.listAssets(brand.id),
  ]);

  // 추천 입력 — 자산 유무만 본다. 성과·수치는 보지 않는다(증거 원칙)
  const readiness = {
    hasReport: requests.some((r) => r.status === 'published'),
    hasThumbnail: assets.some((a) => a.kind !== 'detail' && a.status === 'done'),
    hasDetail: assets.some((a) => a.kind === 'detail' && a.status === 'done'),
  };

  const events: CalendarEvent[] = eventsInMonth(year, month);
  const calendarMemos: CalendarMemo[] = memos.map((m) => ({
    id: m.id,
    startDate: m.startDate,
    endDate: m.endDate,
    body: m.body,
  }));
  const recommendations = seasonRecommendations(today, readiness, 4);
  const megawari = nextMegawari(today);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] pb-24 max-sm:px-5">
        {/* 상단 영역(SEASON-01) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">YOAKE 운영</p>
          {store.kind() === 'file' && <StatusBadge tone="off">로컬 저장(dev)</StatusBadge>}
        </div>
        <h1 className="mt-2.5 text-[30px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
          시즌 캘린더
        </h1>
        <p className="mt-3.5 max-w-[640px] text-[15px] leading-[1.7] text-ink-body [text-wrap:pretty]">
          일본 뷰티 시즌을 달력으로 보고, 다음 시즌에 무엇을 어떤 말로 준비할지 확인하세요. 날짜와 기간에 메모를 남기면
          그대로 남습니다.
        </p>
        <p className="tnum mt-2.5 text-[13px] font-bold text-coral-strong">
          다음 메가와리 — {megawari.label} D-{megawari.dDay}
        </p>

        <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* 캘린더(SEASON-02·03) */}
          <SeasonCalendar year={year} month={month} events={events} memos={calendarMemos} todayIso={todayIso} />

          {/* 준비 추천(SEASON-04) — 규칙 기반. 실적·성과 수치는 만들지 않는다 */}
          <section className={cardClass('p-6 max-sm:p-5')} aria-labelledby="season-reco">
            <h2 id="season-reco" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
              다가오는 시즌 준비
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">
              시즌이 가까워지면 무엇부터 손대야 하는지 순서대로 보여줍니다.
            </p>

            <ul className="mt-4 flex list-none flex-col gap-3.5 p-0">
              {recommendations.map(({ event, urgent, steps }) => (
                <li
                  key={event.id}
                  className={`rounded-[12px] border p-4 ${
                    urgent ? 'border-coral/35 bg-coral-tint/45' : 'border-card-border bg-n-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex h-[21px] items-center rounded-full px-2.5 text-[11px] font-bold ${
                        event.inProgress
                          ? 'bg-amber-bg text-amber-text'
                          : urgent
                            ? 'bg-coral text-white'
                            : 'bg-n-150 text-ink-mute'
                      }`}
                    >
                      {event.inProgress ? '진행 중 △' : `D-${event.dDay}`}
                    </span>
                    <h3 className="text-[13.5px] font-extrabold text-ink">{event.name}</h3>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-ink-mute">{event.when}</p>

                  <ol className="mt-3 flex list-none flex-col gap-2.5 p-0">
                    {steps.map((s, i) => {
                      const link = s.axis ? AXIS_LINK[s.axis] : null;
                      return (
                        <li key={`${event.id}-${i}`} className="flex items-start gap-2">
                          <span
                            aria-hidden
                            className="mt-px inline-flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] bg-canvas text-[10px] font-extrabold text-coral-strong"
                          >
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12.5px] leading-snug font-bold text-ink [text-wrap:pretty]">{s.what}</p>
                            <p className="mt-0.5 text-[11.5px] leading-snug text-ink-mute [text-wrap:pretty]">
                              {s.why}
                            </p>
                            {link && (
                              <Link
                                href={link.href}
                                className="mt-1 inline-block text-[11.5px] font-bold text-coral-strong no-underline hover:underline"
                              >
                                {link.label} →
                              </Link>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ul>

            <p className="mt-4 border-t border-n-150 pt-3.5 text-[12.5px]">
              <Link href="/app/library" className="font-semibold text-coral-strong no-underline hover:underline">
                자산 라이브러리에서 만든 것 보기 →
              </Link>
            </p>
          </section>
        </div>

        {/* 범례 — 색만으로 구분하지 않도록 글자를 함께 둔다 */}
        <ul className="mt-5 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[11.5px] text-ink-mute">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-5 rounded-full bg-coral" />
            메가와리(시점)
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-5 rounded-full border border-amber/45 bg-amber-bg" />
            진행 중 △
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-5 rounded-full border border-card-border bg-n-100" />
            예정 기간
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-5 rounded-full border border-coral/30 bg-coral-tint" />✎ 내 메모
          </li>
        </ul>

        {!readiness.hasReport && (
          <div className={cardClass('mt-5 flex flex-wrap items-center gap-4 p-5')}>
            <p className="min-w-[280px] flex-1 text-[13.5px] leading-relaxed text-ink-body [text-wrap:pretty]">
              아직 진단 리포트가 없습니다. 진단에서 재설계한 USP·구매 이유가 그대로 시즌 콘텐츠의 재료가 됩니다.
            </p>
            <Link href="/app/report/new" className={buttonClass('primary', 'md', 'no-underline')}>
              진단 시작 →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
