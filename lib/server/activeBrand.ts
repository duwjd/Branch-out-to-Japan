/**
 * 브랜드 컨텍스트 — 세션 유저 스코핑(M3). 계정당 브랜드는 1개다(2026-08-18 다중 브랜드 제거).
 * 이름은 `active`로 남겨 둔다 — 리포트·자산·매칭이 전부 brandProfileId로 스코핑돼 있어
 * 이 해석기 하나만 바꾸면 되고, 호출부(20+곳)를 건드릴 이유가 없다.
 * 목록 조회를 그대로 쓰는 이유: 과거 데이터에 브랜드가 2건 이상 남아 있을 수 있어
 * "가장 최근 1건"으로 결정론적으로 좁힌다.
 */

import { cache } from 'react';
import { cookies } from 'next/headers';
import { getSession } from './session';
import { getStore, type BrandProfileRecord } from '../db/store';

export const BRAND_COOKIE = 'yoake_brand';

/**
 * 내 브랜드 목록(요청 단위 메모) — 레이아웃과 getActiveBrand()가 같은 목록을 각각 조회하던 중복을 없앤다.
 * react cache 는 요청 스코프라 유저 간에 목록이 섞이지 않는다(키가 userId 이기도 하다).
 */
export const listMyBrands = cache(async (userId: string): Promise<BrandProfileRecord[]> => {
  const store = await getStore();
  return store.listBrandProfiles(userId);
});

/**
 * 이 계정의 브랜드 1건 — 없으면 null(=온보딩 상태).
 * 세션이 없으면(만료 직후 등) null. 과거에 여러 건이 만들어졌다면 최신 1건만 쓴다
 * (listBrandProfiles는 최신순). 남아 있는 쿠키 값은 내 목록 안에 있을 때만 존중한다.
 */
export const getActiveBrand = cache(async (): Promise<BrandProfileRecord | null> => {
  const session = await getSession();
  if (!session) return null;
  const brands = await listMyBrands(session.user.id);
  if (brands.length === 0) return null;
  const wanted = (await cookies()).get(BRAND_COOKIE)?.value;
  return brands.find((b) => b.id === wanted) ?? brands[0];
});

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
