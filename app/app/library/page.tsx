import Link from 'next/link';
import { getStore } from '@/lib/db/store';
import { getActiveBrandId } from '@/lib/server/activeBrand';
import type { DiagnosisRequestRecord, GeneratedAssetSummary, ReportSummary } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
import { nextMegawari } from '@/lib/season';
import { REPORT_STAGE_LABELS } from '@/lib/stageLabels';
import { ReportCoverPreview, ThumbPreview } from '@/components/app/AssetPreview';
import { AxisChip, EmptyState, StatusBadge, buttonClass, cardClass } from '@/components/ui/primitives';
import { IconBox } from '@/components/ui/icons';

/**
 * ③ 운영 · 브랜드 자산 라이브러리(LIB-00~10) — Report·GeneratedAsset을 재조회하는 읽기 전용 화면.
 * 서버 컴포넌트 + `?tab=`·`?range=` 링크 전환. 실시간 폴링 없음(v1 새로고침 반영 — 09 §4b 하지 말 것).
 *
 * 2026-08-19 개편:
 *  ① 시즌 타임라인 스트립(구 LIB-02)을 `/app/season` 시즌 캘린더로 분리 — 자산 재열람과 시즌 준비가
 *    한 화면에 섞여 둘 다 얕았다. 스트립이 좌표를 하드코딩해 `lib/season.ts`와 이중 관리되던 것도 해소.
 *  ② 성과 판별 자리 예약 카드(구 LIB-08)를 화면에서 내렸다 — 실현가능성 미정 상태를 계속 노출할 이유가 없다.
 *  ③ 빈 자리를 자산 현황 타일·기간 셀렉트·카드 오버레이로 채웠다(기획서 LIB-04 툴바·4a/4b 오버레이 이행).
 *
 * 디자인 정본: docs/specs/04-operations/04-operations-ui-기획서.md # 1
 */

type Tab = 'report' | 'thumbnail' | 'detail';
type Range = 'all' | '30' | '90';

const RANGE_OPTIONS: { key: Range; label: string; days: number | null }[] = [
  { key: 'all', label: '전체 기간', days: null },
  { key: '30', label: '최근 30일', days: 30 },
  { key: '90', label: '최근 90일', days: 90 },
];

/** 자산 현황 타일 — 숫자 하나 + 근거 한 줄. 눌러서 해당 탭으로 간다(⓪ MAIN-04 문법 계승) */
function StatTile({
  label,
  value,
  unit = '건',
  sub,
  href,
  running = 0,
  active = false,
}: {
  label: string;
  value: number;
  /** 값의 단위 — 자산 수는 "건", 메가와리 타일은 "일 남음" */
  unit?: string;
  sub: string;
  href: string;
  /** 진행 중 건수 — 0보다 크면 코랄 점과 함께 표기한다 */
  running?: number;
  /** 현재 보고 있는 탭이면 테두리를 코랄로 유지해 위치를 알린다 */
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cardClass(
        `flex flex-col gap-1.5 p-5 no-underline transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2 ${
          active ? 'border-coral' : ''
        }`,
      )}
    >
      <span className="flex items-center gap-1.5 text-[12px] font-bold text-ink-mute">
        {label}
        {running > 0 && (
          <>
            <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-coral animate-soft-pulse" />
            <span className="tnum text-[11px] font-bold text-coral-strong">생성 중 {running}</span>
          </>
        )}
      </span>
      <span className="flex items-baseline gap-1">
        <b className="tnum text-[32px] leading-none font-extrabold tracking-[-0.03em] text-ink">{value}</b>
        <span className="text-[13px] font-semibold text-ink-faint">{unit}</span>
      </span>
      <span className="truncate text-[11.5px] text-ink-mute">{sub}</span>
    </Link>
  );
}

/** 카드 hover·포커스 오버레이(LIB-04a/4b) — 카드 클릭과 같은 곳으로 가는 시각 힌트 */
function CardOverlay({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="absolute inset-0 flex items-center justify-center bg-[rgba(32,33,36,0.44)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      <span className="inline-flex h-8 items-center rounded-lg bg-canvas px-3 text-[12.5px] font-bold text-ink">{label}</span>
    </span>
  );
}

/** 자산 카드 공통 표면 — 그리드 카드 4종이 같은 테두리·hover를 쓴다 */
const CARD_SURFACE =
  'group block overflow-hidden rounded-2xl border border-card-border bg-canvas shadow-card transition-[border-color,box-shadow] hover:border-coral hover:shadow-2';

/** 썸네일·상세페이지 자산 카드(LIB-04a) */
function ThumbnailCard({ asset }: { asset: GeneratedAssetSummary }) {
  const platformLabel = PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform;
  const isDetail = asset.kind === 'detail';
  const src = asset.imagePath ? `/api/files/${asset.imagePath}` : `/api/files/${asset.originalImagePath}`;
  // 상세페이지는 블록 재생성·분할 다운로드가 있는 전용 결과 화면으로 보낸다
  const href = isDetail ? `/app/studio/detail/${asset.id}` : `/app/library/${asset.id}`;
  return (
    <Link href={href} className={CARD_SURFACE}>
      <span className="relative block aspect-square overflow-hidden">
        <ThumbPreview
          src={src}
          alt={`${asset.styleName}으로 재설계된 ${asset.brandNameSnapshot} 일본향 ${isDetail ? '상세페이지' : '썸네일'}`}
          anchor={isDetail ? 'top' : 'center'}
        />
        <CardOverlay label="크게 보기" />
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

/** 리포트 표지 카드(LIB-04b) — 표지가 실제 진단 결과를 요약한다(2026-08-19 목업 제거) */
function ReportCard({ request, report }: { request: DiagnosisRequestRecord; report: ReportSummary | undefined }) {
  return (
    <Link href={`/app/library/${request.id}`} className={CARD_SURFACE}>
      <span className="relative block aspect-square overflow-hidden border-b border-n-150">
        <ReportCoverPreview
          score={report?.overallScore ?? null}
          groupScores={report?.groupScores ?? {}}
          top3={report?.top3 ?? []}
        />
        <CardOverlay label="요약 보기" />
      </span>
      <span className="block px-3 pt-2.5 pb-3">
        <AxisChip axis="report" />
        <span className="mt-1.5 block truncate text-[13px] font-bold text-ink">
          {request.tierInput.brandName}
          {request.tierInput.productName ? ` · ${request.tierInput.productName}` : ''}
        </span>
        <span className="mt-0.5 block text-[11px] text-ink-mute">발행 {report?.publishedAt?.slice(0, 10) ?? '—'}</span>
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
          <span className="text-[12.5px] leading-snug font-bold text-ink-body [text-wrap:pretty]">{stageLabel}</span>
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

/** 탭 안이 비었을 때 — 빈 그리드 대신 해당 축 시작 링크(LIB-04) */
function TabEmpty({ text, href, linkLabel }: { text: string; href: string; linkLabel: string }) {
  return (
    <p className="col-span-full py-8 text-[13.5px] text-ink-mute">
      {text}{' '}
      <Link href={href} className="font-semibold text-coral-strong underline">
        {linkLabel}
      </Link>
    </p>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string }>;
}) {
  const { tab, range } = await searchParams;
  const activeTab: Tab = tab === 'thumbnail' ? 'thumbnail' : tab === 'detail' ? 'detail' : 'report';
  const activeRange: Range = range === '30' ? '30' : range === '90' ? '90' : 'all';

  const store = await getStore();
  const brandId = await getActiveBrandId();
  const [requests, reports, assets] = brandId
    ? await Promise.all([store.listRequests(brandId), store.listReports(brandId), store.listAssets(brandId)])
    : [[], [], []];

  // 기간 셀렉트(LIB-04 툴바) — 2차 정제. 진행 중 항목은 언제 시작했든 항상 보인다
  const rangeDays = RANGE_OPTIONS.find((r) => r.key === activeRange)!.days;
  const cutoff = rangeDays === null ? null : new Date(Date.now() - rangeDays * 86_400_000).toISOString();
  const inRange = (createdAt: string): boolean => cutoff === null || createdAt >= cutoff;

  const reportByRequest = new Map(reports.map((r) => [r.requestId, r]));
  // 실패물은 자산이 아니다(LIB-05) — 발행분 + 진행중만
  const reportCards = requests.filter((r) => r.status === 'published' && inRange(r.createdAt));
  const reportInProgress = requests.filter((r) => r.status === 'submitted' || r.status === 'processing');
  // 자산은 kind 로 나눈다 — 상세페이지는 결합본이 image_path 라 카드 렌더가 썸네일과 같다
  const thumbnailCards = assets.filter((a) => a.kind !== 'detail' && a.status === 'done' && inRange(a.createdAt));
  const thumbnailInProgress = assets.filter((a) => a.kind !== 'detail' && a.status === 'generating');
  const detailCards = assets.filter((a) => a.kind === 'detail' && a.status === 'done' && inRange(a.createdAt));
  const detailInProgress = assets.filter((a) => a.kind === 'detail' && a.status === 'generating');

  // 빈 상태 판정은 기간 필터 이전 값으로 본다 — "최근 30일에 없음"과 "자산이 없음"은 다른 화면이다
  const isEmpty =
    requests.length + assets.filter((a) => a.status !== 'failed').length === 0;
  const hasReport = requests.some((r) => r.status === 'published');
  const megawari = nextMegawari(new Date());

  const TABS: { key: Tab; label: string; count: number; inProgress: number }[] = [
    { key: 'report', label: '진단 리포트', count: reportCards.length, inProgress: reportInProgress.length },
    { key: 'thumbnail', label: '썸네일', count: thumbnailCards.length, inProgress: thumbnailInProgress.length },
    { key: 'detail', label: '상세페이지', count: detailCards.length, inProgress: detailInProgress.length },
  ];
  const activeCount = TABS.find((t) => t.key === activeTab)!.count;
  /** 탭·기간을 함께 유지하는 링크 — 한쪽만 바뀌어도 다른 쪽 선택이 풀리지 않는다 */
  const hrefFor = (next: { tab?: Tab; range?: Range }): string =>
    `/app/library?tab=${next.tab ?? activeTab}&range=${next.range ?? activeRange}`;

  /** 최근 생성일 한 줄 — 목록은 전부 최신순이라 [0]이 최근 1건이다 */
  const latestOf = (list: { createdAt: string }[], empty: string): string =>
    list.length > 0 ? `최근 ${list[0].createdAt.slice(0, 10)}` : empty;

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] pb-24 max-sm:px-5">
        {/* 상단 영역(LIB-01) — primary 없음(화면 primary는 제안 카드 1개) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">YOAKE 운영</p>
          {store.kind() === 'file' && <StatusBadge tone="off">로컬 저장(dev)</StatusBadge>}
        </div>
        <h1 className="mt-2.5 text-[30px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
          브랜드 자산 라이브러리
        </h1>
        <p className="mt-3.5 max-w-[640px] text-[15px] leading-[1.7] text-ink-body [text-wrap:pretty]">
          진단 리포트와 생성한 썸네일·상세페이지가 브랜드 단위로 모입니다. 다시 꺼내 보고, 다음 시즌을 준비하세요.
        </p>

        {isEmpty ? (
          // 빈 상태(LIB-06) — 제안 카드가 primary, 빈 상태 링크는 secondary
          <EmptyState
            className="mt-7"
            icon={<IconBox size={40} />}
            title="아직 브랜드 자산이 없습니다"
            desc="첫 진단 리포트가 발행되면 여기에 쌓이기 시작합니다. 재설계 문구·썸네일이 모두 이 화면으로 모입니다."
            action={
              <Link href="/app/report/new" className={buttonClass('primary', 'md', 'no-underline')}>
                진단 시작 →
              </Link>
            }
          />
        ) : (
          <>
            {/* 자산 현황 타일 — 어떤 축이 얼마나 쌓였는지 한눈에, 누르면 해당 탭으로 */}
            <section aria-label="자산 현황" className="mt-7 grid grid-cols-4 gap-4 max-lg:grid-cols-2">
              <StatTile
                label="진단 리포트"
                value={requests.filter((r) => r.status === 'published').length}
                running={reportInProgress.length}
                sub={latestOf(
                  requests.filter((r) => r.status === 'published'),
                  '아직 발행된 리포트가 없어요',
                )}
                href={hrefFor({ tab: 'report' })}
                active={activeTab === 'report'}
              />
              <StatTile
                label="썸네일"
                value={assets.filter((a) => a.kind !== 'detail' && a.status === 'done').length}
                running={thumbnailInProgress.length}
                sub={latestOf(
                  assets.filter((a) => a.kind !== 'detail' && a.status === 'done'),
                  '스튜디오에서 첫 장을 만들어 보세요',
                )}
                href={hrefFor({ tab: 'thumbnail' })}
                active={activeTab === 'thumbnail'}
              />
              <StatTile
                label="상세페이지"
                value={assets.filter((a) => a.kind === 'detail' && a.status === 'done').length}
                running={detailInProgress.length}
                sub={latestOf(
                  assets.filter((a) => a.kind === 'detail' && a.status === 'done'),
                  '한국형 상세를 일본향으로 바꿔 보세요',
                )}
                href={hrefFor({ tab: 'detail' })}
                active={activeTab === 'detail'}
              />
              <StatTile
                label={megawari.label}
                value={megawari.dDay}
                unit="일 남음"
                sub="시즌 캘린더에서 준비 항목 보기"
                href="/app/season"
              />
            </section>

            {/* 이번 시즌 준비 제안 카드(LIB-03) — 화면 유일 primary */}
            <section className="mt-4 flex flex-wrap items-center gap-4.5 rounded-card border border-coral/30 bg-canvas p-5 shadow-card sm:px-5.5">
              <div className="min-w-[280px] flex-1">
                <span className="inline-flex h-[22px] items-center rounded-full border border-coral/30 bg-coral-tint px-2.5 text-[11px] font-bold text-coral-strong">
                  {hasReport ? `${megawari.label} D-${megawari.dDay}` : '시작하기'}
                </span>
                <h2 className="mt-2.5 text-[17px] font-extrabold tracking-[-0.01em] text-ink">
                  {hasReport ? '프로모션 강조형 썸네일을 준비할 때입니다' : '첫 진단으로 시작하세요'}
                </h2>
                <p className="mt-[7px] text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                  {hasReport
                    ? '무엇을: 메가와리용 프로모션 썸네일 · 어떤 말로: 세트·특전 소구를 일본 구매 관례어로 재설계'
                    : '진단에서 재설계한 문구가 시즌 콘텐츠의 재료가 됩니다.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/app/season" className="text-[12.5px] font-semibold text-coral-strong no-underline hover:underline">
                  시즌 캘린더에서 보기 →
                </Link>
                <Link
                  href={hasReport ? '/app/studio/thumbnail' : '/app/report/new'}
                  className={buttonClass('primary', 'md', 'no-underline')}
                >
                  {hasReport ? '스튜디오에서 준비하기 →' : '진단 시작 →'}
                </Link>
              </div>
            </section>

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
                      href={hrefFor({ tab: key })}
                      className={`relative -mb-px inline-flex h-[46px] items-center gap-2 border-b-2 px-4 text-sm transition-colors ${
                        active ? 'border-coral font-bold text-ink' : 'border-transparent font-semibold text-ink-mute hover:text-ink'
                      }`}
                    >
                      {label}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${
                          active ? 'bg-coral-tint text-coral-strong' : 'bg-n-150 text-ink-faint'
                        }`}
                      >
                        {count}
                      </span>
                      {genDot && <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-coral animate-soft-pulse" />}
                    </Link>
                  );
                })}
              </div>

              {/* 툴바(LIB-04) — 기간은 2차 정제. 상태·스타일 필터는 추후 기획 */}
              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                <p className="text-[12.5px] font-semibold text-ink-mute">총 {activeCount}건 · 최신순</p>
                <div className="ml-auto flex items-center gap-1" role="group" aria-label="기간">
                  {RANGE_OPTIONS.map((opt) => {
                    const active = activeRange === opt.key;
                    return (
                      <Link
                        key={opt.key}
                        href={hrefFor({ range: opt.key })}
                        aria-current={active ? 'true' : undefined}
                        className={`inline-flex h-[30px] items-center rounded-full border px-3 text-[12px] font-bold no-underline transition-colors ${
                          active
                            ? 'border-coral bg-coral-tint text-coral-strong'
                            : 'border-card-border bg-canvas text-ink-mute hover:text-ink'
                        }`}
                      >
                        {opt.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

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
                      <TabEmpty
                        text={activeRange === 'all' ? '생성한 썸네일이 없습니다.' : '이 기간에 생성한 썸네일이 없습니다.'}
                        href="/app/studio/thumbnail"
                        linkLabel="스튜디오에서 첫 썸네일을 만들 수 있습니다"
                      />
                    )}
                  </>
                )}

                {activeTab === 'detail' && (
                  <>
                    {detailInProgress.map((a) => (
                      <GeneratingTile
                        key={a.id}
                        href={`/app/studio/detail/${a.id}`}
                        stageLabel={a.blockTotal > 0 ? `블록 ${a.blockDone}/${a.blockTotal}` : '생성 중…'}
                        subLabel={a.styleName}
                      />
                    ))}
                    {detailCards.map((a) => (
                      <ThumbnailCard key={a.id} asset={a} />
                    ))}
                    {detailCards.length + detailInProgress.length === 0 && (
                      <TabEmpty
                        text={activeRange === 'all' ? '생성한 상세페이지가 없습니다.' : '이 기간에 생성한 상세페이지가 없습니다.'}
                        href="/app/studio/detail"
                        linkLabel="스튜디오에서 첫 상세페이지를 만들 수 있습니다"
                      />
                    )}
                  </>
                )}

                {activeTab === 'report' && (
                  <>
                    {reportInProgress.map((r) => (
                      <GeneratingTile
                        key={r.id}
                        href={`/app/report/${r.id}`}
                        // 실제 단계를 그대로 보여준다 — 처리 화면(PROCESS-02)과 같은 말을 쓴다
                        stageLabel={REPORT_STAGE_LABELS[r.stage ?? ''] ?? '리포트 생성 중…'}
                        subLabel={r.tierInput.brandName}
                      />
                    ))}
                    {reportCards.map((r) => (
                      <ReportCard key={r.id} request={r} report={reportByRequest.get(r.id)} />
                    ))}
                    {reportCards.length + reportInProgress.length === 0 && (
                      <TabEmpty
                        text={activeRange === 'all' ? '발행한 진단 리포트가 없습니다.' : '이 기간에 발행한 진단 리포트가 없습니다.'}
                        href="/app/report/new"
                        linkLabel="진단 입력에서 시작할 수 있습니다"
                      />
                    )}
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
