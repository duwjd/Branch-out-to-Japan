/**
 * 비전 입력 이미지 준비 — 저장된 경로에서 읽는 잡 경로와, 업로드 파일을 그대로 받는
 * 폼 경로가 **같은 축소 규칙**을 쓰게 한다.
 *
 * 두 경로가 각자 줄이면 한쪽만 상한이 바뀌어 프롬프트 바디 크기가 조용히 갈린다.
 */

import sharp from 'sharp';
import { readStoredFile } from '../files/storage';

/**
 * 비전 입력 장변 상한(px) — 이 이상은 모델이 어차피 내부에서 줄인다.
 * 원본(장당 최대 10MB)을 그대로 보내면 base64 로 1.33배가 되어, 10장이면 프롬프트 바디가
 * 100MB를 넘는다. 업로드 대역과 첫 토큰까지의 시간이 거기서 다 나간다.
 */
export const VISION_MAX_EDGE = 1568;

/** LLM 비전 입력 1장 — `runStructuredCall.images` 가 받는 형태 */
export interface VisionImage {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  dataBase64: string;
}

/** 원본 바이트 1장을 비전 입력으로 줄인다. 장변만 줄이고 비율은 유지한다. */
export async function toVisionImage(buf: Buffer): Promise<VisionImage> {
  // withoutEnlargement 로 작은 이미지는 그대로 둔다
  const out = await sharp(buf)
    .resize({ width: VISION_MAX_EDGE, height: VISION_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return { mediaType: 'image/jpeg', dataBase64: out.toString('base64') };
}

/** 첨부 이미지들을 LLM 비전 입력 형태로 읽는다(최대 10장 — client.ts 계약). */
export async function loadVisionImages(paths: string[]): Promise<VisionImage[]> {
  // 저장소 왕복 10회를 직렬로 기다리지 않는다 — 순서는 Promise.all 이 보존한다
  const files = await Promise.all(paths.slice(0, 10).map((p) => readStoredFile(p)));
  const out = await Promise.all(
    files.filter((f): f is NonNullable<typeof f> => f !== null).map((f) => toVisionImage(f.buf)),
  );
  if (out.length === 0) throw new Error('첨부 이미지를 찾을 수 없습니다.');
  return out;
}

/** 업로드된 파일들을 비전 입력으로 줄인다(최대 10장). 저장소를 거치지 않는 폼 경로용. */
export async function uploadsToVisionImages(files: File[]): Promise<VisionImage[]> {
  const picked = files.slice(0, 10);
  return Promise.all(picked.map(async (f) => toVisionImage(Buffer.from(await f.arrayBuffer()))));
}
