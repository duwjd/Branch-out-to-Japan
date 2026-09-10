/**
 * POST /api/studio/detail/extract — 콜⑩ specExtract(§2-14). KR 상세 원본에서 스펙 7칸을 읽는다.
 *
 * 폼 단계에서 도는 **잡 예산 밖** 콜이다. 사용자가 화면 앞에서 기다리므로 자체 상한을 건다.
 * 이미지는 저장하지 않는다 — 폼이 아직 제출되지 않았고, 되돌아가도 쓰레기 파일이 남으면 안 된다.
 *
 * 인증을 요구한다. 결정적 계산인 `/outline` 과 달리 이 라우트는 **유료 LLM 콜**을 태우므로,
 * "비회원 열람 + 실행 직전 게이트" 정책에서 유료 콜만 로그인 뒤로 옮기는 `/plan` 의 선례를 따른다.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { uploadsToVisionImages } from '@/lib/server/visionImages';
import { callTimeout } from '@/lib/studio/detail/budget';
import { EXTRACT_FIELDS, runSpecExtract, type ExtractField } from '@/lib/studio/detail/extractCall';
import { logger } from '@/lib/logger';

/** 콜 상한 60초 + 이미지 축소·왕복 몫(§2-14). `/plan` 의 60초보다 조금 넉넉하다 */
export const maxDuration = 90;

/** 업로드 1장 상한 — 폼과 같은 규칙(`validateImages`) */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getSession())) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const form = await request.formData();

  // KR 상세 원본만 받는다. 제품컷은 배경이 깔끔한 단독컷이라 읽을 텍스트가 없다(§2-14)
  const files = form
    .getAll('images')
    .filter((f): f is File => f instanceof File && f.size > 0 && f.size <= MAX_UPLOAD_BYTES);

  // 이미 찬 칸은 콜에 싣지 않는다 — 덮지 않을 값을 읽어 올 이유가 없다
  const wantedRaw = String(form.get('wanted') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const wanted = wantedRaw.filter((f): f is ExtractField => (EXTRACT_FIELDS as readonly string[]).includes(f));

  // ── 걸지 않는 경로 3종. 비용·지연 0 이어야 한다 ─────────────────────────
  if (files.length === 0) {
    return NextResponse.json({ fields: {}, missing: [], skipped: 'no-source' });
  }
  if (wanted.length === 0) {
    return NextResponse.json({ fields: {}, missing: [], skipped: 'already-filled' });
  }

  const started = Date.now();
  try {
    const images = await uploadsToVisionImages(files);
    const result = await runSpecExtract({ images, wanted, timeoutMs: callTimeout('extract') });
    // 계기 — 실패 경로도 남긴다. 로그에 없으면 상한을 재조정할 근거가 안 생긴다(§2-14)
    logger.info('입력 자동 추출', {
      extractMs: Date.now() - started,
      extractFields: Object.keys(result.fields).length,
      wanted: wanted.length,
      images: images.length,
    });
    return NextResponse.json({ ...result, skipped: null });
  } catch (err) {
    const reason = String((err as Error)?.message ?? err);
    logger.warn('입력 자동 추출 실패 — 폼은 그대로 연다', { extractMs: Date.now() - started, extractError: reason });
    // 추출은 편의지 관문이 아니다. 실패해도 200 으로 돌려 폼이 수동 입력을 막지 않게 한다
    return NextResponse.json({
      fields: {},
      missing: [],
      skipped: null,
      error: '원본에서 입력을 읽지 못했습니다. 직접 입력하실 수 있습니다.',
    });
  }
}
