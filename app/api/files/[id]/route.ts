/**
 * GET /api/files/[id] — 로컬 저장 파일 서빙(08 §6.2 개정 — 파일은 .data/files/, DB에는 fileId만).
 * fileId가 uuid라 내용 불변 — immutable 캐시를 준다.
 */

import { NextResponse } from 'next/server';
import { readStoredFile } from '@/lib/files/storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse | Response> {
  const { id } = await params;
  const file = await readStoredFile(id);
  if (!file) return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });

  return new Response(new Uint8Array(file.buf), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
