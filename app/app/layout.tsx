import { redirect } from 'next/navigation';
import { getSessionState, PROVIDER_LABELS } from '@/lib/server/session';
import { getStore } from '@/lib/db/store';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { AppShell } from '@/components/app/AppShell';

/**
 * /app 세그먼트 레이아웃 — 인증 가드 단일 지점(middleware 없음, 09 §4b M5).
 * 2026-08-18 플로우 개편: 서비스 내부에는 로그인 동선이 없다. 로그인은 랜딩에서만 하고
 * /app 이하는 전부 로그인 필수다 — 쿠키가 없으면 /login, 무효(만료)면 /login?expired=1.
 * 사이드바 셸 데이터(매칭 배지)는 여기서 조회해 주입한다. 브랜드는 매칭 배지 조회 스코프로만
 * 쓴다 — 사이드바 브랜드 정보 행은 2026-08-18 제거했다(브랜드는 운영 > 브랜드 관리에서).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const state = await getSessionState();
  if ('expired' in state) redirect('/login?expired=1'); // 쿠키 무효 = 만료
  if (!('session' in state)) redirect('/login'); // 비로그인 = 서비스 진입 불가
  const { session } = state;

  const store = await getStore();
  const brand = await getActiveBrand();

  // 기업 매칭 상태 배지(LIB-07) — 미신청이면 null (운영 하위 메뉴에만 노출되는 라이브 상태 배지)
  const match = brand ? await store.getActiveMatchRequest(brand.id) : null;
  const matchBadge =
    match === null
      ? null
      : match.status === 'reviewing'
        ? { label: '검토 중 △', tone: 'amber' as const }
        : match.status === 'proposed'
          ? { label: '제안 ○', tone: 'green' as const }
          : { label: '신청 완료', tone: 'neutral' as const };

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        providerLabel: PROVIDER_LABELS[session.provider],
      }}
      matchBadge={matchBadge}
    >
      {children}
    </AppShell>
  );
}
