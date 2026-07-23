/**
 * 활성 브랜드 컨텍스트 — 목 세션과 같은 결(쿠키 1개, userId 없음).
 * 쿠키 id를 브랜드 목록과 대조해 유효하지 않으면 최신 브랜드로 폴백한다(스위처 MAIN-01).
 * 읽기는 Server Component·Route Handler 모두 가능, 쓰기(setActiveBrand)는 Route Handler/Server Action에서만.
 */

import { cookies } from 'next/headers';
import { getStore, type BrandProfileRecord } from '../db/store';

export const BRAND_COOKIE = 'kglow_brand';

/** 활성 브랜드 레코드 — 브랜드가 하나도 없으면 null(=온보딩/no-brand) */
export async function getActiveBrand(): Promise<BrandProfileRecord | null> {
  const store = await getStore();
  const brands = await store.listBrandProfiles();
  if (brands.length === 0) return null;
  const wanted = (await cookies()).get(BRAND_COOKIE)?.value;
  // 쿠키 id가 유효하면 그 브랜드, 아니면 최신 브랜드(listBrandProfiles는 최신순)
  return brands.find((b) => b.id === wanted) ?? brands[0];
}

/** 활성 브랜드 id — 브랜드 없으면 null */
export async function getActiveBrandId(): Promise<string | null> {
  return (await getActiveBrand())?.id ?? null;
}

/** 활성 브랜드 쿠키 설정 — Route Handler/Server Action에서만 호출 가능 */
export async function setActiveBrand(id: string): Promise<void> {
  (await cookies()).set(BRAND_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
