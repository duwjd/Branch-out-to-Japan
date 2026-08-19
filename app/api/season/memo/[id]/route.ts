/**
 * PUT·DELETE /api/season/memo/[id] — 시즌 캘린더 메모 편집·삭제(SEASON-03).
 * 타 유저 메모 접근은 존재를 노출하지 않도록 not-found와 같은 404로 막는다.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { sessionOwnsBrand } from '@/lib/server/ownership';
import { getStore } from '@/lib/db/store';
import { parseSeasonMemo } from '@/lib/server/seasonMemo';
import { logger } from '@/lib/logger';

/** 세션 소유 메모만 돌려준다 — 비소유·미존재는 구분하지 않는다 */
async function ownedMemo(id: string) {
  const session = await getSession();
  if (!session) return { status: 401 as const };
  const store = await getStore();
  const memo = await store.getSeasonMemo(id);
  if (!memo || !(await sessionOwnsBrand(memo.brandProfileId, session))) return { status: 404 as const };
  return { status: 200 as const, store, memo };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const found = await ownedMemo(id);
  if (found.status === 401) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (found.status === 404) return NextResponse.json({ error: '메모를 찾을 수 없습니다.' }, { status: 404 });

  const parsed = parseSeasonMemo(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await found.store.updateSeasonMemo(id, parsed);
  logger.info('시즌 메모 편집', { memoId: id, startDate: parsed.startDate });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const found = await ownedMemo(id);
  if (found.status === 401) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (found.status === 404) return NextResponse.json({ error: '메모를 찾을 수 없습니다.' }, { status: 404 });

  await found.store.deleteSeasonMemo(id);
  logger.info('시즌 메모 삭제', { memoId: id });
  return NextResponse.json({ ok: true });
}
