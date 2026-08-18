/**
 * GET /api/files/[id] — 저장 파일 서빙(08 §6.2 개정 — 파일은 Storage/.data/files/, DB에는 fileId만).
 * fileId가 uuid라 내용 불변 — immutable 캐시를 준다.
 *
 * Supabase 모드에서는 **서명 URL로 302 리다이렉트**한다. 예전처럼 함수가 파일을 통째로
 * 메모리에 내려받아 재서빙하면, 라이브러리 그리드처럼 이미지가 여러 장인 화면에서
 * 카드 수만큼 서버리스 실행 + Supabase 왕복 + 전량 버퍼링이 붙는다(상세페이지 결합본은
 * 장당 수백 KB). 리다이렉트하면 바이트는 Storage CDN이 직접 준다.
 * 로컬 파일 폴백(dev)은 CDN이 없으므로 종전대로 버퍼 응답한다.
 */

import { NextResponse } from 'next/server';
import { getSignedFileUrl, readStoredFile } from '@/lib/files/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse | Response> {
  const { id } = await params;

  // `?download=1` 은 리다이렉트하지 않는다 — 다운로드 버튼이 fetch().blob() 으로 받아
  // a[download] 로 파일명을 붙이는데, 교차 출처로 넘기면 CORS 와 파일명이 걸린다.
  const wantsBytes = new URL(request.url).searchParams.get('download') === '1';

  const signed = wantsBytes ? null : await getSignedUrlSafely(id);
  if (signed) {
    // 리다이렉트 자체는 짧게만 캐시한다 — 서명이 만료된 URL을 브라우저가 계속 재사용하면 안 된다.
    return NextResponse.redirect(signed, {
      status: 302,
      headers: { 'Cache-Control': 'private, max-age=600' },
    });
  }

  const file = await readStoredFile(id);
  if (!file) return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });

  return new Response(new Uint8Array(file.buf), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

/** 서명 URL 발급 — 실패하면 null 을 돌려 버퍼 응답으로 폴백한다(이미지가 깨지지 않게) */
async function getSignedUrlSafely(id: string): Promise<string | null> {
  try {
    return await getSignedFileUrl(id);
  } catch {
    return null;
  }
}
