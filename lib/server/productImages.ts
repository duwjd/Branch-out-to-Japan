/**
 * 제품 이미지 업로드 헬퍼(BRAND-03b) — FormData File 목록을 저장해 ProductImage[]로 만든다.
 * /api/products (생성)·/api/products/[id] (편집) 공용. 첫 장이 자동 대표.
 */

import { extForMime, saveFile } from '../files/storage';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/** 새로 올린 이미지 File들을 저장하고 fileId 배열을 업로드 순서대로 반환한다(대표 지정은 라우트가 함) */
export async function saveProductImages(files: File[]): Promise<{ fileIds: string[] } | { error: string }> {
  const fileIds: string[] = [];
  for (const f of files) {
    if (!IMAGE_MIMES.includes(f.type)) return { error: 'JPG·PNG·WebP만 올릴 수 있습니다.' };
    if (f.size > MAX_UPLOAD_BYTES) return { error: '10MB 이하 이미지만 올릴 수 있습니다.' };
    const ext = extForMime(f.type);
    if (!ext || ext === 'pdf') return { error: '지원하지 않는 이미지 형식입니다.' };
    fileIds.push(await saveFile(Buffer.from(await f.arrayBuffer()), ext, 'product'));
  }
  return { fileIds };
}
