import Link from 'next/link';
import { getStore } from '@/lib/db/store';
import { getActiveBrand } from '@/lib/server/activeBrand';
import type { DiagnosisRequestRecord, GeneratedAssetSummary, ReportSummary } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
import { nextMegawari, upcomingEvents } from '@/lib/season';
import { ReportCoverPreview, ThumbPreview } from '@/components/app/AssetPreview';
import { JobPanel, type DashboardJob } from '@/components/app/JobPanel';
import { BrandOnboarding } from '@/components/app/BrandOnboarding';
import { BrandInfoWidget, ReportSummaryWidget, UpcomingEventsWidget } from '@/components/app/HomeWidgets';
import { AxisChip, buttonClass, cardClass } from '@/components/ui/primitives';

/**
 * 홈(앱 홈, MAIN-00~13) — 3축의 현관.
 *
 * 2026-08-18 개편: 가운데 정렬 히어로 한 장에서 **본문 1280px을 꽉 쓰는 대시보드**로 확장했다.
 * 좌측 정렬 페이지 머리 · 본문 폭 · 상단 여백을 다른 /app 화면(라이브러리·리포트·스튜디오)과
 * 같은 규격으로 맞춰, 홈만 다른 화면처럼 보이던 문제를 없앴다.
 * 구성: 페이지 머리 → 현황 타일 4개 → 2열. 좌 칼럼은 [다음 단계 밴드 + 다가오는 이벤트]를 한 카드로
 * 붙인 시즌 블록 + 최근 자산, 우 칼럼은 리포트 요약·브랜드 정보 위젯이다. 시즌 블록을 좌측으로
 * 내린 이유: 밴드가 전폭이고 이벤트가 맨 아래일 때 (a) 같은 메가와리 D-day가 화면 양 끝에서 두 번
 * 읽히고 (b) 좌 칼럼이 최근 자산 하나뿐이라 우 칼럼(리포트 요약+브랜드 정보)보다 훨씬 짧았다.
 *
 * 본문 3상태:
 *   ① 브랜드 미등록 → 온보딩 첫 브랜드 캡처(MAIN-13)
 *   ② 브랜드 有·자산 0 → 4단계 셋업 가이드(MAIN-06) + 브랜드 정보 위젯
 *   ③ 복귀(리포트·썸네일 有) → 현황 타일 + 다음 단계 밴드 + 위젯 그리드(MAIN-10~12) + 최근 자산
 * 진행 중 잡은 우하단 플로팅 패널이 폴링으로 추적한다.
 */

/** ISO → "2026.07.16" */
function fmtDate(iso: string | null): string {
  return (iso ?? '').slice(0, 10).replaceAll('-', '.');
}

/** 리포트 표시명 — 제품 진단 / 브랜드 진단 구분(디자인 RECENTS 명명) */
function reportName(req: DiagnosisRequestRecord): string {
  const t = req.tierInput;
  return t.productName ? `${t.productName} 진단 리포트` : `${t.brandName} 브랜드 진단 리포트`;
}

/** 자산 표시명 — "공식샵 신뢰 배지형 · 라쿠텐 공식샵" */
function assetName(a: GeneratedAssetSummary): string {
  return `${a.styleName} · ${PLATFORM_LABELS[a.platform as Platform] ?? a.platform}`;
}

/**
 * MAIN-04 · 현황 타일 — 숫자 하나 + 근거 한 줄. 눌러서 해당 목록으로 간다.
 * 카드가 곧 링크라 대시보드가 "읽고 끝"이 아니라 다음 화면으로 이어진다.
 */
function StatTile({
  label,
  value,
  unit,
  sub,
  href,
  running = 0,
}: {
  label: string;
  value: number;
  unit: string;
  sub: string;
  href: string;
  /** 진행 중 건수 — 0보다 크면 코랄 점과 함께 표기한다 */
  running?: number;
}) {
  return (
    <Link
      href={href}
      className={cardClass(
        'flex flex-col gap-1.5 p-5 no-underline transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2',
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

export default async function DashboardPage() {
  const store = await getStore();
  const brandProfile = await getActiveBrand();

  // ── MAIN-13 / ONBOARD · 브랜드 미등록이면 첫 브랜드 캡처가 홈을 대신한다 ──
  if (!brandProfile) return <BrandOnboarding />;

  const [requests, reports, assets] = await Promise.all([
    store.listRequests(brandProfile.id),
    store.listReports(brandProfile.id),
    store.listAssets(brandProfile.id),
  ]);

  const reportByRequest = new Map<string, ReportSummary>(reports.map((r) => [r.requestId, r]));
  const publishedRequests = requests.filter((r) => r.status === 'published' && reportByRequest.has(r.id));
  const doneAssets = assets.filter((a) => a.status === 'done');
  const latestPublished = publishedRequests[0] ?? null;

  // 현황 타일(MAIN-04) — 자산 종류별 완성/진행 건수. 목록은 전부 최신순이라 [0]이 최근 1건이다
  const doneThumbs = doneAssets.filter((a) => a.kind !== 'detail');
  const doneDetails = doneAssets.filter((a) => a.kind === 'detail');
  const runningReports = requests.filter((r) => r.status === 'submitted' || r.status === 'processing').length;
  const runningThumbs = assets.filter((a) => a.kind !== 'detail' && a.status === 'generating').length;
  const runningDetails = assets.filter((a) => a.kind === 'detail' && a.status === 'generating').length;

  // 진행 중 잡 → 플로팅 패널(MAIN-05a)
  const jobs: DashboardJob[] = [
    ...requests
      .filter((r) => r.status === 'submitted' || r.status === 'processing')
      .map((r) => ({ kind: 'report' as const, id: r.id, name: reportName(r) })),
    ...assets
      .filter((a) => a.status === 'generating')
      .map((a) => ({ kind: a.kind, id: a.id, name: assetName(a) })),
  ];

  const firstVisit = publishedRequests.length === 0 && doneAssets.length === 0 && jobs.length === 0;

  // 최근 자산(MAIN-05b) — 발행 리포트 + 완성 썸네일 최신순
  const recents = [
    ...publishedRequests.map((req) => {
      const rep = reportByRequest.get(req.id)!;
      return {
        key: `r-${req.id}`,
        kind: 'report' as const,
        href: `/app/report/${req.id}`,
        name: reportName(req),
        date: fmtDate(rep.publishedAt ?? req.createdAt),
        sort: rep.publishedAt ?? req.createdAt,
        score: rep.overallScore,
        groupScores: rep.groupScores,
        top3: rep.top3,
        img: null as string | null,
      };
    }),
    ...doneAssets.map((a) => ({
      key: `a-${a.id}`,
      kind: a.kind,
      href: a.kind === 'detail' ? `/app/studio/detail/${a.id}` : `/app/library/${a.id}`,
      name: assetName(a),
      date: fmtDate(a.createdAt),
      sort: a.createdAt,
      score: null,
      groupScores: {},
      top3: [] as ReportSummary['top3'],
      img: a.imagePath ? `/api/files/${a.imagePath}` : null,
    })),
  ]
    .sort((a, b) => (a.sort < b.sort ? 1 : -1))
    // 5건 + 만들기 타일 1칸 = 3열 그리드 두 줄. 자산이 적어도 섹션이 한 줄로 납작해지지 않는다
    .slice(0, 5);

  // 다음 단계 밴드(MAIN-03) — 자산 상태에 따라 한 가지 primary만 제시(화면 유일 primary)
  const brandName = brandProfile.brandName ?? latestPublished?.tierInput.brandName ?? null;
  const megawari = nextMegawari(new Date());
  const hero =
    publishedRequests.length > 0 && doneAssets.length === 0
      ? {
          headline: (
            <>
              진단에서 재설계한 문구를
              <br />
              <b className="font-extrabold text-coral-strong">썸네일</b>로 만들 차례예요
            </>
          ),
          desc: '리포트의 Before/After 문구가 준비되어 있습니다. 일본 고객이 신뢰하는 썸네일 문법 8종 중 하나로 재설계됩니다.',
          primary: { href: '/app/studio/thumbnail', label: '썸네일 만들기 →' },
          secondary: { href: `/app/report/${latestPublished!.id}`, label: '리포트 다시 보기' } as { href: string; label: string } | null,
        }
      : publishedRequests.length > 0
        ? {
            headline: (
              <>
                {megawari.label} <b className="font-extrabold text-coral-strong">D-{megawari.dDay}</b>
                <br />
                시즌 준비를 시작할 때예요
              </>
            ),
            desc: '프로모션 강조형 썸네일이 메가와리 표준 문법입니다. 세트·특전 소구를 일본 구매 관례어로 재설계합니다.',
            primary: { href: '/app/studio', label: '스튜디오에서 준비하기 →' },
            secondary: { href: '/app/library', label: '자산 라이브러리' } as { href: string; label: string } | null,
          }
        : {
            headline: (
              <>
                콘텐츠 진단에서
                <br />
                <b className="font-extrabold text-coral-strong">일본 진출</b>을 시작하세요
              </>
            ),
            desc: '상세페이지·SNS 문구를 일본 고객 관점으로 진단합니다. 재설계된 문구가 썸네일 카피의 재료가 됩니다.',
            primary: { href: '/app/report/new', label: '진단 시작 →' },
            secondary: null as { href: string; label: string } | null,
          };

  // 4단계 셋업 가이드(MAIN-06) — 2단계(제품)는 Product 엔티티 부재로 proxy 판정
  const step2Done = Boolean(brandProfile.productInfoMemo.trim() || brandProfile.detailDocName);
  const doneSteps =
    1 + (step2Done ? 1 : 0) + (publishedRequests.length > 0 ? 1 : 0) + (doneAssets.length > 0 ? 1 : 0);

  // 복귀 뷰 위젯(MAIN-10~12) 데이터 — 홈은 재조회 전용, 새 저장 없음
  const showReportWidget = latestPublished !== null && reportByRequest.has(latestPublished.id);
  const latestReport = latestPublished ? reportByRequest.get(latestPublished.id) ?? null : null;
  const events = upcomingEvents(new Date(), 3);

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] pb-24 max-sm:px-5">
        {/* ── MAIN-02 · 페이지 머리 — 다른 /app 화면과 같은 좌측 정렬 규격 ────── */}
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">YOAKE 대시보드</p>
            <h1 className="mt-2.5 text-[30px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
              {firstVisit ? (
                <>
                  일본 진출, <b className="font-extrabold text-coral-strong">4단계</b>로 시작하세요
                </>
              ) : (
                <>{brandName ? `${brandName} · ` : ''}일본 진출 현황</>
              )}
            </h1>
            <p className="mt-3 max-w-[680px] text-[15px] leading-[1.7] text-ink-body [text-wrap:pretty]">
              {firstVisit ? (
                <>
                  <span className="tnum font-bold text-green-text">{doneSteps}/4 단계 완료</span>
                  {' · '}브랜드 정보가 3축 전체에서 그대로 쓰입니다. 4단계를 마치면 이 화면이 현황판으로 바뀝니다.
                </>
              ) : (
                '① 진단 리포트 · ② 마케팅 스튜디오 · ③ 운영 자산이 지금 어디까지 와 있는지 한 화면에서 봅니다.'
              )}
            </p>
          </div>
          {!firstVisit && (
            <div className="flex flex-none flex-wrap gap-2">
              <Link href="/app/report/new" className={buttonClass('secondary', 'md', 'no-underline')}>
                진단 시작
              </Link>
              <Link href="/app/studio" className={buttonClass('secondary', 'md', 'no-underline')}>
                스튜디오 열기
              </Link>
            </div>
          )}
        </header>

        {/* ── MAIN-04 · 현황 타일(복귀 뷰 전용 — 첫 방문엔 셀 자리만 남는다) ──── */}
        {!firstVisit && (
          <section aria-label="브랜드 현황" className="mt-8 grid grid-cols-4 gap-4 max-lg:grid-cols-2">
            <StatTile
              label="진단 리포트"
              value={publishedRequests.length}
              unit="건"
              running={runningReports}
              sub={
                latestReport
                  ? `최근 발행 ${fmtDate(latestReport.publishedAt ?? latestPublished!.createdAt)}`
                  : '아직 발행된 리포트가 없어요'
              }
              href="/app/library?tab=report"
            />
            <StatTile
              label="썸네일"
              value={doneThumbs.length}
              unit="건"
              running={runningThumbs}
              sub={doneThumbs.length > 0 ? `최근 생성 ${fmtDate(doneThumbs[0].createdAt)}` : '스튜디오에서 첫 장을 만들어 보세요'}
              href="/app/library?tab=thumbnail"
            />
            <StatTile
              label="상세페이지"
              value={doneDetails.length}
              unit="건"
              running={runningDetails}
              sub={doneDetails.length > 0 ? `최근 생성 ${fmtDate(doneDetails[0].createdAt)}` : '한국형 상세를 일본향으로 바꿔 보세요'}
              href="/app/library?tab=detail"
            />
            <StatTile
              label={megawari.label}
              value={megawari.dDay}
              unit="일 남음"
              sub="프로모션 강조형 썸네일을 준비할 시기"
              href="/app/season"
            />
          </section>
        )}

        {/* ── 본문 2열 — 좌: 진행/자산 · 우: 위젯(MAIN-10·11) ─────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_356px]">
          <div className="flex min-w-0 flex-col gap-5">
            {/* MAIN-03+12 · 다음 단계 밴드 + 다가오는 이벤트 — 한 카드로 붙인다.
                떨어져 있으면 메가와리 D-day가 배너와 목록에서 두 번 따로 읽힌다 */}
            {!firstVisit && (
              <UpcomingEventsWidget
                events={events}
                banner={
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    <div className="min-w-[260px] flex-1">
                      <span className="inline-flex h-7 items-center gap-[7px] rounded-full border border-coral/30 bg-canvas px-[13px] text-xs font-bold text-coral-strong">
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-coral" />
                        다음 단계
                      </span>
                      <h2 className="mt-3 text-[22px] leading-[1.35] font-extrabold tracking-[-0.02em] text-ink">{hero.headline}</h2>
                      <p className="mt-2 max-w-[520px] text-[13.5px] leading-[1.7] text-ink-body [text-wrap:pretty]">{hero.desc}</p>
                    </div>
                    <div className="flex flex-none flex-wrap items-center gap-2.5">
                      <Link
                        href={hero.primary.href}
                        className="inline-flex h-12 items-center rounded-xl bg-coral px-[26px] text-[15px] font-bold text-white no-underline transition-colors hover:bg-coral-hover"
                      >
                        {hero.primary.label}
                      </Link>
                      {hero.secondary && (
                        <Link
                          href={hero.secondary.href}
                          className="inline-flex h-12 items-center rounded-xl border border-input-border bg-canvas px-5 text-sm font-semibold text-ink-body no-underline transition-colors hover:bg-n-100"
                        >
                          {hero.secondary.label}
                        </Link>
                      )}
                    </div>
                  </div>
                }
              />
            )}
            {firstVisit ? (
              /* MAIN-06 · 첫 방문 셋업 가이드(4단계) */
              <section className={cardClass('px-6 py-2.5 max-sm:px-5')} aria-label="시작하기 4단계">
                <ol className="m-0 list-none">
                  {/* 1 · 브랜드 프로필 (온보딩 완료로 ✓) */}
                  <li className="flex items-start gap-3.5 py-4">
                    <span aria-hidden className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-green-bg text-[13px] font-extrabold text-green-text">
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-bold text-ink line-through decoration-ink/35">브랜드 프로필 등록</span>
                      <span className="mt-[3px] block text-[12.5px] leading-relaxed text-ink-mute">
                        브랜드·카테고리·채널 상정이 3축 전체에서 재사용됩니다.
                      </span>
                    </span>
                    <span className="flex-none text-xs font-bold text-green-text">완료 ○</span>
                  </li>
                  {/* 2 · 제품 등록 (건너뛸 수 있음 — 3단계 잠그지 않음) */}
                  <li className="flex items-start gap-3.5 border-t border-n-150 py-4">
                    {step2Done ? (
                      <span aria-hidden className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-green-bg text-[13px] font-extrabold text-green-text">
                        ✓
                      </span>
                    ) : (
                      <span aria-hidden className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] border-coral bg-coral-tint text-[12.5px] font-extrabold text-coral-strong">
                        2
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[14.5px] font-bold text-ink ${step2Done ? 'line-through decoration-ink/35' : ''}`}>
                        제품 등록 <span className="text-[11.5px] font-semibold text-ink-faint">· 건너뛸 수 있어요</span>
                      </span>
                      <span className="mt-[3px] block text-[12.5px] leading-relaxed text-ink-mute">
                        제품컷을 등록하면 썸네일 만들 때 업로드 없이 바로 골라 쓸 수 있어요.
                      </span>
                    </span>
                    {step2Done ? (
                      <span className="flex-none text-xs font-bold text-green-text">완료 ○</span>
                    ) : (
                      <Link href="/app/brand" className={buttonClass('secondary', 'sm', 'no-underline')}>
                        제품 등록 →
                      </Link>
                    )}
                  </li>
                  {/* 3 · 첫 진단 */}
                  <li className="flex items-start gap-3.5 border-t border-n-150 py-4">
                    <span aria-hidden className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] border-coral bg-coral-tint text-[12.5px] font-extrabold text-coral-strong">
                      3
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-bold text-ink">첫 진단 리포트 받기</span>
                      <span className="mt-[3px] block text-[12.5px] leading-relaxed text-ink-mute">
                        상세페이지·SNS 문구를 일본 고객 관점으로 진단합니다. 다음 단계가 여기서 열립니다.
                      </span>
                    </span>
                    <Link
                      href="/app/report/new"
                      className="inline-flex h-9 flex-none items-center rounded-[9px] bg-coral px-4 text-[13px] font-bold text-white no-underline transition-colors hover:bg-coral-hover"
                    >
                      진단 시작 →
                    </Link>
                  </li>
                  {/* 4 · 첫 썸네일 (리포트 발행 전 비활성 — 발행 시 홈이 복귀 뷰로 전이) */}
                  <li className="flex items-start gap-3.5 border-t border-n-150 py-4">
                    <span aria-hidden className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-n-150 text-[12.5px] font-extrabold text-ink-faint">
                      4
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-bold text-ink-faint">첫 일본향 썸네일 만들기</span>
                      <span className="mt-[3px] block text-[12.5px] text-ink-faint">
                        진단 후 열립니다. 재설계된 문구가 썸네일 카피의 재료가 됩니다.
                      </span>
                    </span>
                  </li>
                </ol>
              </section>
            ) : (
              /* MAIN-05b · 최근 자산 그리드 — 좌측 칼럼 전폭 3열 */
              recents.length > 0 && (
                <section className={cardClass('p-6 max-sm:p-5')} aria-labelledby="recents-t">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <h2 id="recents-t" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
                      최근 자산
                    </h2>
                    <span className="tnum text-[11px] font-semibold text-ink-mute">최신 {recents.length}건</span>
                    <Link href="/app/library" className="ml-auto text-[12px] font-semibold text-coral-strong no-underline hover:underline">
                      전체 자산 보기 →
                    </Link>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
                    {recents.map((r) => (
                      <Link
                        key={r.key}
                        href={r.href}
                        aria-label={`${r.name} 열기`}
                        className="block overflow-hidden rounded-2xl border border-card-border bg-canvas no-underline shadow-card transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2"
                      >
                        <span className="relative block aspect-16/10 overflow-hidden border-b border-n-150">
                          {r.kind === 'report' ? (
                            <ReportCoverPreview score={r.score} groupScores={r.groupScores} top3={r.top3} density="compact" />
                          ) : r.img ? (
                            <ThumbPreview src={r.img} alt="" />
                          ) : (
                            <span aria-hidden className="absolute inset-0 bg-n-150" />
                          )}
                        </span>
                        <span className="block px-3.5 py-3">
                          <AxisChip axis={r.kind === 'report' ? 'report' : 'studio'} />
                          <span className="mt-1.5 block truncate text-[13px] font-bold text-ink">{r.name}</span>
                          <span className="mt-0.5 block text-[11px] text-ink-mute">
                            {r.kind === 'report' ? '발행' : '생성'} {r.date}
                          </span>
                        </span>
                      </Link>
                    ))}
                    {/* 만들기 타일 — 마지막 칸을 비워 두지 않는다(자산 1~2건일 때 섹션이 납작해지던 자리) */}
                    <Link
                      href="/app/studio"
                      className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border-strong bg-n-50 px-4 py-6 text-center no-underline transition-colors hover:border-coral hover:bg-coral-tint"
                    >
                      <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-coral-tint text-[18px] font-extrabold text-coral-strong">
                        ＋
                      </span>
                      <span className="mt-0.5 text-[13px] font-bold text-ink">새 자산 만들기</span>
                      <span className="text-[11.5px] leading-snug text-ink-mute">썸네일 · 상세페이지</span>
                    </Link>
                  </div>
                </section>
              )
            )}
            {firstVisit && <UpcomingEventsWidget events={events} />}
          </div>

          {/* 우측 위젯 칼럼 — 리포트 요약(MAIN-10) · 브랜드 정보(MAIN-11) */}
          <aside className="flex min-w-0 flex-col gap-5">
            {showReportWidget && latestReport && (
              <ReportSummaryWidget
                report={latestReport}
                requestId={latestPublished!.id}
                name={reportName(latestPublished!)}
                date={fmtDate(latestReport.publishedAt ?? latestPublished!.createdAt)}
              />
            )}
            <BrandInfoWidget brand={brandProfile} />
          </aside>
        </div>
      </div>

      {jobs.length > 0 && <JobPanel jobs={jobs} />}
    </main>
  );
}
