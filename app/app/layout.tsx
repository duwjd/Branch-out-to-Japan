import { redirect } from 'next/navigation';
import { getSessionState, PROVIDER_LABELS } from '@/lib/server/session';
import { getStore, type BrandProfileRecord } from '@/lib/db/store';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { NEXT_MEGAWARI, dDay } from '@/lib/season';
import { AppShell, type BrandSwitcherItem } from '@/components/app/AppShell';

/**
 * /app 세그먼트 레이아웃 — 인증 가드 단일 지점(middleware 없음, 09 §4b M5).
 * M4b: 게스트(쿠키 없음)는 통과시켜 비회원 열람을 연다. 쿠키가 있으나 무효(만료)면
 * /login?expired=1로 보낸다. 사이드바 셸 데이터(브랜드 목록·활성 브랜드·KPI·매칭 배지·품의
 * PDF)는 여기서 조회해 주입한다 — 게스트는 활성 브랜드가 null이라 전부 빈 상태가 된다(M3).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const state = await getSessionState();
  if ('expired' in state) redirect('/login?expired=1'); // 쿠키 무효 = 만료
  const session = 'session' in state ? state.session : null; // 게스트 = null(통과)

  const store = await getStore();
  const [brandList, activeBrand] = await Promise.all([
    session ? store.listBrandProfiles(session.user.id) : Promise.resolve<BrandProfileRecord[]>([]),
    getActiveBrand(),
  ]);
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
      user={
        session
          ? { name: session.user.name, email: session.user.email, providerLabel: PROVIDER_LABELS[session.provider] }
          : null
      }
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
