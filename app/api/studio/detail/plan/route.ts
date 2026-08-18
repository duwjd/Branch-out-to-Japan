/**
 * POST /api/studio/detail/plan — 블록 구성 + 입력 언어 변환 미리보기(부작용 없음).
 *
 * 확인 화면(② CONFIRM)이 쓰는 라우트다. 생성 전에 "어떤 블록이 들어가고 무엇이 왜 빠졌는지"를
 * 보여주기 위해, 제출 라우트와 **같은 파서·같은 planBlocks** 를 태워 동일한 결과를 낸다.
 * 이미지는 저장하지 않고 개수만 본다 — 사용자가 확인 단계에서 되돌아가도 쓰레기 파일이 남지 않는다.
 *
 * 콜⑧(입력 언어 변환)도 여기서 돈다. **한글이 하나도 없으면 콜을 만들지 않으므로**
 * 일본어로 입력한 사용자에게는 이 라우트의 비용·지연이 종전과 같다.
 */

import { NextResponse } from 'next/server';
import { parseDetailForm, parseImageMeta, validateImages } from '@/lib/server/detailForm';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { getSession } from '@/lib/server/session';
import { planBlocks } from '@/lib/studio/detail/blockPack';
import { MAX_AI_BLOCKS, outputProfile } from '@/lib/studio/detail/output';
import { currentImageMode } from '@/lib/studio/imageGen';
import { collectTranslatable, verifyClientTranslation, type TranslatedField } from '@/lib/studio/detail/translate';
import { runInputTranslate } from '@/lib/studio/detail/translateCall';
import { logger } from '@/lib/logger';

/**
 * 이 라우트는 **요청 경로에서** 콜⑧을 태운다(after() 가 아니다 — 결과를 화면이 바로 써야 한다).
 * 필드가 많은 최악 케이스 실측 22초라 기본값(Vercel Hobby 10초)으로는 프로덕션에서만 죽는다.
 * 300 이 아니라 60 인 이유: 배경 파이프라인이 아니라 사용자가 화면 앞에서 기다리는 콜이므로,
 * 멈춘 호출이 함수를 5분 붙잡게 두지 않는다(11 §3).
 */
export const maxDuration = 60;

/** 예상 소요 — 카피 1콜 + AI 블록(동시성 4) + 렌더·결합. 목 모드는 콜이 없어 훨씬 짧다. */
function estimateSeconds(aiBlocks: number, mock: boolean): number {
  if (mock) return 10 + aiBlocks * 2;
  const copy = 60;
  const waves = Math.ceil(aiBlocks / MAX_AI_BLOCKS);
  return copy + waves * 70 + 25;
}

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  // 이 라우트는 이미지 바이트를 저장하지도 읽지도 않는다 — 개수·형식·크기만 본다.
  // 화면은 그래서 파일 대신 메타(imageMeta)만 보낸다. 옛 클라이언트(파일 첨부)도 그대로 받는다.
  const meta =
    parseImageMeta(form) ?? form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  const imageError = validateImages(meta);
  if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });

  // 미리보기는 저장하지 않는다 — 경로는 개수만 맞춘 자리표시자
  const parsed = parseDetailForm(form, meta.map((_, i) => `preview-${i}`));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const plan = planBlocks(parsed.detailInput, parsed.platform, parsed.templateId, parsed.disabledBlocks);
  const profile = outputProfile(parsed.platform);
  const mock = currentImageMode() === 'mock';

  // ── 콜⑧ 입력 언어 변환 ───────────────────────────────────────────────────
  // 확인 화면에서 블록을 껐다 켜면 이 라우트가 다시 불린다. 그때마다 재번역하면 클릭 한 번에
  // LLM 콜이 하나씩 붙으므로, 화면이 들고 있던 결과를 함께 보내오면 **검증만** 하고 재사용한다.
  // 그 사이 입력이 바뀌었으면 원문 대조에서 걸려 complete=false 가 되고 그때만 다시 부른다.
  //
  // 실패해도 구성 미리보기는 살린다 — 변환은 확인 단계의 보조이고, 여기서 500을 내면
  // 사용자가 블록 구성 자체를 못 보게 된다.
  let translation: { fields: TranslatedField[]; artDirectionEn: string } | null = null;
  let translationError: string | null = null;
  /** 게스트에게는 변환을 미룬다 — 블록 구성은 그대로 보여준다(비회원 열람 정책) */
  let translationNeedsLogin = false;
  if (collectTranslatable(parsed.detailInput, parsed.note).length > 0) {
    const cached = parsed.clientTranslation
      ? verifyClientTranslation(parsed.detailInput, parsed.note, parsed.clientTranslation)
      : null;
    if (cached?.complete) {
      translation = { fields: cached.fields, artDirectionEn: cached.artDirectionEn };
    } else if (!(await getSession())) {
      // 이 라우트는 원래 결정적 계산뿐이라 인증이 없었다. 콜⑧이 붙으면서 **미인증 LLM 엔드포인트**가
      // 되므로, 유료 콜만 로그인 뒤로 옮긴다. 블록 구성(무료·결정적)은 게스트에게 그대로 준다 —
      // "비회원 열람 + 실행 직전 게이트"(2026-07-23) 정책을 깨지 않는다.
      // 로그인 없이 제출하면 어차피 401 이고, 제출 라우트가 그때 변환을 수행한다.
      translationNeedsLogin = true;
    } else {
      try {
        const brand = await getActiveBrand();
        const result = await runInputTranslate({
          input: parsed.detailInput,
          note: parsed.note,
          brandKit: brand?.brandKit,
        });
        translation = { fields: result.fields, artDirectionEn: result.artDirectionEn };
      } catch (err) {
        translationError = String((err as Error)?.message ?? err);
        logger.warn('입력 언어 변환 실패 — 구성 미리보기는 계속', { reason: translationError });
      }
    }
  }

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
    translation,
    translationError,
    translationNeedsLogin,
  });
}
