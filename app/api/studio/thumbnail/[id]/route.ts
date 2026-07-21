/**
 * GET /api/studio/thumbnail/[id] — 자산 1건(폴링 겸 결과 — status 전용 라우트 분리하지 않음, 09 §4b).
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const store = await getStore();
  const asset = await store.getAsset(id);
  if (!asset) return NextResponse.json({ error: '썸네일을 찾을 수 없습니다.' }, { status: 404 });

  return NextResponse.json({
    ...asset,
    storeKind: store.kind(),
    imageUrl: asset.imagePath ? `/api/files/${asset.imagePath}` : null,
    originalUrl: `/api/files/${asset.originalImagePath}`,
  });
}
