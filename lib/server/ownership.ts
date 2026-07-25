/**
 * 소유 검증 헬퍼 — "레코드 → 브랜드 → userId === 세션 유저 id" 사슬을 한곳에서 확인한다.
 *
 * 상세 라우트/페이지는 레코드 id만으로 데이터를 서빙하면 안 된다(uuid를 아는 타 유저 열람 방지).
 * 레코드는 brandProfileId를 갖고, 브랜드는 userId(M1)를 갖는다 — 이 사슬로 소유자를 판정한다.
 *
 * 레거시 데이터: brandProfileId 없는 구 레코드는 store가 LEGACY_BRAND_ID('default')로 귀속하고,
 * 그 브랜드의 userId는 LEGACY_USER_ID('demo-user')로 귀속한다(supabaseStore 매핑) — 데모 세션이 소유한다.
 */

import type { Session } from './session';
import { getStore } from '../db/store';

/**
 * 세션 유저가 해당 브랜드의 소유자인지 판정한다.
 * @param brandProfileId 검증 대상 레코드의 소속 브랜드 id(없으면 소유 불가)
 * @param session 현재 세션(게스트=null이면 항상 false)
 * @returns 세션 유저가 브랜드 소유자면 true, 게스트·비소유·브랜드 없음이면 false
 */
export async function sessionOwnsBrand(
  brandProfileId: string | null | undefined,
  session: Session | null,
): Promise<boolean> {
  if (!session || !brandProfileId) return false;
  const store = await getStore();
  const brand = await store.getBrandProfile(brandProfileId);
  return brand?.userId === session.user.id;
}
