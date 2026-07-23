import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import { getSession } from '@/lib/server/session';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { BrandForm } from './BrandForm';

/**
 * ③ 브랜드 관리(BRAND-00~10) — BrandProfile 편집 정본. 초기값(활성 브랜드)은 서버에서 주입한다.
 * 브랜드가 없으면 온보딩(홈)으로 보낸다. 마지막 브랜드가 아니면 삭제 가능(canDelete = BRAND-10).
 */
export default async function BrandPage() {
  const store = await getStore();
  const session = await getSession();
  const profile = await getActiveBrand();
  if (!profile) redirect('/app'); // no-brand(게스트 포함) → 홈 온보딩

  const [brands, reports, assets] = await Promise.all([
    // profile이 있으면 세션이 보장된다(getActiveBrand는 세션 유저 스코핑) —
    // 방어적으로 활성 브랜드 소유 유저(profile.userId)로 폴백(레이아웃 가드가 게스트를 막는다)
    store.listBrandProfiles(session?.user.id ?? profile.userId),
    store.listReports(profile.id),
    store.listAssets(profile.id),
  ]);

  return (
    <BrandForm
      initialProfile={profile}
      storeKind={store.kind()}
      canDelete={brands.length > 1}
      deleteCounts={{
        reportCount: reports.filter((r) => r.publishedAt !== null).length,
        thumbnailCount: assets.filter((a) => a.status === 'done').length,
      }}
    />
  );
}
