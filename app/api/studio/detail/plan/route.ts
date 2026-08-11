/**
 * POST /api/studio/detail/plan — 블록 구성 미리보기(부작용 없음).
 *
 * 확인 화면(② CONFIRM)이 쓰는 라우트다. 생성 전에 "어떤 블록이 들어가고 무엇이 왜 빠졌는지"를
 * 보여주기 위해, 제출 라우트와 **같은 파서·같은 planBlocks** 를 태워 동일한 결과를 낸다.
 * 이미지는 저장하지 않고 개수만 본다 — 사용자가 확인 단계에서 되돌아가도 쓰레기 파일이 남지 않는다.
 */

import { NextResponse } from 'next/server';
import { parseDetailForm, validateImages } from '@/lib/server/detailForm';
import { planBlocks } from '@/lib/studio/detail/blockPack';
import { MAX_AI_BLOCKS, outputProfile } from '@/lib/studio/detail/output';
import { currentImageMode } from '@/lib/studio/imageGen';

/** 예상 소요 — 카피 1콜 + AI 블록(동시성 4) + 렌더·결합. 목 모드는 콜이 없어 훨씬 짧다. */
function estimateSeconds(aiBlocks: number, mock: boolean): number {
  if (mock) return 10 + aiBlocks * 2;
  const copy = 60;
  const waves = Math.ceil(aiBlocks / MAX_AI_BLOCKS);
  return copy + waves * 70 + 25;
}

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const files = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  const imageError = validateImages(files);
  if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });

  // 미리보기는 저장하지 않는다 — 경로는 개수만 맞춘 자리표시자
  const parsed = parseDetailForm(form, files.map((_, i) => `preview-${i}`));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const plan = planBlocks(parsed.detailInput, parsed.platform, parsed.templateId, parsed.disabledBlocks);
  const profile = outputProfile(parsed.platform);
  const mock = currentImageMode() === 'mock';

  return NextResponse.json({
    templateId: plan.templateId,
    aiBlockCount: plan.aiBlockCount,
    estimateSeconds: estimateSeconds(plan.aiBlockCount, mock),
    imageMode: currentImageMode(),
    output: { width: profile.width, sliceHeight: profile.sliceHeight, note: profile.note },
    blocks: plan.blocks.map((b) => ({
      blockId: b.blockId,
      code: b.code,
      nameKo: b.nameKo,
      renderKind: b.renderKind,
      layer: b.layer,
      signature: b.signature,
      /** 필수 블록은 확인 화면에서 끌 수 없다 — 표시 의무·구조가 무너진다 */
      required: ['hero-product', 'point-list', 'product-spec-table', 'footnote-block'].includes(b.blockId),
    })),
    excluded: plan.excluded,
  });
}
