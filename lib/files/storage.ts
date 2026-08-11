/**
 * 파일 저장 — Supabase env 있으면 Storage private 버킷 `files`, 없으면 로컬 `.data/files/` 폴백
 * (store.ts:getStore()와 동일한 선택 기준 — 서버리스 배포에서 로컬 FS는 비영속이라 Storage 필수, 11 §1).
 * 스토어·화면은 fileId만 알고, 서빙은 GET /api/files/[id]가 담당한다.
 * 저장 백엔드 교체는 이 파일의 함수 2개 내부만 바꾼다(추상 인터페이스 금지 — 09 §4b).
 */

import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getSupabaseClient, hasSupabaseEnv } from '../db/supabaseClient';

const FILES_DIR = path.join(process.cwd(), '.data', 'files');
const BUCKET = 'files';

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
export async function saveFile(
  buf: Buffer,
  ext: StoredFileExt,
  // 'blk'·'slice'·'detail'은 ② 상세페이지 산출물 — 블록 PNG / 몰 분할본 / 결합본
  prefix: 'orig' | 'thumb' | 'doc' | 'model' | 'product' | 'blk' | 'slice' | 'detail',
): Promise<string> {
  const fileId = `${prefix}-${randomUUID()}.${ext}`;
  if (hasSupabaseEnv()) {
    const { error } = await getSupabaseClient()
      .storage.from(BUCKET)
      .upload(fileId, buf, { contentType: CONTENT_TYPES[ext] });
    if (error) throw new Error(`supabase storage upload 실패: ${error.message}`);
    return fileId;
  }
  if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });
  await writeFile(path.join(FILES_DIR, fileId), buf);
  return fileId;
}

/**
 * 서명 URL 유효 기간(초) — 브라우저 캐시 수명과 별개로, 링크가 새어도 곧 만료되게 한다.
 * 결과 화면에서 열어 둔 이미지가 도중에 깨지지 않을 만큼은 길어야 한다.
 */
const SIGNED_URL_TTL_SEC = 60 * 60;

/**
 * fileId → Supabase Storage 서명 URL. 로컬 폴백 모드(파일 스토어)나 실패 시 null.
 *
 * 왜 필요한가: private 버킷 파일을 서버리스 함수가 통째로 메모리에 내려받아 재서빙하면
 * (readStoredFile → Response) 이미지 1장마다 함수 실행 + Supabase 왕복 + 전량 버퍼링이 붙고,
 * 응답이 `private` 캐시라 CDN도 못 탄다. 서명 URL로 넘기면 Storage CDN이 직접 준다.
 */
export async function getSignedFileUrl(fileId: string): Promise<string | null> {
  if (!FILE_ID_RE.test(fileId)) return null;
  if (!hasSupabaseEnv()) return null;
  const { data, error } = await getSupabaseClient()
    .storage.from(BUCKET)
    .createSignedUrl(fileId, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** fileId로 파일을 읽는다 — 없거나 형식이 틀리면 null */
export async function readStoredFile(fileId: string): Promise<{ buf: Buffer; contentType: string } | null> {
  if (!FILE_ID_RE.test(fileId)) return null;
  const ext = fileId.split('.').pop() as StoredFileExt;
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
  if (hasSupabaseEnv()) {
    const { data, error } = await getSupabaseClient().storage.from(BUCKET).download(fileId);
    if (error || !data) return null;
    return { buf: Buffer.from(await data.arrayBuffer()), contentType };
  }
  const filePath = path.join(FILES_DIR, fileId);
  if (!existsSync(filePath)) return null;
  return { buf: await readFile(filePath), contentType };
}
