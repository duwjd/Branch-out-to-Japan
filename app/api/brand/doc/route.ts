/**
 * POST /api/brand/doc — 상세페이지 문서 업로드(BRAND-03). 파일은 로컬 저장, 프로필엔 fileId+원본명.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { getStore } from '@/lib/db/store';
import { extForMime, saveFile } from '@/lib/files/storage';
import { logger } from '@/lib/logger';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const store = await getStore();
  const existing = await getActiveBrand();
  if (!existing) {
    return NextResponse.json({ error: '브랜드 프로필을 먼저 저장해 주세요.' }, { status: 400 });
  }

  const form = await request.formData();
  const doc = form.get('doc');
  if (!(doc instanceof File) || doc.size === 0) {
    return NextResponse.json({ error: '업로드할 문서를 선택해 주세요.' }, { status: 400 });
  }
  const ext = extForMime(doc.type);
  if (!ext) return NextResponse.json({ error: 'PDF·JPG·PNG·WebP만 업로드할 수 있습니다.' }, { status: 400 });
  if (doc.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: '10MB 이하 파일만 업로드할 수 있습니다.' }, { status: 400 });
  }

  const fileId = await saveFile(Buffer.from(await doc.arrayBuffer()), ext, 'doc');
  await store.saveBrandProfile({
    ...existing,
    detailDocPath: fileId,
    detailDocName: doc.name.slice(0, 120),
    updatedAt: new Date().toISOString(),
  });
  logger.info('상세페이지 문서 업로드', { fileId, name: doc.name });
  return NextResponse.json({ detailDocPath: fileId, detailDocName: doc.name.slice(0, 120) });
}
