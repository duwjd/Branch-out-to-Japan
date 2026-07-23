/**
 * GET /api/studio/thumbnail/[id] — 자산 1건(폴링 겸 결과 — status 전용 라우트 분리하지 않음, 09 §4b).
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { currentLlmMode } from '@/lib/engine/llm/client';
import { currentImageMode } from '@/lib/studio/imageGen';

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
    // 목 모드 계약(RESULT-01·02·04) — 배지·데모 파일명 판단용(환경 고정값이라 조회 시점 판정 정확)
    imageMode: currentImageMode(),
    llmMode: currentLlmMode(),
    imageUrl: asset.imagePath ? `/api/files/${asset.imagePath}` : null,
    originalUrl: `/api/files/${asset.originalImagePath}`,
    // F 모델+카피형 Before 병기용(RESULT-01) — 모델컷 없으면 null
    modelImageUrl: asset.modelImagePath ? `/api/files/${asset.modelImagePath}` : null,
  });
}
