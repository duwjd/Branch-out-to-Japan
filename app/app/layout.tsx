import { redirect } from 'next/navigation';
import { getSession, PROVIDER_LABELS } from '@/lib/server/session';
import { getStore, LEGACY_USER_ID } from '@/lib/db/store';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { NEXT_MEGAWARI, dDay } from '@/lib/season';
import { AppShell, type BrandSwitcherItem } from '@/components/app/AppShell';

/**
 * /app 세그먼트 레이아웃 — 인증 가드 단일 지점(middleware 없음, 09 §4b M5).
 * 목 세션이 없으면 /login으로 보낸다. 사이드바 셸 데이터(브랜드 목록·활성 브랜드·KPI·매칭
 * 배지·품의 PDF)를 여기서 조회해 주입한다(MAIN-01~02 셸 정본).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const store = await getStore();
  // M1 전환: 세션 도입(M3) 후 session.user.id로 교체
  const [brandList, activeBrand] = await Promise.all([store.listBrandProfiles(LEGACY_USER_ID), getActiveBrand()]);
  const activeBrandId = activeBrand?.id ?? null;

  // 스위처 각 행의 브랜드별 카운트(MAIN-01b) — 브랜드 수가 적어 브랜드당 스코핑 조회
  const brands: BrandSwitcherItem[] = await Promise.all(
    brandList.map(async (b) => {
      const [reports, assets] = await Promise.all([store.listReports(b.id), store.listAssets(b.id)]);
      return {
        id: b.id,
        name: b.brandName,
        category: b.category,
        reportCount: reports.filter((r) => r.publishedAt !== null).length,
        thumbnailCount: assets.filter((a) => a.status === 'done').length,
      };
    }),
  );

  // 활성 브랜드 기준 KPI·매칭 배지
  const [match, reports, assets] = activeBrandId
    ? await Promise.all([
        store.getActiveMatchRequest(activeBrandId),
        store.listReports(activeBrandId),
        store.listAssets(activeBrandId),
      ])
    : [null, [], []];

  // 기업 매칭 상태 배지(LIB-07) — 미신청이면 null
  const matchBadge =
    match === null
      ? null
      : match.status === 'reviewing'
        ? { label: '검토 중 △', tone: 'amber' as const }
        : match.status === 'proposed'
          ? { label: '제안 ○', tone: 'green' as const }
          : { label: '신청 완료', tone: 'neutral' as const };

  // KPI 위젯(MAIN-02) — 발행 리포트·완성 썸네일·최근 점수·다음 메가와리
  const published = reports.filter((r) => r.publishedAt !== null);
  const latestPublished = published[0] ?? null;
  const latestScored = published.find((r) => r.overallScore !== null) ?? null;
  const kpi = {
    reportCount: published.length,
    thumbnailCount: assets.filter((a) => a.status === 'done').length,
    latestScore: latestScored?.overallScore ?? null,
    megawari: { dDay: dDay(NEXT_MEGAWARI.date), month: NEXT_MEGAWARI.month },
  };

  return (
    <AppShell
      userName={session.user.name}
      userEmail={session.user.email}
      providerLabel={PROVIDER_LABELS[session.provider]}
      brands={brands}
      activeBrandId={activeBrandId}
      kpi={kpi}
      latestReportId={latestPublished?.requestId ?? null}
      matchBadge={matchBadge}
    >
      {children}
    </AppShell>
  );
}
