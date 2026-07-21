import Link from 'next/link';
import { getStore } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';

/**
 * ③ 운영 홈 = 자산 라이브러리(LIB-00~10) — Report·GeneratedAsset을 재조회하는 읽기 전용 화면.
 * 서버 컴포넌트 + ?tab= 링크 전환. 실시간 폴링 없음(v1 새로고침 반영 — 09 §4b 하지 말 것).
 */

/** 다음 메가와리 — MVP 정적 상수(LIB-02 설계 노트. 시즌 캘린더 엔티티는 스키마 예약만) */
const NEXT_MEGAWARI = { label: '9월 메가와리', date: '2026-09-01' };

function dDay(target: string): number {
  return Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 86_400_000));
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const activeTab: 'report' | 'thumbnail' = tab === 'thumbnail' ? 'thumbnail' : 'report';

  const store = await getStore();
  const [requests, reports, assets] = await Promise.all([store.listRequests(), store.listReports(), store.listAssets()]);

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

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* 상단 영역(LIB-01) */}
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-[#D93636]">KGLOW 운영</p>
          {store.kind() === 'file' && (
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">로컬 저장(dev)</span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-bold">브랜드 자산 라이브러리</h1>
        <p className="mt-2 text-sm text-neutral-600">
          진단 리포트와 생성 썸네일이 브랜드 단위로 모입니다. 여기서 만들지 않습니다 — 다시 꺼내 보고, 다음 시즌을
          준비하는 화면입니다.
        </p>
      </header>

      {/* 이번 시즌 준비 제안 카드(LIB-03) — 규칙 기반 제안 1개, 화면 유일 primary */}
      <section className="mt-6 rounded-2xl border border-neutral-200 bg-[#FFF8F8] p-5">
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#D93636]">
          {NEXT_MEGAWARI.label} D-{dday}
        </span>
        {hasReport ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{NEXT_MEGAWARI.label}까지 {dday}일</span> — 프로모션 강조형 썸네일을
              준비할 때입니다. 진단 문구가 시즌 콘텐츠의 재료가 됩니다.
            </p>
            <Link
              href="/app/studio/thumbnail"
              className="rounded-lg bg-[#FF6464] px-4 py-2 text-sm font-bold text-white hover:bg-[#D93636]"
            >
              스튜디오에서 준비하기
            </Link>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">첫 진단으로 시작하세요</span> — 진단 문구가 시즌 콘텐츠의 재료가 됩니다.
            </p>
            <Link
              href="/app/report/new"
              className="rounded-lg bg-[#FF6464] px-4 py-2 text-sm font-bold text-white hover:bg-[#D93636]"
            >
              진단 시작
            </Link>
          </div>
        )}
      </section>

      {isEmpty ? (
        // 빈 상태(LIB-06) — 제안 카드가 primary, 빈 상태 링크는 secondary
        <section className="mt-10 rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-lg font-semibold">아직 브랜드 자산이 없습니다</p>
          <p className="mt-2 text-sm text-neutral-600">첫 진단 리포트가 발행되면 여기에 쌓이기 시작합니다</p>
          <Link href="/app/report/new" className="mt-3 inline-block text-sm text-[#D93636] underline">
            진단 시작 →
          </Link>
        </section>
      ) : (
        <section className="mt-8">
          {/* 타입 탭(LIB-04) — 1차 내비. "전체" 탭 없음 */}
          <div className="flex gap-1 border-b border-neutral-200" role="tablist" aria-label="자산 타입">
            {(
              [
                ['report', `진단 리포트 ${reportCards.length}`],
                ['thumbnail', `썸네일 ${thumbnailCards.length}`],
              ] as const
            ).map(([key, label]) => {
              const inProgressDot =
                key === 'report' ? reportInProgress.length > 0 : thumbnailInProgress.length > 0;
              return (
                <Link
                  key={key}
                  role="tab"
                  aria-selected={activeTab === key}
                  href={`/app/library?tab=${key}`}
                  className={`relative px-4 py-2.5 text-sm ${
                    activeTab === key
                      ? 'border-b-2 border-[#FF6464] font-semibold text-[#D93636]'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {label}
                  {activeTab !== key && inProgressDot && (
                    <span aria-label="진행 중 작업 있음" className="absolute right-1 top-2 h-1.5 w-1.5 rounded-full bg-[#FF6464]" />
                  )}
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            총 {activeTab === 'report' ? reportCards.length : thumbnailCards.length}건 · 최신순
            {(activeTab === 'report' ? reportInProgress : thumbnailInProgress).length > 0 &&
              ' · 완료되면 여기에 표시됩니다(새로고침). 다른 작업을 하셔도 됩니다'}
          </p>

          {/* 그리드(LIB-04a·4b·05) */}
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {activeTab === 'thumbnail' && (
              <>
                {thumbnailInProgress.map((a) => (
                  <Link
                    key={a.id}
                    href={`/app/studio/thumbnail/${a.id}`}
                    role="status"
                    className="flex aspect-square flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-center"
                  >
                    <span className="text-xs font-medium text-neutral-600">생성 중…</span>
                    <span className="mt-1 text-[11px] text-neutral-500">{a.styleName}</span>
                    <span aria-hidden className="mt-3 h-1 w-16 animate-pulse rounded bg-[#FF6464]" />
                  </Link>
                ))}
                {thumbnailCards.map((a) => (
                  <Link key={a.id} href={`/app/library/${a.id}`} className="group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.imagePath ? `/api/files/${a.imagePath}` : `/api/files/${a.originalImagePath}`}
                      alt={`${a.styleName}으로 재설계된 ${a.brandNameSnapshot} 일본향 썸네일`}
                      className="aspect-square w-full rounded-xl border border-neutral-200 object-cover group-hover:opacity-90"
                    />
                    <p className="mt-1.5 text-xs">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium">② 스튜디오</span>
                    </p>
                    <p className="mt-1 truncate text-xs font-medium">{a.styleName}</p>
                    <p className="text-[11px] text-neutral-500">
                      {PLATFORM_LABELS[a.platform as Platform] ?? a.platform} · {a.createdAt.slice(0, 10)}
                    </p>
                  </Link>
                ))}
                {thumbnailCards.length + thumbnailInProgress.length === 0 && (
                  <p className="col-span-full py-8 text-sm text-neutral-500">
                    이 종류의 자산이 없습니다 —{' '}
                    <Link href="/app/studio/thumbnail" className="text-[#D93636] underline">
                      스튜디오에서 첫 썸네일 만들기
                    </Link>
                  </p>
                )}
              </>
            )}

            {activeTab === 'report' && (
              <>
                {reportInProgress.map((r) => (
                  <Link
                    key={r.id}
                    href={`/app/report/${r.id}`}
                    role="status"
                    className="flex aspect-square flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-center"
                  >
                    <span className="text-xs font-medium text-neutral-600">리포트 생성 중…</span>
                    <span className="mt-1 truncate text-[11px] text-neutral-500">{r.tierInput.brandName}</span>
                    <span aria-hidden className="mt-3 h-1 w-16 animate-pulse rounded bg-[#FF6464]" />
                  </Link>
                ))}
                {reportCards.map((r) => {
                  const report = reportByRequest.get(r.id);
                  const scored = report?.overallScore !== null && report?.overallScore !== undefined;
                  return (
                    <Link key={r.id} href={`/app/library/${r.id}`} className="group">
                      {/* 표지 프리뷰(LIB-04b — ⓪ MAIN-05b 표지 목업 문법) */}
                      <div className="flex aspect-square flex-col justify-between rounded-xl border border-neutral-200 bg-white p-3 group-hover:border-neutral-400">
                        <p className="text-[10px] font-semibold tracking-wide text-[#D93636]">KGLOW 진단 리포트</p>
                        <div>
                          {scored ? (
                            <p className="text-2xl font-bold">
                              {report?.overallScore}
                              <span className="text-sm font-medium text-neutral-400">/100</span>
                            </p>
                          ) : (
                            <p className="text-xs font-medium text-neutral-500">종합점수 없음 · brand 모드</p>
                          )}
                          <div aria-hidden className="mt-2 space-y-1">
                            <div className="h-1 w-4/5 rounded bg-neutral-200" />
                            <div className="h-1 w-3/5 rounded bg-neutral-200" />
                            <div className="h-1 w-2/3 rounded bg-neutral-200" />
                          </div>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs">
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium">① 리포트</span>
                      </p>
                      <p className="mt-1 truncate text-xs font-medium">
                        {r.tierInput.brandName}
                        {r.tierInput.productName ? ` · ${r.tierInput.productName}` : ''}
                      </p>
                      <p className="text-[11px] text-neutral-500">발행 {report?.publishedAt?.slice(0, 10) ?? '—'}</p>
                    </Link>
                  );
                })}
                {reportCards.length + reportInProgress.length === 0 && (
                  <p className="col-span-full py-8 text-sm text-neutral-500">
                    이 종류의 자산이 없습니다 —{' '}
                    <Link href="/app/report/new" className="text-[#D93636] underline">
                      첫 진단 시작하기
                    </Link>
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* 성과 판별 자리 예약(LIB-08) — 지표·수치 UI로 그리지 않는다(증거 원칙) */}
      <section className="mt-10">
        <h2 className="text-sm font-bold text-neutral-500">준비 중인 기능</h2>
        <div aria-disabled="true" className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">준비 중</span>
          <p className="mt-1.5">성과 판별 — 생성한 콘텐츠가 얼마나 효과적인지 판별. 실현 가능성을 검토하고 있습니다</p>
        </div>
      </section>
    </main>
  );
}
