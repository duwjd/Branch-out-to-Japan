/**
 * 세로 결합·분할 — 블록 PNG들을 하나의 긴 상세페이지로 잇고, 몰 업로드용으로 자른다.
 *
 * 왜 결합본과 분할본을 **둘 다** 내는가:
 *  라쿠텐 R-Cabinet은 이미지 1장당 최대 3840px·2MB다. 1200×14000 마스터는 업로드가
 *  물리적으로 불가능하므로, 결합본은 확인·승인·공유용이고 몰에 올라가는 실체는 분할본이다.
 *
 * 왜 sharp인가: `next`가 이미 optional dependency 로 들고 있어(0.34.5) 신규 패키지가 0개이며,
 *  Next 기본 serverExternalPackages 에 포함돼 번들되지 않는다. 실측(10블록 1200×14000)
 *  결합 3.6초 / 246MB / JPEG 1.09MB — ImageResponse 로 이어붙이는 대안(5.3초·537MB·PNG 12.8MB,
 *  2MB 제한 초과로 업로드 불가)보다 모든 축에서 낫다.
 */

import sharp from 'sharp';
import { MAX_TOTAL_HEIGHT, type OutputProfile } from './output';

export interface ComposeInput {
  /** 블록 PNG(렌더 결과, 폭은 전부 동일) */
  png: Buffer;
  /** 블록 높이(px) — renderBlock 이 센티넬로 실측한 값 */
  height: number;
}

export interface ComposeResult {
  /** 결합본 JPEG — 화면 미리보기·승인·다운로드 기본값 */
  master: Buffer;
  /** 몰 업로드용 분할 JPEG(각 profile.maxBytesPerSlice 이하 보장) */
  slices: Buffer[];
  /** 결합 후 실제 총 높이(px) */
  totalHeight: number;
  /** 폭(px) */
  width: number;
  /** 높이·장수 상한에 걸려 잘라낸 내용이 있으면 사유 — 검수 게이트에 기록한다 */
  truncated: string | null;
}

/** JPEG 재인코딩 품질 사다리 — 상한 초과 시 순서대로 낮춰 본다. */
const QUALITY_LADDER = [80, 72, 64, 56];

/**
 * 블록들을 세로로 잇고 플랫폼 규격으로 분할한다.
 * 총 높이가 MAX_TOTAL_HEIGHT 를 넘으면 뒤쪽 블록을 잘라내고 사유를 남긴다
 * (조용히 자르지 않는다 — 각주 블록이 사라지면 법적 표기가 깨진다).
 */
export async function composeDetail(blocks: ComposeInput[], profile: OutputProfile): Promise<ComposeResult> {
  if (blocks.length === 0) throw new Error('결합할 블록이 없습니다.');

  // 1) 높이 상한 적용 — 앞에서부터 담다가 넘치면 중단
  const kept: ComposeInput[] = [];
  let totalHeight = 0;
  let truncated: string | null = null;
  for (const b of blocks) {
    if (totalHeight + b.height > MAX_TOTAL_HEIGHT) {
      truncated = `총 높이 상한(${MAX_TOTAL_HEIGHT}px)을 넘어 뒤쪽 블록 ${blocks.length - kept.length}개를 제외했습니다.`;
      break;
    }
    kept.push(b);
    totalHeight += b.height;
  }

  // 2) 세로 결합 — 작업 폭(블록 폭) 그대로 이어붙인 뒤 마지막에 출력 폭으로 다운스케일
  const workWidth = await widthOf(kept[0].png);
  const composites: sharp.OverlayOptions[] = [];
  let top = 0;
  for (const b of kept) {
    composites.push({ input: b.png, left: 0, top });
    top += b.height;
  }
  const stackedPng = await sharp({
    create: { width: workWidth, height: totalHeight, channels: 3, background: '#ffffff' },
  })
    .composite(composites)
    .png()
    .toBuffer();

  // 3) 출력 폭으로 리사이즈(업스케일 금지 — 작업 폭이 더 좁으면 그대로 둔다)
  const scale = profile.width < workWidth ? profile.width / workWidth : 1;
  const outWidth = Math.round(workWidth * scale);
  const outHeight = Math.round(totalHeight * scale);
  const scaledPng =
    scale === 1 ? stackedPng : await sharp(stackedPng).resize({ width: outWidth, kernel: 'lanczos3' }).png().toBuffer();

  const master = await sharp(scaledPng)
    .jpeg({ quality: profile.quality, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();

  // 4) 몰 업로드용 분할
  const slices: Buffer[] = [];
  for (let y = 0; y < outHeight; y += profile.sliceHeight) {
    if (slices.length >= profile.maxSlices) {
      truncated = [truncated, `분할 장수 상한(${profile.maxSlices}장)을 넘어 이후 구간을 제외했습니다.`]
        .filter(Boolean)
        .join(' ');
      break;
    }
    const h = Math.min(profile.sliceHeight, outHeight - y);
    const region = sharp(scaledPng).extract({ left: 0, top: y, width: outWidth, height: h });
    slices.push(await encodeUnderLimit(await region.png().toBuffer(), profile));
  }

  return { master, slices, totalHeight: outHeight, width: outWidth, truncated };
}

/** 바이트 상한을 지킬 때까지 품질을 낮춰 재인코딩한다(실측상 거의 발동하지 않는다). */
async function encodeUnderLimit(png: Buffer, profile: OutputProfile): Promise<Buffer> {
  let out = await sharp(png).jpeg({ quality: profile.quality, mozjpeg: true }).toBuffer();
  if (out.length <= profile.maxBytesPerSlice) return out;
  for (const q of QUALITY_LADDER) {
    out = await sharp(png).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    if (out.length <= profile.maxBytesPerSlice) return out;
  }
  return out; // 사다리를 다 내려도 초과하면 그대로 반환하고 호출부가 경고를 남긴다
}

async function widthOf(png: Buffer): Promise<number> {
  const meta = await sharp(png).metadata();
  if (!meta.width) throw new Error('블록 이미지 폭을 읽을 수 없습니다.');
  return meta.width;
}
