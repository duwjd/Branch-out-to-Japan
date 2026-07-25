/**
 * GET /api/studio/thumbnail/[id] — 자산 1건(폴링 겸 결과 — status 전용 라우트 분리하지 않음, 09 §4b).
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { getSession } from '@/lib/server/session';
import { sessionOwnsBrand } from '@/lib/server/ownership';
import { currentLlmMode } from '@/lib/engine/llm/client';
import { currentImageMode } from '@/lib/studio/imageGen';
import { logger } from '@/lib/logger';

// after() 잡이 함수 타임아웃 등으로 죽으면 generating이 영구 고착된다 — 폴링 시점에 실패 전환(11 §3)
const STALE_JOB_MS = 10 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const store = await getStore();
  const asset = await store.getAsset(id);
  if (!asset) return NextResponse.json({ error: '썸네일을 찾을 수 없습니다.' }, { status: 404 });
  // 소유 가드 — 비소유·게스트는 존재를 노출하지 않도록 not-found와 동일한 404로 응답
  if (!(await sessionOwnsBrand(asset.brandProfileId, await getSession()))) {
    return NextResponse.json({ error: '썸네일을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (asset.status === 'generating' && Date.now() - new Date(asset.updatedAt).getTime() > STALE_JOB_MS) {
    asset.status = 'failed';
    asset.error = '처리 시간이 초과되었습니다. 다시 시도해 주세요.';
    await store.updateAsset(id, { status: 'failed', error: asset.error });
    logger.warn('썸네일 잡 스테일 실패 전환', { assetId: id });
  }

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
