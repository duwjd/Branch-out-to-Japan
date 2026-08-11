/**
 * PATCH /api/studio/detail/[id]/blocks/[blockId] — 슬롯 텍스트 직접 수정 후 재렌더(AI 콜 0).
 * POST  /api/studio/detail/[id]/blocks/[blockId] — { action: 'regenerate' | 'revert' }
 *
 * 텍스트 블록은 문자를 벡터로 그리므로 카피 수정이 무료·즉시다 — 이게 하이브리드 렌더링의 부수 효과다.
 */

import { NextResponse, after } from 'next/server';
import { getStore } from '@/lib/db/store';
import { getSession } from '@/lib/server/session';
import { sessionOwnsBrand } from '@/lib/server/ownership';
import { recomposeDetail, regenerateBlock, type RegenerateMode } from '@/lib/server/detailJob';
import { logger } from '@/lib/logger';

export const maxDuration = 300;

const MODES: RegenerateMode[] = ['visual', 'copy', 'both'];

/** 자산·블록 소유 확인 — 비소유는 존재를 노출하지 않도록 404 */
async function guard(assetId: string, blockId: string) {
  const store = await getStore();
  const asset = await store.getAsset(assetId);
  if (!asset || asset.kind !== 'detail') return null;
  if (!(await sessionOwnsBrand(asset.brandProfileId, await getSession()))) return null;
  const block = await store.getBlock(blockId);
  if (!block || block.assetId !== assetId) return null;
  return { store, asset, block };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> },
): Promise<NextResponse> {
  const { id, blockId } = await params;
  const ctx = await guard(id, blockId);
  if (!ctx) return NextResponse.json({ error: '블록을 찾을 수 없습니다.' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { slots?: Record<string, string> } | null;
  if (!body?.slots || typeof body.slots !== 'object') {
    return NextResponse.json({ error: '수정할 슬롯이 없습니다.' }, { status: 400 });
  }

  // 팩에 없는 키는 무시한다 — 임의 슬롯 주입으로 렌더 트리를 흔들 수 없게 한다
  const merged = { ...ctx.block.slots };
  for (const [k, v] of Object.entries(body.slots)) {
    if (k in ctx.block.slots) merged[k] = String(v);
  }
  await ctx.store.updateBlock(blockId, { slots: merged });

  try {
    // AI 콜 없이 재렌더 + 재결합만 — 실측 3~4초라 동기 처리해도 된다
    await regenerateBlock(id, blockId, 'copy');
  } catch (err) {
    return NextResponse.json({ error: String((err as Error)?.message ?? err) }, { status: 500 });
  }
  logger.info('블록 슬롯 수정', { assetId: id, blockId });
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> },
): Promise<NextResponse> {
  const { id, blockId } = await params;
  const ctx = await guard(id, blockId);
  if (!ctx) return NextResponse.json({ error: '블록을 찾을 수 없습니다.' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as
    | { action?: string; mode?: string; note?: string; version?: number }
    | null;
  const action = body?.action ?? 'regenerate';

  if (action === 'revert') {
    const target = ctx.block.history.find((h) => h.version === body?.version) ?? ctx.block.history.at(-1);
    if (!target) return NextResponse.json({ error: '되돌릴 이전 버전이 없습니다.' }, { status: 400 });
    await ctx.store.updateBlock(blockId, {
      imagePath: target.imagePath,
      visualPath: target.visualPath,
      status: 'done',
      error: null,
    });
    await recomposeDetail(id);
    logger.info('블록 되돌리기', { assetId: id, blockId, version: target.version });
    return NextResponse.json({ ok: true });
  }

  if (action !== 'regenerate') {
    return NextResponse.json({ error: '지원하지 않는 동작입니다.' }, { status: 400 });
  }

  const mode = (MODES as string[]).includes(String(body?.mode)) ? (body!.mode as RegenerateMode) : 'both';
  if (mode !== 'copy' && ctx.block.renderKind === 'text') {
    return NextResponse.json({ error: '이 블록은 이미지 생성 없이 문자만 렌더합니다.' }, { status: 400 });
  }

  // 이미지 재생성은 40~90초라 즉시 202로 응답하고 폴링에 맡긴다(제출 라우트와 같은 계약)
  await ctx.store.updateBlock(blockId, { status: 'generating', error: null });
  after(async () => {
    try {
      await regenerateBlock(id, blockId, mode, body?.note);
    } catch {
      /* regenerateBlock이 이미 실패 상태를 기록한다 */
    }
  });
  return NextResponse.json({ blockId, version: ctx.block.version + 1 }, { status: 202 });
}
