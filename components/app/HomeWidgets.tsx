import Link from 'next/link';
import type { BrandProfileRecord, ReportRecord } from '@/lib/db/store';
import type { RubricGroup } from '@/lib/engine/types';
import { POSITIONING_TAGS } from '@/lib/engine/rules/positioning';
import type { UpcomingEvent } from '@/lib/season';
import { cardClass } from '@/components/ui/primitives';

/**
 * 홈 복귀 뷰 위젯 3종 — MAIN-11 브랜드 정보 · MAIN-10 리포트 요약 · MAIN-12 다가오는 이벤트.
 * 전부 기존 엔티티 재조회 전용(홈은 아무것도 저장하지 않는다 — 08 §7). 서버 컴포넌트.
 */

const GROUP_ORDER: RubricGroup[] = ['A', 'B', 'C', 'D', 'E'];
/** 리포트 GROUP_LABELS 정본과 동일(ReportView·slides.ts) */
const GROUP_LABELS: Record<RubricGroup, string> = {
  A: 'A 신뢰 구축',
  B: 'B 무첨가·안전',
  C: 'C 서사 구조',
  D: 'D 성분 프레이밍',
  E: 'E 카테고리 적합성',
};
const CATEGORY_LABELS: Record<string, { kr: string; ja: string }> = {
  skincare: { kr: '스킨케어', ja: 'スキンケア' },
  makeup: { kr: '메이크업', ja: 'メイク' },
  suncare: { kr: '선케어', ja: '日焼け止め' },
  cleansing: { kr: '클렌징', ja: 'クレンジング' },
};
const TAG_LABELS: Record<string, string> = Object.fromEntries(POSITIONING_TAGS.map((t) => [t.value, t.label]));

/** MAIN-11 · 브랜드 정보 위젯 — "진단·생성이 무엇을 보고 도는가"를 홈에서 확인 */
export function BrandInfoWidget({ brand }: { brand: BrandProfileRecord }) {
  const cat = CATEGORY_LABELS[brand.category];
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
    <section className={cardClass('p-6')} aria-labelledby="w11t">
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
          <span className="mt-0.5 block text-[11.5px] text-ink-mute">
            {cat ? (
              <>
                {cat.kr} / <span lang="ja">{cat.ja}</span>
              </>
            ) : (
              brand.category
            )}
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
              <span key={t} className="inline-flex h-6 items-center rounded-full bg-n-100 px-2.5 text-[11.5px] font-semibold text-ink-body">
                {t}
              </span>
            ))}
            {extraTags > 0 && <span className="inline-flex h-6 items-center px-1 text-[11.5px] font-semibold text-ink-faint">＋{extraTags}</span>}
          </>
        ) : (
          <span className="text-[12px] text-ink-faint">미등록</span>
        )}
      </div>

      <dl className="mt-4 flex flex-col">
        <div className="flex items-baseline justify-between gap-3 border-b border-n-150 py-[7px] text-[12.5px]">
          <dt className="text-ink-body">제품·상세 정보</dt>
          <dd className={`m-0 font-semibold ${hasProductInfo ? 'text-ink' : 'text-ink-faint'}`}>{hasProductInfo ? '등록됨' : '미등록'}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-n-150 py-[7px] text-[12.5px]">
          <dt className="text-ink-body">일본 채널</dt>
          <dd className={`m-0 truncate font-semibold ${jpChannels.length ? 'text-ink' : 'text-ink-faint'}`}>{jpChannels.length ? jpChannels.join(' · ') : '미등록'}</dd>
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
        {hasProductInfo ? '채우면 진단·생성 정확도가 올라갑니다.' : '제품을 등록하면 스튜디오에서 제품컷을 바로 골라 쓸 수 있어요.'}
      </p>
      <p className="mt-3.5 border-t border-n-150 pt-3.5 text-[12.5px]">
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
  report: ReportRecord;
  requestId: string;
  name: string;
  date: string;
}) {
  const isBrandMode = report.overallScore === null;

  return (
    <section className={cardClass('p-6')} aria-labelledby="w10t">
      <div className="flex items-baseline gap-2">
        <h2 id="w10t" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
          최근 진단 리포트
        </h2>
        <span className="ml-auto text-[11px] text-ink-faint">{date} 발행</span>
      </div>
      <p className="mt-3 text-[13.5px] font-bold text-ink">{name}</p>

      {isBrandMode ? (
        <div className="mt-3">
          <span className="inline-flex h-[26px] items-center rounded-full bg-n-150 px-[11px] text-[12px] font-bold text-ink-mute">종합점수 없음 · brand 모드</span>
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
              <span className="tnum text-[38px] leading-none font-extrabold tracking-[-0.03em] text-ink">{report.overallScore}</span>
              <span className="text-sm font-semibold text-ink-faint">/100</span>
            </span>
          </div>

          <dl className="mt-4 flex flex-col gap-[7px]">
            {GROUP_ORDER.map((g) => {
              const pct = report.groupScores[g] ?? 0;
              return (
                <div key={g} className="flex items-center gap-2.5 text-[11.5px]">
                  <dt className="w-[92px] flex-none text-ink-body">{GROUP_LABELS[g]}</dt>
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

      <p className="mt-4 border-t border-n-150 pt-3.5 text-[12.5px]">
        <Link href={`/app/report/${requestId}`} className="font-semibold text-coral-strong no-underline hover:underline">
          리포트 전체 보기 →
        </Link>
      </p>
    </section>
  );
}

/** MAIN-12 · 다가오는 이벤트 위젯(전폭 스트립) — 조회 전용. 예약·발행·알림 없음(금지 포지션) */
export function UpcomingEventsWidget({ events }: { events: UpcomingEvent[] }) {
  // 가장 임박한 카운트다운 1건만 코랄 강조(진행 중은 amber라 대상 아님 — MAIN-12)
  const nearId = events.find((e) => !e.inProgress)?.id;

  return (
    <section className={cardClass('p-6')} aria-labelledby="w12t">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id="w12t" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
          다가오는 이벤트
        </h2>
        <span className="ml-auto text-[12px]">
          <Link href="/app/library" className="font-semibold text-coral-strong no-underline hover:underline">
            시즌 전체 보기 →
          </Link>
        </span>
      </div>
      <ul className="mt-3.5 grid list-none grid-cols-3 gap-2.5 p-0 max-md:grid-cols-1">
        {events.map((e) => {
          const near = e.id === nearId;
          return (
            <li
              key={e.id}
              className={`flex flex-col gap-1 rounded-xl border p-3.5 ${near ? 'border-coral/40 bg-coral-tint' : 'border-card-border bg-n-50'}`}
            >
              <span
                className={`inline-flex h-[21px] w-fit items-center rounded-full px-2.5 text-[11px] font-bold ${
                  e.inProgress ? 'bg-amber-bg text-amber-text' : near ? 'bg-coral text-white' : 'bg-n-150 text-ink-mute'
                }`}
              >
                {e.inProgress ? '진행 중 △' : `D-${e.dDay}`}
              </span>
              <span className="mt-0.5 text-[13px] font-bold text-ink">{e.name}</span>
              <span className="text-[11px] text-ink-mute">{e.when}</span>
              <span className="mt-0.5 text-[11.5px] leading-snug text-ink-body [text-wrap:pretty]">{e.prep}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11.5px] text-ink-faint">일정 예약 도구가 아니에요. 지금 무엇을 준비할지 보는 캘린더입니다.</p>
    </section>
  );
}
