/**
 * 상세페이지 산출물 저장 포맷 — Supabase Free(스토리지 1GB) 안에서 UT를 버티게 하는 레버.
 *
 * 실측(2026-08-11, 15블록·AI 배경컷 4장 기준):
 *   AI 배경컷 PNG 4장 5.68MB + 블록 PNG 15개 5.27MB + 결합본 0.79MB + 분할본 0.65MB
 *   = 건당 12.4MB → 1GB 에 **82건**. UT 3일을 여러 명이 쓰면 바닥난다.
 *
 * 무엇을 어떤 포맷으로 두는가:
 *  - **텍스트 블록은 PNG 유지.** 벡터 글자가 전부인 이미지라 JPEG 링잉이 글자 가장자리에 바로 보인다.
 *    대신 원래 작다(23~74KB) — 여기서 아낄 게 없다.
 *  - **사진이 깔린 블록(hybrid·ai-visual)은 JPEG.** 최종 결합본이 어차피 q88 JPEG 이므로
 *    중간 산출물을 무손실로 들고 있을 이유가 없다. 오버레이 글자가 큼직해(30~44px) q95 에서 열화가 없다.
 *  - **AI 배경컷은 JPEG.** 카피만 바꾸는 재생성에서 이미지 콜을 아끼려고 보관하는 사본일 뿐,
 *    그 위에 다시 글자를 얹어 또 JPEG 로 나간다.
 *
 * 미디어 타입은 fileId 확장자로 결정되므로(readStoredFile 이 contentType 을 돌려준다)
 * 호출부는 저장 포맷을 하드코딩하지 말고 그 값을 그대로 써야 한다.
 */

import sharp from 'sharp';
import { saveFile } from '../../files/storage';
import type { RenderKind } from './output';

/** 사진이 깔린 블록의 JPEG 품질 — 오버레이 글자를 보존하려 결합본(88)보다 높게 잡는다. */
const BLOCK_JPEG_QUALITY = 95;
/** 배경컷 보관 사본 품질 — 위에 글자를 얹어 다시 인코딩되므로 낮춰도 최종 품질에 영향이 없다. */
const VISUAL_JPEG_QUALITY = 90;

/**
 * 블록 최종 이미지를 저장한다.
 * @param png  renderBlock 산출 PNG
 * @param kind 렌더 종류 — 'text' 만 PNG 로 남는다
 * @returns 저장된 fileId
 */
export async function persistBlockImage(png: Buffer, kind: RenderKind): Promise<string> {
  if (kind === 'text') return saveFile(png, 'png', 'blk');
  const jpg = await sharp(png)
    .jpeg({ quality: BLOCK_JPEG_QUALITY, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();
  return saveFile(jpg, 'jpg', 'blk');
}

/**
 * AI 배경컷 보관 사본을 저장한다(카피만 바꾸는 재생성에서 재사용).
 * @param buf 생성 모델이 준 PNG
 * @returns 저장된 fileId
 */
export async function persistVisual(buf: Buffer): Promise<string> {
  const jpg = await sharp(buf)
    .jpeg({ quality: VISUAL_JPEG_QUALITY, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();
  return saveFile(jpg, 'jpg', 'blk');
}
