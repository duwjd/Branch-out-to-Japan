import Link from 'next/link';
import { getStore } from '@/lib/db/store';
import { getActiveBrand } from '@/lib/server/activeBrand';
import type { DiagnosisRequestRecord, GeneratedAssetRecord, ReportRecord } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
import { NEXT_MEGAWARI, dDay, upcomingEvents } from '@/lib/season';
import { ReportCoverPreview, ThumbPreview } from '@/components/app/AssetPreview';
import { JobPanel, type DashboardJob } from '@/components/app/JobPanel';
import { BrandOnboarding } from '@/components/app/BrandOnboarding';
import { BrandInfoWidget, ReportSummaryWidget, UpcomingEventsWidget } from '@/components/app/HomeWidgets';
import { AxisChip, buttonClass, cardClass } from '@/components/ui/primitives';

/**
 * 홈(앱 홈, MAIN-00~13) — 3축의 현관. 본문 3상태:
 *   ① 브랜드 미등록 → 온보딩 첫 브랜드 캡처(MAIN-13)
 *   ② 브랜드 有·자산 0 → 4단계 셋업 가이드(MAIN-06)
 *   ③ 복귀(리포트·썸네일 有) → 다음 단계 밴드 + 위젯 그리드(MAIN-10~12) + 최근 자산
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
function assetName(a: GeneratedAssetRecord): string {
  return `${a.styleName} · ${PLATFORM_LABELS[a.platform as Platform] ?? a.platform}`;
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

  const reportByRequest = new Map<string, ReportRecord>(reports.map((r) => [r.requestId, r]));
  const publishedRequests = requests.filter((r) => r.status === 'published' && reportByRequest.has(r.id));
  const doneAssets = assets.filter((a) => a.status === 'done');
  const latestPublished = publishedRequests[0] ?? null;

  // 진행 중 잡 → 플로팅 패널(MAIN-05a)
  const jobs: DashboardJob[] = [
    ...requests
      .filter((r) => r.status === 'submitted' || r.status === 'processing')
      .map((r) => ({ kind: 'report' as const, id: r.id, name: reportName(r) })),
    ...assets
      .filter((a) => a.status === 'generating')
      .map((a) => ({ kind: 'thumbnail' as const, id: a.id, name: assetName(a) })),
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
        img: null as string | null,
      };
    }),
    ...doneAssets.map((a) => ({
      key: `a-${a.id}`,
      kind: 'thumbnail' as const,
      href: `/app/library/${a.id}`,
      name: assetName(a),
      date: fmtDate(a.createdAt),
      sort: a.createdAt,
      score: null,
      img: a.imagePath ? `/api/files/${a.imagePath}` : null,
    })),
  ]
    .sort((a, b) => (a.sort < b.sort ? 1 : -1))
    .slice(0, 6);

  // 다음 단계 히어로(MAIN-03) — 자산 상태에 따라 한 가지 primary만 제시
  const brandName = brandProfile.brandName ?? latestPublished?.tierInput.brandName ?? null;
  const megawariD = dDay(NEXT_MEGAWARI.date);
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
                {NEXT_MEGAWARI.label} <b className="font-extrabold text-coral-strong">D-{megawariD}</b>
                <br />
                시즌 준비를 시작할 때예요
              </>
            ),
            desc: '프로모션 강조형 썸네일이 메가와리 표준 문법입니다. 세트·특전 소구를 일본 구매 관례어로 재설계합니다.',
            primary: { href: '/app/studio/thumbnail', label: '스튜디오에서 준비하기 →' },
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
      <div className="mx-auto max-w-[960px] px-8 pb-24 max-sm:px-5">
        {firstVisit ? (
          /* ── MAIN-06 · 첫 방문 셋업 가이드(4단계) ────────── */
          <div className="pt-16">
            <div className="mx-auto max-w-[640px]">
              <div className="text-center">
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-coral/30 bg-coral-tint px-[13px] text-xs font-bold text-coral-strong">
                  시작하기
                </span>
                <h1 className="mt-4 text-[clamp(30px,3.4vw,38px)] leading-[1.25] font-extrabold tracking-[-0.03em] text-ink">
                  일본 진출, <b className="font-extrabold text-coral-strong">4단계</b>로 시작하세요
                </h1>
                <p className="mt-3 text-sm text-ink-mute">
                  <span className="tnum font-bold text-green-text">{doneSteps}/4 단계 완료</span>
                  {' · '}브랜드 정보가 3축 전체에서 그대로 쓰입니다
                </p>
              </div>
              <div className={cardClass('mt-7 rounded-2xl px-6 py-2.5')}>
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
                      className="inline-flex h-9 flex-none items-center rounded-[9px] bg-coral px-4 text-[13px] font-bold text-white no-underline transition-colors hover:bg-coral-strong"
                    >
                      진단 시작 →
                    </Link>
                  </li>
                  {/* 4 · 첫 썸네일 (리포트 발행 전 비활성 — 발행 시 홈이 복귀 뷰로 전이) */}
                  <li className="flex items-start gap-3.5 border-t border-n-150 py-4">
                    <span aria-hidden className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-n-150 text-[12.5px] font-extrabold text-[#9ca0a8]">
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
              </div>
            </div>
          </div>
        ) : (
          /* ── MAIN-03 · 다음 단계 밴드 + MAIN-10~12 위젯 ──── */
          <>
            <div className="pt-16 text-center">
              <span className="inline-flex h-7 items-center gap-[7px] rounded-full border border-coral/30 bg-coral-tint px-[13px] text-xs font-bold text-coral-strong">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-coral" />
                {brandName ? `${brandName} · 다음 단계` : '다음 단계'}
              </span>
              <h1 className="mx-auto mt-[18px] max-w-[640px] text-[clamp(30px,3.4vw,38px)] leading-[1.25] font-extrabold tracking-[-0.03em] text-ink">
                {hero.headline}
              </h1>
              <p className="mx-auto mt-3.5 max-w-[520px] text-[14.5px] leading-[1.7] text-ink-body [text-wrap:pretty]">{hero.desc}</p>
              <div className="mt-[26px] flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  href={hero.primary.href}
                  className="inline-flex h-12 items-center rounded-xl bg-coral px-[26px] text-[15px] font-bold text-white no-underline transition-colors hover:bg-coral-strong"
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

            {/* 위젯 그리드(MAIN-11 좌 · MAIN-10 우) → 이벤트 스트립(MAIN-12) */}
            <section className="mt-10">
              <div className={showReportWidget ? 'grid grid-cols-[0.85fr_1fr] gap-4 max-md:grid-cols-1' : 'grid grid-cols-1'}>
                <BrandInfoWidget brand={brandProfile} />
                {showReportWidget && latestReport && (
                  <ReportSummaryWidget
                    report={latestReport}
                    requestId={latestPublished!.id}
                    name={reportName(latestPublished!)}
                    date={fmtDate(latestReport.publishedAt ?? latestPublished!.createdAt)}
                  />
                )}
              </div>
              <div className="mt-4">
                <UpcomingEventsWidget events={events} />
              </div>
            </section>
          </>
        )}

        {/* ── MAIN-05b · 최근 자산 그리드 ──────────────────── */}
        {recents.length > 0 && (
          <section className="mt-16">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2 className="text-base font-extrabold tracking-[-0.01em] text-ink">최근 자산</h2>
              <span className="tnum text-xs font-semibold text-ink-mute">{recents.length}건 · 최신순</span>
              <Link href="/app/library" className="ml-auto text-[11.5px] text-ink-mute no-underline hover:text-coral-strong hover:underline">
                전체 자산 보기 → ③ 운영 자산 라이브러리
              </Link>
            </div>
            <div className="mt-3.5 grid grid-cols-3 gap-4 max-md:grid-cols-1">
              {recents.map((r) => (
                <Link
                  key={r.key}
                  href={r.href}
                  aria-label={`${r.name} 열기`}
                  className="block overflow-hidden rounded-2xl border border-card-border bg-canvas no-underline shadow-card transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2"
                >
                  <span className="relative block aspect-16/10 overflow-hidden border-b border-n-150">
                    {r.kind === 'report' ? (
                      <ReportCoverPreview score={r.score} />
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
            </div>
          </section>
        )}
      </div>

      {jobs.length > 0 && <JobPanel jobs={jobs} />}
    </main>
  );
}
