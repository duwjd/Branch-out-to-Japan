/**
 * 파일 저장 — 로컬 `.data/files/` 우선(스프린트 2 결정, 08 §6.2 개정).
 * 스토어·화면은 fileId만 알고, 서빙은 GET /api/files/[id]가 담당한다.
 * Supabase Storage 전환 시 이 파일의 함수 2개 내부만 교체한다(추상 인터페이스 금지 — 09 §4b).
 */

import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const FILES_DIR = path.join(process.cwd(), '.data', 'files');

export type StoredFileExt = 'png' | 'jpg' | 'webp' | 'pdf';

const CONTENT_TYPES: Record<StoredFileExt, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** MIME 타입 → 저장 확장자 (업로드 검증을 통과한 타입만) */
export function extForMime(mime: string): StoredFileExt | null {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return null;
}

/** fileId 검증 — 경로 탈출 차단(파일명 화이트리스트) */
const FILE_ID_RE = /^[a-z]+-[0-9a-f-]{36}\.(png|jpe?g|webp|pdf)$/;

/**
 * 파일을 저장하고 fileId를 반환한다. 사용자 입력(브랜드명 등)은 파일명에 넣지 않는다 —
 * 다운로드 파일명은 클라이언트 download 속성 몫(RESULT-04).
 */
export async function saveFile(buf: Buffer, ext: StoredFileExt, prefix: 'orig' | 'thumb' | 'doc'): Promise<string> {
  if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });
  const fileId = `${prefix}-${randomUUID()}.${ext}`;
  await writeFile(path.join(FILES_DIR, fileId), buf);
  return fileId;
}

/** fileId로 파일을 읽는다 — 없거나 형식이 틀리면 null */
export async function readStoredFile(fileId: string): Promise<{ buf: Buffer; contentType: string } | null> {
  if (!FILE_ID_RE.test(fileId)) return null;
  const filePath = path.join(FILES_DIR, fileId);
  if (!existsSync(filePath)) return null;
  const ext = fileId.split('.').pop() as StoredFileExt;
  return { buf: await readFile(filePath), contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream' };
}
