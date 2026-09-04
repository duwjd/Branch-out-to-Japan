/**
 * GET /api/studio/detail/[id]/status — 상세페이지 진행 상태만(폴링 전용).
 *
 * 왜 별도 라우트인가: 기존 `GET /api/studio/detail/[id]` 는 결과물 전문을 돌려준다
 * (블록별 일본어 카피 · gateResult 노트 · explanationJson · detailInput 스냅샷).
 * 그걸 2.5초마다 받아 4개 필드만 쓰고 버리는 게 진행 패널(JobPanel)의 동작이었다.
 * 여기서는 진행률과 변경 감지에 필요한 것만 준다 — 화면은 `revision` 이 바뀔 때만
 * 무거운 라우트를 한 번 더 부르면 된다.
 *
 * 리포트 쪽 `GET /api/report/[id]/status` 와 같은 역할이다.
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { getSession } from '@/lib/server/session';
import { sessionOwnsBrand } from '@/lib/server/ownership';
import { logger } from '@/lib/logger';

// after() 잡이 함수 타임아웃 등으로 죽으면 generating이 영구 고착된다 — 폴링 시점에 실패 전환(11 §3)
const STALE_JOB_MS = 10 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const store = await getStore();
  const asset = await store.getAssetStatus(id);
  if (!asset || asset.kind !== 'detail') {
    return NextResponse.json({ error: '상세페이지를 찾을 수 없습니다.' }, { status: 404 });
  }
  // 소유 가드 — 비소유·게스트는 존재를 노출하지 않도록 not-found와 동일한 404
  if (!(await sessionOwnsBrand(asset.brandProfileId, await getSession()))) {
    return NextResponse.json({ error: '상세페이지를 찾을 수 없습니다.' }, { status: 404 });
  }

  let { status, error } = asset;
  if (status === 'generating' && Date.now() - new Date(asset.updatedAt).getTime() > STALE_JOB_MS) {
    status = 'failed';
    error = '처리 시간이 초과되었습니다. 다시 시도해 주세요.';
    await store.updateAsset(id, { status: 'failed', stage: null, error });
    logger.warn('상세페이지 잡 스테일 실패 전환', { assetId: id });
  }

  const blocks = await store.listBlockStatuses(id);
  // 블록 재생성은 자산 상태를 바꾸지 않으므로(자산은 done 그대로) 블록 status·version 도 지문에 넣는다
  const blockBusy = blocks.some((b) => b.status === 'generating');

  return NextResponse.json({
    id,
    status,
    stage: asset.stage,
    error,
    blockTotal: asset.blockTotal,
    blockDone: asset.blockDone,
    blockBusy,
    /** 내용 변경 지문 — 값이 바뀌었을 때만 전체 라우트를 다시 부르면 된다 */
    revision: `${status}:${asset.stage ?? ''}:${asset.blockDone}/${asset.blockTotal}:${blocks
      .map((b) => `${b.id}@${b.version}${b.status}`)
      .join(',')}`,
  });
}
