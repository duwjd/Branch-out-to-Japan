import { getStore } from '@/lib/db/store';
import { BrandForm } from './BrandForm';

/**
 * ③ 브랜드 관리(BRAND-00~09) — BrandProfile 편집 정본. 초기값은 서버에서 주입한다.
 */
export default async function BrandPage() {
  const store = await getStore();
  const profile = await store.getBrandProfile();
  return <BrandForm initialProfile={profile} storeKind={store.kind()} />;
}
