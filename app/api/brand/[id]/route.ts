/**
 * POST /api/brand/[id] — 활성 브랜드 전환(스위처 MAIN-01).
 * DELETE /api/brand/[id] — 브랜드 삭제(BRAND-10) — 종속 자산 cascade.
 * 마지막 브랜드는 삭제 불가(회원 탈퇴로 안내) · 삭제 확인은 브랜드명 재입력.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getStore } from '@/lib/db/store';
import { getActiveBrandId, setActiveBrand } from '@/lib/server/activeBrand';
import { logger } from '@/lib/logger';

/** 활성 브랜드 전환 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const store = await getStore();
  const brand = await store.getBrandProfile(id);
  if (!brand) return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 });

  await setActiveBrand(id);
  logger.info('활성 브랜드 전환', { brandProfileId: id, brandName: brand.brandName });
  return NextResponse.json({ ok: true, activeBrandId: id });
}

/** 브랜드 삭제 — 확인 문구(브랜드명)로 검증, 마지막 브랜드는 거부 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const store = await getStore();
  const brands = await store.listBrandProfiles();
  const target = brands.find((b) => b.id === id);
  if (!target) return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 });

  // 마지막 브랜드는 삭제하지 않는다 — 브랜드 0개 상태를 만들지 않고 회원 탈퇴로 안내(BRAND-10)
  if (brands.length <= 1) {
    return NextResponse.json(
      { error: '마지막 브랜드는 삭제할 수 없습니다. 서비스를 그만두려면 마이페이지에서 회원 탈퇴를 진행해 주세요.' },
      { status: 400 },
    );
  }

  // 삭제 확인 — 브랜드명 재입력 일치(오삭제 방지)
  let confirmName = '';
  try {
    const body = (await request.json()) as { confirmName?: unknown };
    confirmName = typeof body.confirmName === 'string' ? body.confirmName.trim() : '';
  } catch {
    /* 본문 없음 = 미확인 */
  }
  if (confirmName !== target.brandName.trim()) {
    return NextResponse.json({ error: '삭제하려면 브랜드명을 정확히 입력해 주세요.' }, { status: 400 });
  }

  await store.deleteBrandProfile(id);

  // 삭제한 브랜드가 활성이었으면 최근 브랜드로 자동 전환(BRAND-10)
  const activeId = await getActiveBrandId();
  const nextActive = brands.find((b) => b.id !== id) ?? null; // listBrandProfiles는 최신순
  if ((activeId === id || activeId === null) && nextActive) {
    await setActiveBrand(nextActive.id);
  }
  logger.info('브랜드 삭제', { brandProfileId: id, brandName: target.brandName });
  return NextResponse.json({ ok: true, activeBrandId: nextActive?.id ?? null });
}
