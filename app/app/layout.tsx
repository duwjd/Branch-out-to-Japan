import { redirect } from 'next/navigation';
import { getSession, PROVIDER_LABELS } from '@/lib/server/session';
import { getStore } from '@/lib/db/store';
import { AppShell } from '@/components/app/AppShell';

/**
 * /app 세그먼트 레이아웃 — 인증 가드 단일 지점(middleware 없음, 09 §4b M5).
 * 목 세션이 없으면 /login으로 보낸다. 사이드바 셸과 매칭 배지 데이터를 여기서 주입한다.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  // 기업 매칭 상태 배지(LIB-07) — 미신청이면 null
  const store = await getStore();
  const match = await store.getActiveMatchRequest();
  const matchBadge =
    match === null
      ? null
      : match.status === 'reviewing'
        ? { label: '검토 중 △', tone: 'amber' as const }
        : match.status === 'proposed'
          ? { label: '제안 ○', tone: 'green' as const }
          : { label: '신청 완료', tone: 'neutral' as const };

  return (
    <AppShell userName={session.user.name} providerLabel={PROVIDER_LABELS[session.provider]} matchBadge={matchBadge}>
      {children}
    </AppShell>
  );
}
