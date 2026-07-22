import { redirect } from 'next/navigation';
import { getSession, PROVIDER_LABELS } from '@/lib/server/session';
import { getStore } from '@/lib/db/store';
import { NEXT_MEGAWARI, dDay } from '@/lib/season';
import { AppShell } from '@/components/app/AppShell';

/**
 * /app 세그먼트 레이아웃 — 인증 가드 단일 지점(middleware 없음, 09 §4b M5).
 * 목 세션이 없으면 /login으로 보낸다. 사이드바 셸 데이터(브랜드·KPI·매칭 배지·품의 PDF)를
 * 여기서 조회해 주입한다(MAIN-01~02 셸 정본).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const store = await getStore();
  const [match, brandProfile, reports, assets] = await Promise.all([
    store.getActiveMatchRequest(),
    store.getBrandProfile(),
    store.listReports(),
    store.listAssets(),
  ]);

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
      brand={brandProfile ? { name: brandProfile.brandName, category: brandProfile.category } : null}
      kpi={kpi}
      latestReportId={latestPublished?.requestId ?? null}
      matchBadge={matchBadge}
    >
      {children}
    </AppShell>
  );
}
