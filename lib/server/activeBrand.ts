/**
 * 활성 브랜드 컨텍스트 — 세션 유저 스코핑(M3). 브랜드 목록은 현재 로그인 유저 소유분만 본다.
 * 쿠키 id를 브랜드 목록과 대조해 유효하지 않으면 최신 브랜드로 폴백한다(스위처 MAIN-01).
 * 읽기는 Server Component·Route Handler 모두 가능, 쓰기(setActiveBrand)는 Route Handler/Server Action에서만.
 */

import { cookies } from 'next/headers';
import { getSession } from './session';
import { getStore, type BrandProfileRecord } from '../db/store';

export const BRAND_COOKIE = 'kglow_brand';

/**
 * 활성 브랜드 레코드 — 현재 세션 유저 소유 브랜드 중 활성 1건.
 * - 게스트(비로그인)는 활성 브랜드 없음(null) → 소비 라우트·화면이 no-brand로 렌더한다.
 * - 유저 소유 브랜드가 0개면 null(=온보딩/no-brand).
 * - 쿠키 id가 내 목록에 없으면(타 유저 브랜드 쿠키 등) 최신 브랜드로 자연 폴백한다(안전망).
 */
export async function getActiveBrand(): Promise<BrandProfileRecord | null> {
  const session = await getSession();
  if (!session) return null; // 게스트 → 활성 브랜드 없음(no-brand로 렌더)
  const store = await getStore();
  const brands = await store.listBrandProfiles(session.user.id);
  if (brands.length === 0) return null;
  const wanted = (await cookies()).get(BRAND_COOKIE)?.value;
  // 쿠키 id가 내 목록에 있으면 그 브랜드, 아니면 최신 브랜드(listBrandProfiles는 최신순)
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
