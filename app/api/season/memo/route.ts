/**
 * GET·POST /api/season/memo — 활성 브랜드의 시즌 캘린더 메모(SEASON-03) 조회·생성.
 * 조회·기록만 한다. 예약·발행·알림 트리거를 여기에 붙이지 않는다(금지 포지션).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getActiveBrand, getActiveBrandId } from '@/lib/server/activeBrand';
import { getStore } from '@/lib/db/store';
import { parseSeasonMemo } from '@/lib/server/seasonMemo';
import { logger } from '@/lib/logger';

export async function GET(): Promise<NextResponse> {
  const store = await getStore();
  const brandId = await getActiveBrandId();
  const memos = brandId ? await store.listSeasonMemos(brandId) : [];
  return NextResponse.json({ memos });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const brand = await getActiveBrand();
  if (!brand) return NextResponse.json({ error: '브랜드를 먼저 등록해 주세요.' }, { status: 400 });

  const parsed = parseSeasonMemo(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const store = await getStore();
  const memo = await store.createSeasonMemo({ brandProfileId: brand.id, ...parsed });
  logger.info('시즌 메모 생성', { memoId: memo.id, brandProfileId: brand.id, startDate: memo.startDate });
  return NextResponse.json({ memo }, { status: 201 });
}
