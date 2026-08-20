import Link from 'next/link';
import { getStore } from '@/lib/db/store';
import { getActiveBrand } from '@/lib/server/activeBrand';
import type { DiagnosisRequestRecord, GeneratedAssetSummary, ReportSummary } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
import { nextMegawari, seasonRunway, upcomingEvents } from '@/lib/season';
import { ReportCoverPreview, ThumbPreview } from '@/components/app/AssetPreview';
import { JobPanel, type DashboardJob } from '@/components/app/JobPanel';
import { BrandOnboarding } from '@/components/app/BrandOnboarding';
import { HomeHero, type HeroCta } from '@/components/app/HomeHero';
import {
  BrandInfoWidget,
  categoryLabelKr,
  ReportEmptyWidget,
  ReportSummaryWidget,
  UpcomingEventsWidget,
} from '@/components/app/HomeWidgets';
import { AxisChip, buttonClass, cardClass } from '@/components/ui/primitives';

/**
 * 홈(앱 홈, MAIN-00~13) — 3축의 현관.
 *
 * 2026-08-20 개편: "YOAKE 대시보드 / 브랜드 · 일본 진출 현황" 제목 아래 현황 타일 4개를 깔던
 * 머리를 **시즌 D-day 히어로**로 바꿨다. 홈에 들어온 사람이 먼저 알아야 하는 건 화면 이름이
 * 아니라 "다음 시즌까지 며칠 남았고 지금 뭘 해야 하는가"라서, 그 숫자를 화면에서 제일 크게 둔다.
 * 함께 정리한 것: ① 메가와리 타일을 없앴다(히어로가 같은 D-day를 말한다 → 타일 3개)
 * ② 다음 단계 밴드를 이벤트 카드에서 떼어 히어로에 합쳤다 ③ 우측 위젯 칼럼은 카드 테두리를 걷고
 * 머리선만 남겼다 ④ 히어로가 가리키는 이벤트는 "다가오는 이벤트" 목록에서 뺀다(중복 낭독 방지).
 *
 * 본문 3상태:
 *   ① 브랜드 미등록 → 온보딩 첫 브랜드 캡처(MAIN-13)
 *   ② 브랜드 有·자산 0 → 4단계 셋업 가이드(MAIN-06)
 *   ③ 복귀(리포트·썸네일 有) → 최근 자산 격자(MAIN-05b)
 * 히어로·현황 타일·이벤트·우측 위젯은 세 상태에서 자리를 지킨다 — 상태가 바뀌어도 화면이
 * 통째로 갈리지 않고 내용만 채워진다. 진행 중 잡은 우하단 플로팅 패널이 폴링으로 추적한다.
 */

/** 실패를 홈에서 알리는 기간 — 지난 실패가 영구히 남아 잔소리가 되지 않도록 최근 7일만 본다 */
const FAIL_NOTICE_DAYS = 7;

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
        'group flex flex-col gap-1.5 p-6 no-underline transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2 max-sm:p-5',
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
        <span aria-hidden className="ml-auto text-[13px] text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-coral-strong">
          →
        </span>
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
  const runningRequests = requests.filter((r) => r.status === 'submitted' || r.status === 'processing');
  const runningThumbs = assets.filter((a) => a.kind !== 'detail' && a.status === 'generating').length;
  const runningDetails = assets.filter((a) => a.kind === 'detail' && a.status === 'generating').length;

  // 진행 중 잡 → 플로팅 패널(MAIN-05a)
  const jobs: DashboardJob[] = [
    ...runningRequests.map((r) => ({ kind: 'report' as const, id: r.id, name: reportName(r) })),
    ...assets
      .filter((a) => a.status === 'generating')
      .map((a) => ({ kind: a.kind, id: a.id, name: assetName(a) })),
  ];

  const firstVisit = publishedRequests.length === 0 && doneAssets.length === 0 && jobs.length === 0;

  /* 최근 실패 알림 — 라이브러리는 실패물을 자산으로 치지 않고(LIB-05), 플로팅 패널은 이번 방문에
     시작한 잡만 본다. 그래서 새로고침 뒤에는 실패를 알려 주는 자리가 홈밖에 없다. */
  const failCutoff = new Date(Date.now() - FAIL_NOTICE_DAYS * 86_400_000).toISOString();
  const failedRequests = requests.filter((r) => r.status === 'failed' && r.updatedAt >= failCutoff);
  const failedAssets = assets.filter((a) => a.status === 'failed' && a.updatedAt >= failCutoff);
  const failCount = failedRequests.length + failedAssets.length;
  // 원인 화면은 실패물별로 다르다 — 가장 최근 1건으로 보낸다(리포트/썸네일/상세 각자의 실패 화면)
  const newestFail: { at: string; href: string } | null = [
    ...failedRequests.map((r) => ({ at: r.updatedAt, href: `/app/report/${r.id}` })),
    ...failedAssets.map((a) => ({
      at: a.updatedAt,
      href: a.kind === 'detail' ? `/app/studio/detail/${a.id}` : `/app/studio/thumbnail/${a.id}`,
    })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1))[0] ?? null;

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

  // ── 히어로(MAIN-03) — 시즌 D-day는 상태와 무관한 사실이라 항상 같은 자리에 둔다.
  //    바뀌는 건 "그래서 지금 뭘 하나"뿐이다(화면 유일 primary 1개 원칙 유지) ──
  const now = new Date();
  const megawari = nextMegawari(now);
  const runway = seasonRunway(now, 6);
  const hero: { desc: string; primary: HeroCta; secondary: HeroCta | null } =
    publishedRequests.length === 0
      ? {
          desc: '메가와리 준비는 진단에서 시작합니다. 상세페이지·SNS 문구를 일본 고객 관점으로 진단하면, 재설계된 문구가 그대로 썸네일 카피의 재료가 됩니다.',
          primary: { href: '/app/report/new', label: '진단 시작 →' },
          secondary: { href: '/app/season', label: '시즌 캘린더' },
        }
      : doneAssets.length === 0
        ? {
            desc: '썸네일의 재료는 이미 리포트에 있습니다. 재설계한 Before/After 문구를 일본 고객이 신뢰하는 썸네일 문법 8종 중 하나로 옮깁니다.',
            primary: { href: '/app/studio/thumbnail', label: '썸네일 만들기 →' },
            secondary: { href: `/app/report/${latestPublished!.id}`, label: '리포트 다시 보기' },
          }
        : {
            desc: '프로모션 강조형 썸네일이 메가와리 표준 문법입니다. 세트·특전 소구를 일본 구매 관례어로 재설계합니다.',
            primary: { href: '/app/studio', label: '스튜디오에서 준비하기 →' },
            secondary: { href: '/app/season', label: '시즌 캘린더' },
          };

  // 4단계 셋업 가이드(MAIN-06) — 2단계(제품)는 Product 엔티티 부재로 proxy 판정
  const step2Done = Boolean(brandProfile.productInfoMemo.trim() || brandProfile.detailDocName);
  const doneSteps =
    1 + (step2Done ? 1 : 0) + (publishedRequests.length > 0 ? 1 : 0) + (doneAssets.length > 0 ? 1 : 0);

  // 복귀 뷰 위젯(MAIN-10~12) 데이터 — 홈은 재조회 전용, 새 저장 없음
  const latestReport = latestPublished ? reportByRequest.get(latestPublished.id) ?? null : null;
  const pendingRequest = runningRequests[0] ?? null;
  const lastFailedRequest = requests.find((r) => r.status === 'failed') ?? null;
  // 히어로가 이미 말한 이벤트는 목록에서 뺀다 — 같은 D-day를 한 화면에서 두 번 읽히지 않게
  const events = upcomingEvents(now, 3).filter((e) => e.id !== megawari.id);

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] pb-24 max-sm:px-5">
        {/* ── MAIN-03 · 시즌 히어로 ────────────────────────────────────── */}
        <HomeHero
          eyebrow={`${brandProfile.brandName} · ${categoryLabelKr(brandProfile.category)}`}
          dDay={megawari.dDay}
          eventLabel={megawari.label}
          heroEventId={megawari.id}
          desc={hero.desc}
          runway={runway}
          primary={hero.primary}
          secondary={hero.secondary}
        />

        {/* ── MAIN-04 · 현황 타일 3종. 메가와리는 히어로가 맡는다 ───────── */}
        <section aria-label="브랜드 현황" className="mt-16 grid grid-cols-3 gap-5 max-md:grid-cols-1 max-md:gap-4">
          <StatTile
            label="진단 리포트"
            value={publishedRequests.length}
            unit="건"
            running={runningRequests.length}
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
        </section>

        {/* 최근 실패 알림 — 색+글자+기호 3중 표기(✕). 원인 화면으로 바로 보낸다 */}
        {failCount > 0 && newestFail && (
          <p className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-[12.5px]">
            <b className="font-bold text-danger-text">생성 실패 ✕ {failCount}건</b>
            <span className="text-ink-body">
              최근 {FAIL_NOTICE_DAYS}일 · {failedRequests.length > 0 && `진단 ${failedRequests.length}건`}
              {failedRequests.length > 0 && failedAssets.length > 0 && ' · '}
              {failedAssets.length > 0 && `자산 ${failedAssets.length}건`}
            </span>
            <Link href={newestFail.href} className="font-semibold text-danger-text no-underline hover:underline">
              원인 보기 →
            </Link>
          </p>
        )}

        {/* ── 본문 2열 — 좌: 시즌·자산 · 우: 위젯(MAIN-10·11) ──────────── */}
        <div className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1fr)_356px]">
          <div className="flex min-w-0 flex-col gap-5">
            {firstVisit && (
              /* MAIN-06 · 첫 방문 셋업 가이드(4단계) — 자산이 아직 없으니 자산 격자 대신 이 자리 */
              <section className={cardClass('px-6 pt-5 pb-2.5 max-sm:px-5')} aria-labelledby="setup-t">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h2 id="setup-t" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
                    시작하기 4단계
                  </h2>
                  <span className="tnum text-[11.5px] font-bold text-green-text">{doneSteps}/4 완료</span>
                  <span className="ml-auto text-[11.5px] text-ink-mute">브랜드 정보는 3축 전체에서 그대로 쓰입니다</span>
                </div>
                <ol className="mt-1 mb-0 list-none p-0">
                  {/* 1 · 브랜드 프로필 (온보딩 완료로 ✓) */}
                  <li className="flex items-start gap-3.5 border-t border-n-150 py-4">
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
                  {/* 3 · 첫 진단 — 히어로 primary와 같은 행선지(중복이 아니라 같은 한 걸음) */}
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
                    <Link href="/app/report/new" className={buttonClass('secondary', 'sm', 'no-underline')}>
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
            )}

            <UpcomingEventsWidget events={events} />

            {!firstVisit && (
              /* MAIN-05b · 최근 자산 격자 — 좌측 칼럼 전폭 3열 */
              <section className={cardClass('p-6 max-sm:p-5')} aria-labelledby="recents-t">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h2 id="recents-t" className="text-sm font-extrabold tracking-[-0.01em] text-ink">
                    최근 자산
                  </h2>
                  {recents.length > 0 && <span className="tnum text-[11px] font-semibold text-ink-mute">최신 {recents.length}건</span>}
                  <Link href="/app/library" className="ml-auto text-[12px] font-semibold text-coral-strong no-underline hover:underline">
                    전체 자산 보기 →
                  </Link>
                </div>
                {/* 아직 완성물이 없어도(생성 중뿐) 격자를 접지 않는다 — 만들기 타일이 다음 걸음을 남긴다 */}
                {recents.length === 0 && (
                  <p className="mt-3.5 text-[12.5px] leading-relaxed text-ink-mute">
                    {jobs.length > 0
                      ? '지금 만드는 중입니다. 완성되면 이 격자에 쌓입니다.'
                      : '완성된 자산이 아직 없습니다. 첫 장을 만들면 여기에 쌓입니다.'}
                  </p>
                )}
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
                    className={`flex min-h-[180px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border-strong bg-n-50 px-4 py-6 text-center no-underline transition-colors hover:border-coral hover:bg-coral-tint ${
                      recents.length === 0 ? 'col-span-full' : ''
                    }`}
                  >
                    <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-coral-tint text-[18px] font-extrabold text-coral-strong">
                      ＋
                    </span>
                    <span className="mt-0.5 text-[13px] font-bold text-ink">새 자산 만들기</span>
                    <span className="text-[11.5px] leading-snug text-ink-mute">썸네일 · 상세페이지</span>
                  </Link>
                </div>
              </section>
            )}
          </div>

          {/* 우측 위젯 칼럼 — 리포트 요약(MAIN-10) · 브랜드 정보(MAIN-11) */}
          <aside className="flex min-w-0 flex-col gap-6">
            {latestPublished && latestReport ? (
              <ReportSummaryWidget
                report={latestReport}
                requestId={latestPublished.id}
                name={reportName(latestPublished)}
                date={fmtDate(latestReport.publishedAt ?? latestPublished.createdAt)}
              />
            ) : (
              <ReportEmptyWidget
                pending={pendingRequest ? { id: pendingRequest.id, name: reportName(pendingRequest) } : null}
                failed={lastFailedRequest ? { id: lastFailedRequest.id, name: reportName(lastFailedRequest) } : null}
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
