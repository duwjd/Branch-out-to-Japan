/**
 * POST /api/products/identify — 제품컷으로 제품 후보를 찾는다(BRAND-03b 3b-5).
 *
 * **보조 라우트다.** 실패해도 200 으로 빈 후보를 돌려준다 — 제품 등록은 이 콜 없이도
 * 지금까지처럼 끝나야 하고, 여기서 500 을 내면 등록 화면이 오류를 띄우게 된다.
 *
 * 이미지를 저장하지 않는다. 제품은 아직 만들어지지 않았고, 저장은 등록 시점에 일어난다.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { toVisionImage } from '@/lib/server/visionImages';
import { runProductIdentify } from '@/lib/studio/detail/identifyCall';
import { logger } from '@/lib/logger';

/** 검색 왕복이 붙어 추출(90초)보다 넉넉해야 한다 */
export const maxDuration = 120;

/** 콜 자체의 상한. 라우트 상한보다 짧게 둬 함수가 잘리기 전에 콜이 먼저 끊긴다 */
const IDENTIFY_TIMEOUT_MS = 90_000;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getSession())) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    // 제품컷이 없으면 걸지 X — 비용·지연 0
    return NextResponse.json({ candidates: [], skipped: 'no-image' });
  }

  const started = Date.now();
  try {
    const image = await toVisionImage(Buffer.from(await file.arrayBuffer()));
    const result = await runProductIdentify({
      image,
      brandName: String(form.get('brandName') ?? '').trim() || undefined,
      nameHint: String(form.get('nameHint') ?? '').trim() || undefined,
      timeoutMs: IDENTIFY_TIMEOUT_MS,
    });
    logger.info('제품 식별 검색', {
      identifyMs: Date.now() - started,
      candidates: result.candidates.length,
      ...(result.toolError ? { toolError: result.toolError } : {}),
    });
    return NextResponse.json({ candidates: result.candidates, skipped: null });
  } catch (err) {
    // 검색 실패는 등록 실패가 아니다. 화면은 수동 입력을 그대로 연다
    logger.warn('제품 식별 검색 실패 — 수동 입력은 그대로', {
      identifyMs: Date.now() - started,
      identifyError: String((err as Error)?.message ?? err),
    });
    return NextResponse.json({ candidates: [], skipped: null, error: '웹에서 이 제품을 찾지 못했습니다.' });
  }
}
