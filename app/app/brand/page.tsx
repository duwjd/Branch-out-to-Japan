import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { BrandForm } from './BrandForm';

/**
 * ③ 브랜드 관리(BRAND-00~09) — BrandProfile 편집 정본. 초기값은 서버에서 주입한다.
 * 브랜드가 없으면 온보딩(홈)으로 보낸다. 계정당 브랜드는 1개라 삭제·전환은 없다(2026-08-18).
 */
export default async function BrandPage() {
  const store = await getStore();
  const profile = await getActiveBrand();
  if (!profile) redirect('/app'); // 브랜드 미등록 → 홈 온보딩

  return <BrandForm initialProfile={profile} storeKind={store.kind()} />;
}
