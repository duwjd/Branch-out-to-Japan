import { getStore } from '@/lib/db/store';
import { MatchingView } from './MatchingView';

/**
 * ③ 기업 매칭(MATCH-00~08) — 컨시어지형. 신청 상태에 따라 폼/상태 뷰가 갈린다.
 */
export default async function MatchingPage() {
  const store = await getStore();
  const [active, requests, assets, reports, profile] = await Promise.all([
    store.getActiveMatchRequest(),
    store.listRequests(),
    store.listAssets(),
    store.listReports(),
    store.getBrandProfile(),
  ]);

  return (
    <MatchingView
      initialActive={active}
      brandName={profile?.brandName ?? null}
      summary={{
        reportCount: requests.filter((r) => r.status === 'published').length,
        thumbnailCount: assets.filter((a) => a.status === 'done').length,
        latestScore: reports.find((r) => r.publishedAt !== null)?.overallScore ?? null,
      }}
      storeKind={store.kind()}
    />
  );
}
