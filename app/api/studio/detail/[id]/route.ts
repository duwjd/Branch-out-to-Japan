/**
 * GET /api/studio/detail/[id] — 자산 1건 + 블록 배열(폴링 겸 결과).
 * 썸네일과 달리 blocks 단계가 길어 blockDone/blockTotal 진행률을 함께 준다.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { getSession } from '@/lib/server/session';
import { sessionOwnsBrand } from '@/lib/server/ownership';
import { currentLlmMode } from '@/lib/engine/llm/client';
import { currentImageMode } from '@/lib/studio/imageGen';
import { blockDisplayMeta } from '@/lib/server/detailJob';
import { logger } from '@/lib/logger';
import { normalizeExplanation } from '@/lib/studio/explanation';

// after() 잡이 함수 타임아웃 등으로 죽으면 generating이 영구 고착된다 — 폴링 시점에 실패 전환(11 §3)
const STALE_JOB_MS = 10 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const store = await getStore();
  const asset = await store.getAsset(id);
  if (!asset || asset.kind !== 'detail') {
    return NextResponse.json({ error: '상세페이지를 찾을 수 없습니다.' }, { status: 404 });
  }
  // 소유 가드 — 비소유·게스트는 존재를 노출하지 않도록 not-found와 동일한 404
  if (!(await sessionOwnsBrand(asset.brandProfileId, await getSession()))) {
    return NextResponse.json({ error: '상세페이지를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (asset.status === 'generating' && Date.now() - new Date(asset.updatedAt).getTime() > STALE_JOB_MS) {
    asset.status = 'failed';
    asset.error = '처리 시간이 초과되었습니다. 다시 시도해 주세요.';
    await store.updateAsset(id, { status: 'failed', stage: null, error: asset.error });
    logger.warn('상세페이지 잡 스테일 실패 전환', { assetId: id });
  }

  const blocks = await store.listBlocks(id);

  return NextResponse.json({
    ...asset,
    // 계약이 바뀌기 전에 저장된 해설도 현재 모양으로 맞춰 내려보낸다(마이그레이션 없음)
    explanationJson: normalizeExplanation(asset.explanationJson),
    storeKind: store.kind(),
    imageMode: currentImageMode(),
    llmMode: currentLlmMode(),
    // 결합본(master JPEG) — 화면 미리보기·승인용
    imageUrl: asset.imagePath ? `/api/files/${asset.imagePath}` : null,
    originalUrl: `/api/files/${asset.originalImagePath}`,
    // 몰 업로드용 분할본 — 라쿠텐 R-Cabinet 1장 3840px·2MB 제한 때문에 실제 업로드 대상이다
    sliceUrls: asset.slicePaths.map((p) => `/api/files/${p}`),
    blocks: blocks.map((b) => {
      const meta = blockDisplayMeta(b.blockType);
      return {
        id: b.id,
        seq: b.seq,
        blockType: b.blockType,
        code: meta.code,
        nameKo: meta.nameKo,
        role: meta.role,
        renderKind: b.renderKind,
        status: b.status,
        error: b.error,
        height: b.height,
        version: b.version,
        canRevert: b.history.length > 0,
        slots: b.slots,
        imageUrl: b.imagePath ? `/api/files/${b.imagePath}` : null,
      };
    }),
  });
}
