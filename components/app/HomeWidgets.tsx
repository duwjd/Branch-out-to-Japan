import Link from 'next/link';
import type { BrandProfileRecord, ReportSummary } from '@/lib/db/store';
import { POSITIONING_TAGS } from '@/lib/engine/rules/positioning';
import { GROUP_LABELS_PREFIXED, GROUP_ORDER } from '@/lib/report/labels';
import type { UpcomingEvent } from '@/lib/season';
import { cardClass } from '@/components/ui/primitives';
import { CATEGORY_LABELS } from '@/lib/engine/types';

/**
 * 홈 복귀 뷰 위젯 — MAIN-11 브랜드 정보 · MAIN-10 리포트 요약 · MAIN-12 다가오는 이벤트.
 * 전부 기존 엔티티 재조회 전용(홈은 아무것도 저장하지 않는다 — 08 §7). 서버 컴포넌트.
 *
 * 2026-08-20 개편: 우측 칼럼(리포트 요약·브랜드 정보)의 카드 테두리를 걷고 머리선만 남겼다.
 * 히어로가 카드 없는 페이지 머리로 올라오면서 카드가 3겹(페이지 위 카드 위 칩)으로 쌓여
 * 본문 밀도가 왼쪽 칼럼과 맞지 않았다. 왼쪽(이벤트·자산)은 격자를 담는 그릇이라 카드를 유지한다.
 */

const TAG_LABELS: Record<string, string> = Object.fromEntries(POSITIONING_TAGS.map((t) => [t.value, t.label]));

/** 우측 위젯 공통 표면 — 카드가 아니라 머리선으로만 구분한다(카드 3겹 방지) */
const WIDGET = 'border-t border-card-border pt-5';

/** 카테고리 한국어 라벨 — 미지의 값이면 원문 그대로(빈 자리를 만들지 않는다) */
export function categoryLabelKr(category: string): string {
  return CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category;
}

/** MAIN-11 · 브랜드 정보 위젯 — "진단·생성이 무엇을 보고 도는가"를 홈에서 확인 */
export function BrandInfoWidget({ brand }: { brand: BrandProfileRecord }) {
  const cat = CATEGORY_LABELS[brand.category as keyof typeof CATEGORY_LABELS];
  const tags = brand.positioningTags.map((v) => TAG_LABELS[v] ?? v);
  const shownTags = tags.slice(0, 3);
  const extraTags = tags.length - shownTags.length;
  const kitDone =
    (brand.brandKit.productNamesJa.length > 0 ? 1 : 0) +
    (brand.brandKit.forbiddenTerms.length > 0 ? 1 : 0) +
    (brand.brandKit.toneGuide.trim() ? 1 : 0);
  const hasProductInfo = Boolean(brand.detailDocName || brand.productInfoMemo.trim());
  const jpChannels = brand.channels.jp.map((c) => c.channel).filter(Boolean);

  return (
    <section className={WIDGET} aria-labelledby="w11t">
      <div className="flex items-baseline gap-2">
        <h2 id="w11t" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
          브랜드 정보
        </h2>
        <span className="ml-auto text-[11px] text-ink-faint">진단·생성의 입력</span>
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-linear-135 from-[#ffe9df] to-[#ffcfb8] text-[15px] font-extrabold text-amber-text"
        >
          {brand.brandName.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink">{brand.brandName}</span>
          <span className="mt-0.5 block truncate text-[11.5px] text-ink-mute">
            {cat ?? brand.category}
            {' · '}
            {brand.productClass}
          </span>
        </span>
      </div>

      <p className="mt-4 text-[11.5px] font-bold text-ink-mute">포지셔닝</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {shownTags.length > 0 ? (
          <>
            {shownTags.map((t) => (
              <span
                key={t}
                className="inline-flex h-6 items-center rounded-full bg-n-100 px-2.5 text-[11.5px] font-semibold text-ink-body"
              >
                {t}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="inline-flex h-6 items-center px-1 text-[11.5px] font-semibold text-ink-faint">
                ＋{extraTags}
              </span>
            )}
          </>
        ) : (
          <span className="text-[12px] text-ink-faint">미등록</span>
        )}
      </div>

      <dl className="mt-4 flex flex-col">
        <div className="flex items-baseline justify-between gap-3 border-b border-n-150 py-[7px] text-[12.5px]">
          <dt className="text-ink-body">제품·상세 정보</dt>
          <dd className={`m-0 font-semibold ${hasProductInfo ? 'text-ink' : 'text-ink-faint'}`}>
            {hasProductInfo ? '등록됨' : '미등록'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-n-150 py-[7px] text-[12.5px]">
          <dt className="flex-none text-ink-body">일본 채널</dt>
          <dd className={`m-0 min-w-0 truncate font-semibold ${jpChannels.length ? 'text-ink' : 'text-ink-faint'}`}>
            {jpChannels.length ? jpChannels.join(' · ') : '미등록'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-[7px] text-[12.5px]">
          <dt className="text-ink-body">브랜드 킷</dt>
          <dd className="m-0 font-semibold text-ink">
            <span className="tnum">{kitDone}</span>
            <span className="text-ink-faint">/3 항목</span>
          </dd>
        </div>
      </dl>

      <p className="mt-3.5 text-[12px] leading-relaxed text-ink-mute [text-wrap:pretty]">
        {hasProductInfo
          ? '채우면 진단·생성 정확도가 올라갑니다.'
          : '제품을 등록하면 스튜디오에서 제품컷을 바로 골라 쓸 수 있어요.'}
      </p>
      <p className="mt-3.5 text-[12.5px]">
        <Link href="/app/brand" className="font-semibold text-coral-strong no-underline hover:underline">
          브랜드 관리 →
        </Link>
      </p>
    </section>
  );
}

/** MAIN-10 · 리포트 요약 위젯 — "지난 진단 결과가 뭐였더라"를 ①로 나가지 않고 확인 */
export function ReportSummaryWidget({
  report,
  requestId,
  name,
  date,
}: {
  report: ReportSummary;
  requestId: string;
  name: string;
  date: string;
}) {
  const isBrandMode = report.overallScore === null;

  return (
    <section className={WIDGET} aria-labelledby="w10t">
      <div className="flex items-baseline gap-2">
        <h2 id="w10t" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
          최근 진단 리포트
        </h2>
        <span className="ml-auto flex-none text-[11px] text-ink-faint">{date} 발행</span>
      </div>
      <p className="mt-3 text-[13.5px] font-bold text-ink">{name}</p>

      {isBrandMode ? (
        <div className="mt-3">
          <span className="inline-flex h-[26px] items-center rounded-full bg-n-150 px-[11px] text-[12px] font-bold text-ink-mute">
            종합점수 없음 · brand 모드
          </span>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">
            브랜드 진단은 종합점수를 내지 않아요. 제품 콘텐츠를 넣으면 점수가 나옵니다.
          </p>
          <p className="mt-2.5 text-[12.5px]">
            <Link href="/app/report/new" className="font-semibold text-coral-strong no-underline hover:underline">
              제품까지 진단하기 →
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-end gap-3">
            <span className="flex items-baseline gap-0.5">
              <span className="tnum text-[38px] leading-none font-extrabold tracking-[-0.03em] text-ink">
                {report.overallScore}
              </span>
              <span className="text-sm font-semibold text-ink-faint">/100</span>
            </span>
          </div>

          <dl className="mt-4 flex flex-col gap-[7px]">
            {GROUP_ORDER.map((g) => {
              const pct = report.groupScores[g] ?? 0;
              return (
                <div key={g} className="flex items-center gap-2.5 text-[11.5px]">
                  <dt className="w-[92px] flex-none text-ink-body">{GROUP_LABELS_PREFIXED[g]}</dt>
                  <dd className="m-0 flex flex-1 items-center gap-2.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-n-150">
                      <span className="block h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
                    </span>
                    <b className="tnum w-8 flex-none text-right text-[11px] font-bold text-ink">{pct}%</b>
                  </dd>
                </div>
              );
            })}
          </dl>

          {report.top3.length > 0 && (
            <>
              <p className="mt-4 text-[11.5px] font-bold text-ink-mute">먼저 고칠 지점</p>
              <ol className="mt-2 flex list-none flex-col gap-1.5 p-0">
                {report.top3.slice(0, 3).map((t, i) => (
                  <li key={t.itemId} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-body">
                    <span
                      aria-hidden
                      className="mt-px inline-flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] bg-coral-tint text-[10px] font-extrabold text-coral-strong"
                    >
                      {i + 1}
                    </span>
                    {t.title}
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}

      <p className="mt-4 text-[12.5px]">
        <Link
          href={`/app/report/${requestId}`}
          className="font-semibold text-coral-strong no-underline hover:underline"
        >
          리포트 전체 보기 →
        </Link>
      </p>
    </section>
  );
}

/**
 * MAIN-10 빈·진행·실패 변형 — 발행 리포트가 없어도 우측 칼럼의 자리를 지킨다.
 * 진행/실패를 여기서 말해 주지 않으면, 새로고침 뒤에는 어디에서도 보이지 않는다
 * (라이브러리는 실패물을 자산으로 치지 않는다 — LIB-05).
 */
export function ReportEmptyWidget({
  pending,
  failed,
}: {
  /** 생성 중인 진단 1건(최신) — 없으면 null */
  pending: { id: string; name: string } | null;
  /** 마지막으로 실패한 진단 1건 — 없으면 null */
  failed: { id: string; name: string } | null;
}) {
  return (
    <section className={WIDGET} aria-labelledby="w10et">
      <div className="flex items-baseline gap-2">
        <h2 id="w10et" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
          최근 진단 리포트
        </h2>
        <span className="ml-auto flex-none text-[11px] text-ink-faint">
          {pending ? '생성 중' : failed ? '실패 ✕' : '아직 없음'}
        </span>
      </div>

      {pending ? (
        <>
          <p className="mt-3 flex items-center gap-2 text-[13.5px] font-bold text-ink">
            <span aria-hidden className="h-[6px] w-[6px] flex-none rounded-full bg-coral animate-soft-pulse" />
            <span className="min-w-0 truncate">{pending.name}</span>
          </p>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">
            진단이 도는 중입니다. 9블록이 모두 채워지면 이 자리에 요약이 뜹니다.
          </p>
          <p className="mt-3 text-[12.5px]">
            <Link
              href={`/app/report/${pending.id}`}
              className="font-semibold text-coral-strong no-underline hover:underline"
            >
              진행 상황 보기 →
            </Link>
          </p>
        </>
      ) : failed ? (
        <>
          <p className="mt-3 truncate text-[13.5px] font-bold text-ink">{failed.name}</p>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">
            마지막 진단이 끝까지 돌지 못했습니다. 원인을 확인하고 같은 입력으로 다시 시작할 수 있어요.
          </p>
          <p className="mt-3 text-[12.5px]">
            <Link
              href={`/app/report/${failed.id}`}
              className="font-semibold text-coral-strong no-underline hover:underline"
            >
              실패 원인 보기 →
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-[13.5px] font-bold text-ink">아직 발행된 리포트가 없어요</p>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">
            상세페이지·SNS 문구를 일본 고객 관점으로 진단합니다. 재설계된 문구가 그대로 썸네일 카피의 재료가 됩니다.
          </p>
          <p className="mt-3 text-[12.5px]">
            <Link href="/app/report/new" className="font-semibold text-coral-strong no-underline hover:underline">
              진단 시작 →
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

/** 이벤트 건수별 열 수 — Tailwind는 정적 클래스만 읽으므로 표로 둔다 */
const EVENT_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
};

/**
 * MAIN-12 · 다가오는 이벤트 위젯 — 조회 전용. 예약·발행·알림 없음(금지 포지션).
 * 히어로가 이미 말한 이벤트는 페이지가 걸러서 넘긴다 — 같은 D-day를 한 화면에서 두 번 읽히지 않게.
 */
export function UpcomingEventsWidget({ events }: { events: UpcomingEvent[] }) {
  // 가장 임박한 카운트다운 1건만 코랄 강조(진행 중은 amber라 대상 아님 — MAIN-12)
  const nearId = events.find((e) => !e.inProgress)?.id;

  return (
    <section className={cardClass('p-6 max-sm:p-5')} aria-labelledby="w12t">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id="w12t" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
          다가오는 이벤트
        </h2>
        <span className="ml-auto text-[12px]">
          <Link href="/app/season" className="font-semibold text-coral-strong no-underline hover:underline">
            시즌 캘린더 →
          </Link>
        </span>
      </div>
      {events.length === 0 ? (
        <p className="mt-3.5 text-[12.5px] leading-relaxed text-ink-mute">
          지금 챙길 시즌은 위 카운트다운 하나뿐입니다. 다음 시즌은 캘린더에서 미리 볼 수 있어요.
        </p>
      ) : (
        <ul
          className={`mt-3.5 grid list-none gap-2.5 p-0 max-md:grid-cols-1 ${EVENT_COLS[events.length] ?? 'grid-cols-3'}`}
        >
          {events.map((e) => {
            const near = e.id === nearId;
            return (
              <li
                key={e.id}
                className={`flex flex-col gap-1 rounded-xl border p-3.5 ${near ? 'border-coral/40 bg-coral-tint' : 'border-card-border bg-n-50'}`}
              >
                <span
                  className={`inline-flex h-[21px] w-fit items-center rounded-full px-2.5 text-[11px] font-bold ${
                    e.inProgress
                      ? 'bg-amber-bg text-amber-text'
                      : near
                        ? 'bg-coral text-white'
                        : 'bg-n-150 text-ink-mute'
                  }`}
                >
                  {e.inProgress ? '진행 중 △' : e.dDay === 0 ? '오늘 시작' : `D-${e.dDay}`}
                </span>
                <span className="mt-0.5 text-[13px] font-bold text-ink">{e.name}</span>
                <span className="text-[11px] text-ink-mute">{e.when}</span>
                <span className="mt-0.5 text-[11.5px] leading-snug text-ink-body [text-wrap:pretty]">{e.prep}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
