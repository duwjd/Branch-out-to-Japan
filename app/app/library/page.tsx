import Link from 'next/link';
import { getStore } from '@/lib/db/store';
import { getActiveBrandId } from '@/lib/server/activeBrand';
import type { DiagnosisRequestRecord, GeneratedAssetRecord } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
import { NEXT_MEGAWARI, dDay } from '@/lib/season';
import { ReportCoverPreview, ThumbPreview } from '@/components/app/AssetPreview';
import { AxisChip, EmptyState, StatusBadge, buttonClass } from '@/components/ui/primitives';
import { IconBox } from '@/components/ui/icons';

/**
 * ③ 운영 홈 = 자산 라이브러리(LIB-00~10) — Report·GeneratedAsset을 재조회하는 읽기 전용 화면.
 * 서버 컴포넌트 + ?tab= 링크 전환. 실시간 폴링 없음(v1 새로고침 반영 — 09 §4b 하지 말 것).
 * 디자인 정본: docs/specs/04-operations/1-home.html
 */

type Tab = 'report' | 'thumbnail';

/** 시즌 트랙 좌표 — 7월 1일=0% · 12월 31일=100%(근사). 오늘이 속한 하반기 사이클 연도를 쓴다 */
function seasonYear(now: Date): number {
  return now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

/** month(1~12)·day → 시즌 트랙 위 % 위치 */
function trackPct(now: Date, month: number, day: number): number {
  const year = seasonYear(now);
  const start = new Date(year, 6, 1).getTime();
  const end = new Date(year, 11, 31).getTime();
  const t = new Date(year, month - 1, day).getTime();
  return Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
}

/** 시즌 타임라인 스트립(LIB-02) — 조회 전용, 예약·발행 기능 없음 */
function SeasonStrip({ dday }: { dday: number }) {
  const now = new Date();
  const uvEnd = trackPct(now, 7, 31);
  const autumnStart = trackPct(now, 7, 21);
  const autumnEnd = trackPct(now, 9, 30);
  const xmasStart = trackPct(now, 8, 20);
  const xmasEnd = trackPct(now, 11, 30);
  const sepPct = trackPct(now, 9, 1);
  const novPct = trackPct(now, 11, 1);
  const todayPct = trackPct(now, now.getMonth() + 1, now.getDate());

  return (
    <section
      className="mt-7 overflow-x-auto rounded-card border border-card-border bg-canvas p-5 shadow-card"
      aria-label="일본 뷰티 시즌 타임라인"
    >
      <div className="min-w-[640px] md:min-w-0">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2 className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">시즌 타임라인</h2>
          <span className="tnum text-xs font-bold text-coral-strong">
            다음 메가와리 D-{dday} · {NEXT_MEGAWARI.month}
          </span>
          <span className="ml-auto text-[11.5px] text-ink-faint">
            일정 예약 도구가 아닙니다. 지금 무엇을 준비할지 보는 캘린더입니다
          </span>
        </div>

        <div aria-hidden className="relative mt-7 h-[84px]">
          <span className="absolute inset-x-0 top-[29px] h-0.5 rounded-full bg-n-150" />

          {/* UV 상전 — 진행 중 */}
          <span
            className="absolute top-[25px] h-[10px] rounded-full border border-amber/45 bg-amber-bg"
            style={{ left: '0%', width: `${uvEnd}%` }}
          />
          <span className="absolute top-[9px] text-[10px] font-bold whitespace-nowrap text-amber-text" style={{ left: '1%' }}>
            UV 상전 · 진행 중
          </span>

          {/* 크리스마스 코프레(정보 해금 → 발매) */}
          <span
            className="absolute top-[25px] h-[10px] rounded-full bg-n-150"
            style={{ left: `${xmasStart}%`, width: `${Math.max(0, xmasEnd - xmasStart)}%` }}
          />
          <span
            className="absolute top-[9px] text-[10px] font-semibold whitespace-nowrap text-ink-mute"
            style={{ left: `${Math.min(xmasStart + 2, 70)}%` }}
          >
            크리스마스 코프레 (해금 → 발매)
          </span>

          {/* 가을 신색 — 진행 중 */}
          <span
            className="absolute top-[58px] h-[10px] rounded-full border border-amber/45 bg-amber-bg"
            style={{ left: `${autumnStart}%`, width: `${Math.max(0, autumnEnd - autumnStart)}%` }}
          />
          <span
            className="absolute top-[70px] text-[10px] font-bold whitespace-nowrap text-amber-text"
            style={{ left: `${autumnStart + 2}%` }}
          >
            가을 신색 · 진행 중
          </span>

          {/* 메가와리 시점 노드 */}
          <span
            className="absolute top-[22px] flex -translate-x-1/2 flex-col items-center gap-[7px]"
            style={{ left: `${sepPct}%` }}
          >
            <span aria-hidden className="h-3 w-3 rounded-full border-[2.5px] border-coral bg-canvas" />
            <span className="text-[11px] font-bold whitespace-nowrap text-ink">9월 메가와리 D-{dday}</span>
          </span>
          <span
            className="absolute top-[22px] flex -translate-x-1/2 flex-col items-center gap-[7px]"
            style={{ left: `${novPct}%` }}
          >
            <span aria-hidden className="h-3 w-3 rounded-full border-[2.5px] border-ink-faint bg-canvas" />
            <span className="text-[11px] font-semibold whitespace-nowrap text-ink-mute">11월 메가와리</span>
          </span>

          {/* 오늘 마커(코랄 1개) */}
          <span className="absolute top-3 bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${todayPct}%` }}>
            <span aria-hidden className="w-0.5 flex-1 rounded-full bg-coral" />
            <span className="mt-1 text-[10px] font-extrabold whitespace-nowrap text-coral-strong">오늘</span>
          </span>
        </div>

        <div aria-hidden className="mt-2.5 grid grid-cols-6 border-t border-n-150 pt-1.5">
          {['7월', '8월', '9월', '10월', '11월', '12월'].map((m) => (
            <span key={m} className="text-[10px] text-ink-faint">
              {m}
            </span>
          ))}
        </div>
        <p className="sr-only">
          향후 6개월 시즌: UV 상전이 7월 말까지 진행 중, 가을 신색 시즌이 7월 하순부터 9월까지 진행 중, 9월 메가와리까지{' '}
          {dday}일, 크리스마스 코프레 정보 해금은 8월 하순, 11월 메가와리 예정.
        </p>
      </div>
    </section>
  );
}

/** 썸네일 자산 카드(LIB-04a) */
function ThumbnailCard({ asset }: { asset: GeneratedAssetRecord }) {
  const platformLabel = PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform;
  const src = asset.imagePath ? `/api/files/${asset.imagePath}` : `/api/files/${asset.originalImagePath}`;
  return (
    <Link
      href={`/app/library/${asset.id}`}
      className="group block overflow-hidden rounded-2xl border border-card-border bg-canvas shadow-card transition-[border-color,box-shadow] hover:border-coral hover:shadow-2"
    >
      <span className="relative block aspect-square overflow-hidden">
        <ThumbPreview src={src} alt={`${asset.styleName}으로 재설계된 ${asset.brandNameSnapshot} 일본향 썸네일`} />
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-[rgba(32,33,36,0.44)] opacity-0 transition-opacity group-hover:opacity-100"
        >
          <span className="inline-flex h-8 items-center rounded-lg bg-canvas px-3 text-[12.5px] font-bold text-ink">크게 보기</span>
        </span>
      </span>
      <span className="block px-3 pt-2.5 pb-3">
        <AxisChip axis="studio" />
        <span className="mt-1.5 block truncate text-[13px] font-bold text-ink">{asset.styleName}</span>
        <span className="mt-0.5 block text-[11px] text-ink-mute">
          {platformLabel} · {asset.createdAt.slice(0, 10)}
        </span>
      </span>
    </Link>
  );
}

/** 리포트 표지 카드(LIB-04b — ⓪ MAIN-05b 표지 목업 문법) */
function ReportCard({
  request,
  score,
  publishedAt,
}: {
  request: DiagnosisRequestRecord;
  score: number | null;
  publishedAt: string | null;
}) {
  return (
    <Link
      href={`/app/library/${request.id}`}
      className="group block overflow-hidden rounded-2xl border border-card-border bg-canvas shadow-card transition-[border-color,box-shadow] hover:border-coral hover:shadow-2"
    >
      <span className="relative block aspect-square overflow-hidden border-b border-n-150">
        <ReportCoverPreview score={score} />
      </span>
      <span className="block px-3 pt-2.5 pb-3">
        <AxisChip axis="report" />
        <span className="mt-1.5 block truncate text-[13px] font-bold text-ink">
          {request.tierInput.brandName}
          {request.tierInput.productName ? ` · ${request.tierInput.productName}` : ''}
        </span>
        <span className="mt-0.5 block text-[11px] text-ink-mute">발행 {publishedAt?.slice(0, 10) ?? '—'}</span>
      </span>
    </Link>
  );
}

/** 생성중 타일(LIB-05) — 폴링 상세로 링크, role="status" */
function GeneratingTile({ href, stageLabel, subLabel }: { href: string; stageLabel: string; subLabel: string }) {
  return (
    <Link
      href={href}
      role="status"
      aria-live="polite"
      className="block overflow-hidden rounded-2xl border border-card-border bg-canvas shadow-card"
    >
      <span className="relative block aspect-square overflow-hidden bg-n-150">
        <span
          aria-hidden
          className="absolute inset-0 animate-shimmer bg-[length:420px_100%] bg-no-repeat bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,.75)_50%,transparent_80%)]"
        />
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
          <span aria-hidden className="h-[22px] w-[22px] animate-spin rounded-full border-[2.5px] border-coral border-t-transparent" />
          <span className="text-[12.5px] font-bold text-ink-body">{stageLabel}</span>
        </span>
      </span>
      <span className="block px-3 pt-2.5 pb-3">
        <span className="block truncate text-[11.5px] font-bold text-ink">{subLabel}</span>
        <span className="mt-1 block text-[11px] leading-normal text-ink-mute">
          완료되면 여기에 표시됩니다. 다른 작업을 하셔도 됩니다.
        </span>
      </span>
    </Link>
  );
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const activeTab: Tab = tab === 'thumbnail' ? 'thumbnail' : 'report';

  const store = await getStore();
  const brandId = await getActiveBrandId();
  const [requests, reports, assets] = brandId
    ? await Promise.all([store.listRequests(brandId), store.listReports(brandId), store.listAssets(brandId)])
    : [[], [], []];

  const reportByRequest = new Map(reports.map((r) => [r.requestId, r]));
  // 실패물은 자산이 아니다(LIB-05) — 발행분 + 진행중만
  const reportCards = requests.filter((r) => r.status === 'published');
  const reportInProgress = requests.filter((r) => r.status === 'submitted' || r.status === 'processing');
  const thumbnailCards = assets.filter((a) => a.status === 'done');
  const thumbnailInProgress = assets.filter((a) => a.status === 'generating');

  const isEmpty =
    reportCards.length + reportInProgress.length + thumbnailCards.length + thumbnailInProgress.length === 0;
  const hasReport = reportCards.length > 0;
  const dday = dDay(NEXT_MEGAWARI.date);

  const TABS: { key: Tab; label: string; count: number; inProgress: number }[] = [
    { key: 'report', label: '진단 리포트', count: reportCards.length, inProgress: reportInProgress.length },
    { key: 'thumbnail', label: '썸네일', count: thumbnailCards.length, inProgress: thumbnailInProgress.length },
  ];
  const activeCount = activeTab === 'report' ? reportCards.length : thumbnailCards.length;

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[1120px] px-6 pt-11 pb-24 max-sm:px-5">
        {/* 상단 영역(LIB-01) — primary 없음(화면 primary는 제안 카드 1개) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">KGLOW 운영</p>
          {store.kind() === 'file' && <StatusBadge tone="off">로컬 저장(dev)</StatusBadge>}
        </div>
        <h1 className="mt-2.5 text-[30px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
          브랜드 자산 라이브러리
        </h1>
        <p className="mt-3.5 max-w-[640px] text-[15px] leading-[1.7] text-ink-body [text-wrap:pretty]">
          진단 리포트와 생성 썸네일이 브랜드 단위로 모입니다. 여기서 만들지 않습니다 — 다시 꺼내 보고, 다음 시즌을
          준비하는 화면입니다.
        </p>

        {/* 시즌 타임라인 스트립(LIB-02) */}
        <SeasonStrip dday={dday} />

        {/* 이번 시즌 준비 제안 카드(LIB-03) — 화면 유일 primary */}
        <section className="mt-3.5 flex flex-wrap items-center gap-4.5 rounded-card border border-coral/30 bg-canvas p-5 shadow-card sm:px-5.5">
          <div className="min-w-[280px] flex-1">
            <span className="inline-flex h-[22px] items-center rounded-full border border-coral/30 bg-coral-tint px-2.5 text-[11px] font-bold text-coral-strong">
              {hasReport ? `${NEXT_MEGAWARI.label} D-${dday}` : '시작하기'}
            </span>
            <h2 className="mt-2.5 text-[17px] font-extrabold tracking-[-0.01em] text-ink">
              {hasReport ? '프로모션 강조형 썸네일을 준비할 때입니다' : '첫 진단으로 시작하세요'}
            </h2>
            <p className="mt-[7px] text-[13px] leading-relaxed text-ink-mute">
              {hasReport
                ? '무엇을: 메가와리용 프로모션 썸네일 · 어떤 말로: 세트·특전 소구를 일본 구매 관례어로 재설계'
                : '진단에서 재설계한 문구가 시즌 콘텐츠의 재료가 됩니다.'}
            </p>
          </div>
          <Link href={hasReport ? '/app/studio/thumbnail' : '/app/report/new'} className={buttonClass('primary', 'md', 'no-underline')}>
            {hasReport ? '스튜디오에서 준비하기 →' : '진단 시작 →'}
          </Link>
        </section>

        {isEmpty ? (
          // 빈 상태(LIB-06) — 제안 카드가 primary, 빈 상태 링크는 secondary
          <EmptyState
            className="mt-7"
            icon={<IconBox size={40} />}
            title="아직 브랜드 자산이 없습니다"
            desc="첫 진단 리포트가 발행되면 여기에 쌓이기 시작합니다. 재설계 문구·썸네일이 모두 이 화면으로 모입니다."
            action={
              <Link href="/app/report/new" className={buttonClass('secondary', 'md', 'no-underline')}>
                진단 시작
              </Link>
            }
          />
        ) : (
          <section className="mt-8">
            {/* 타입 탭(LIB-04) — 1차 내비. "전체" 탭 없음 */}
            <div className="flex gap-0.5 border-b border-hairline" role="tablist" aria-label="자산 종류">
              {TABS.map(({ key, label, count, inProgress }) => {
                const active = activeTab === key;
                const genDot = !active && inProgress > 0;
                return (
                  <Link
                    key={key}
                    role="tab"
                    aria-selected={active}
                    aria-label={genDot ? `${label} ${count}건 — 생성 진행 중` : undefined}
                    href={`/app/library?tab=${key}`}
                    className={`relative -mb-px inline-flex h-[46px] items-center gap-2 border-b-2 px-4 text-sm transition-colors ${
                      active ? 'border-coral font-bold text-ink' : 'border-transparent font-semibold text-ink-mute hover:text-ink'
                    }`}
                  >
                    {label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${
                        active ? 'bg-coral-tint text-coral-strong' : 'bg-n-150 text-[#9ca0a8]'
                      }`}
                    >
                      {count}
                    </span>
                    {genDot && <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-coral animate-soft-pulse" />}
                  </Link>
                );
              })}
            </div>
            <p className="mt-3.5 text-[12.5px] font-semibold text-ink-mute">총 {activeCount}건 · 최신순</p>

            {/* 자산 그리드(LIB-04·05) */}
            <div className="mt-4 grid grid-cols-4 gap-4 max-lg:grid-cols-2">
              {activeTab === 'thumbnail' && (
                <>
                  {thumbnailInProgress.map((a) => (
                    <GeneratingTile
                      key={a.id}
                      href={`/app/studio/thumbnail/${a.id}`}
                      stageLabel="생성 중…"
                      subLabel={a.styleName}
                    />
                  ))}
                  {thumbnailCards.map((a) => (
                    <ThumbnailCard key={a.id} asset={a} />
                  ))}
                  {thumbnailCards.length + thumbnailInProgress.length === 0 && (
                    <p className="col-span-full py-8 text-[13.5px] text-ink-mute">
                      생성한 썸네일이 없습니다.{' '}
                      <Link href="/app/studio/thumbnail" className="text-coral-strong underline">
                        스튜디오에서 첫 썸네일을 만들 수 있습니다
                      </Link>
                    </p>
                  )}
                </>
              )}

              {activeTab === 'report' && (
                <>
                  {reportInProgress.map((r) => (
                    <GeneratingTile
                      key={r.id}
                      href={`/app/report/${r.id}`}
                      stageLabel="리포트 생성 중…"
                      subLabel={r.tierInput.brandName}
                    />
                  ))}
                  {reportCards.map((r) => {
                    const report = reportByRequest.get(r.id);
                    return (
                      <ReportCard
                        key={r.id}
                        request={r}
                        score={report?.overallScore ?? null}
                        publishedAt={report?.publishedAt ?? null}
                      />
                    );
                  })}
                  {reportCards.length + reportInProgress.length === 0 && (
                    <p className="col-span-full py-8 text-[13.5px] text-ink-mute">
                      발행한 진단 리포트가 없습니다.{' '}
                      <Link href="/app/report/new" className="text-coral-strong underline">
                        진단 입력에서 시작할 수 있습니다
                      </Link>
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* 준비 중인 기능(LIB-08) — 성과 판별 자리 예약 */}
        <section className="mt-11">
          <h2 className="text-base font-extrabold tracking-[-0.01em] text-ink">준비 중인 기능</h2>
          <div className="mt-3.5 grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <div aria-disabled="true" className="rounded-card border border-dashed border-input-border bg-n-50 p-5.5">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-extrabold text-[#9ca0a8]">성과 판별</h3>
                <StatusBadge tone="off">준비 중</StatusBadge>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
                생성한 콘텐츠가 얼마나 효과적인지 판별 — 실현 가능성을 검토하고 있습니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
