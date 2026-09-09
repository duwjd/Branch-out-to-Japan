/**
 * POST /api/studio/detail/outline — 블록 보드용 경량 구성 계산(부작용 없음 · LLM 미개입).
 *
 * 폼의 블록 보드(DETAIL-01e)가 입력이 바뀔 때마다 디바운스로 부르는 라우트다.
 * `/api/studio/detail/plan` 과 **같은 파서·같은 planBlocks** 를 태우므로 결과가 어긋나지 않는다.
 * 다른 점은 하나 — 콜⑧(입력 언어 변환)을 태우지 않는다.
 *
 * `/plan` 을 그대로 쓸 수 없는 이유: 그쪽은 필드가 많은 최악 케이스 실측 22초이고 과금된다.
 * 타이핑할 때마다 부르는 라우트가 그럴 수는 없다. `planBlocks` 자체는 결정적이라 왕복이 싸다.
 * `/plan` 은 확인 단계용으로 그대로 둔다.
 *
 * 인증을 요구하지 않는다 — 결정적 계산이고 유료 콜이 없다. "비회원 열람 + 실행 직전 게이트"
 * 정책(2026-07-23)을 그대로 따른다.
 */

import { NextResponse } from 'next/server';
import { parseDetailForm, parseImageMeta, validateImages } from '@/lib/server/detailForm';
import { planBlocks } from '@/lib/studio/detail/blockPack';

/** 결정적 계산만 돈다. 콜⑧이 없으므로 `/plan` 의 60초 연장이 필요 없다. */
export const maxDuration = 10;

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  // 이미지 바이트를 저장하지도 읽지도 않는다 — 개수·형식·크기만 본다(`/plan` 과 동일)
  const meta = parseImageMeta(form) ?? form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  const imageError = validateImages(meta);
  if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });

  const parsed = parseDetailForm(
    form,
    meta.map((_, i) => `outline-${i}`),
  );
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const plan = planBlocks(parsed.detailInput, parsed.platform, parsed.templateId, parsed.disabledBlocks);

  // 보드의 3분류는 화면이 fields 길이로 가른다(DETAIL-01e 1e-5) — 서버가 분류를 확정하지 않는다.
  // 판정 규칙을 한 곳에만 두려면 재료만 주고 표기는 화면이 하는 편이 낫다.
  return NextResponse.json({
    templateId: plan.templateId,
    aiBlockCount: plan.aiBlockCount,
    blocks: plan.blocks.map((b) => ({
      blockId: b.blockId,
      code: b.code,
      nameKo: b.nameKo,
      renderKind: b.renderKind,
      layer: b.layer,
      signature: b.signature,
    })),
    excluded: plan.excluded,
  });
}
