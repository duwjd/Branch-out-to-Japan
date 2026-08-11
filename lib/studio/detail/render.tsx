/**
 * 블록 렌더 — next/og(satori + resvg)로 블록 1개를 PNG로 굽는다.
 *
 * 하이브리드 계약: AI는 **글자 없는 배경컷**만 만들고, 캐치카피를 포함한 모든 문자는
 * 여기서 벡터로 그린다. 배경컷은 data: URI 로 깔고 그 위에 텍스트를 얹으므로
 * 블록당 satori 1패스로 끝난다(합성용 추가 왕복 없음).
 *
 * 가변 높이 처리 — satori는 캔버스 높이를 고정으로 받는다. 그래서 넉넉한 캔버스에 렌더하되
 * 콘텐츠 바로 뒤에 2px 마젠타 센티넬 바를 두고, 좌측 4px 컬럼만 raw 로 훑어 y를 찾아 크롭한다.
 * (실측: 1200×3000 캔버스에서 실제 979px를 정확히 측정)
 */

import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';
import sharp from 'sharp';
import { BLOCK_CANVAS_HEIGHT, CANVAS_WIDTH, VISUAL_BLOCK_HEIGHT } from './output';
import { JP_FONT_FAMILY, jpFonts, normalizeForFont, uncoveredGlyphs } from './fonts';

/** 센티넬 색 — 콘텐츠에 절대 쓰지 않는 순수 마젠타. */
const SENTINEL_RGB = { r: 255, g: 0, b: 255 } as const;
const SENTINEL_TOLERANCE = 12;

export interface RenderBlockOptions {
  /** 블록 본문 트리(templates.tsx 산출). 센티넬·폰트·캔버스는 이 함수가 감싼다 */
  content: ReactElement;
  /** AI 배경컷(있으면 콘텐츠 뒤에 깔린다) */
  background?: Buffer;
  backgroundMediaType?: string;
  /** 배경 위 가독성 확보용 오버레이 불투명도(0~1). 배경이 없으면 무시 */
  scrimOpacity?: number;
  width?: number;
  maxHeight?: number;
  /** 배경컷 블록의 고정 높이(기본 VISUAL_BLOCK_HEIGHT). 배경이 없으면 무시된다 */
  visualHeight?: number;
}

export interface RenderedBlock {
  png: Buffer;
  height: number;
}

/**
 * 블록 트리를 PNG로 렌더하고 실제 콘텐츠 높이에 맞춰 크롭한다.
 * @throws 캔버스 안에서 센티넬을 못 찾으면(= 콘텐츠가 maxHeight 초과) 실패시킨다 —
 *         조용히 잘린 블록을 내보내면 각주가 사라져 법적 표기가 깨진다.
 */
export async function renderBlock(opts: RenderBlockOptions): Promise<RenderedBlock> {
  const width = opts.width ?? CANVAS_WIDTH;
  const bgUri = opts.background
    ? `data:${opts.backgroundMediaType ?? 'image/png'};base64,${opts.background.toString('base64')}`
    : null;

  // 배경이 있으면 높이가 확정된다(사진이 그 높이를 채운다). 없으면 센티넬로 실측한다.
  const fixedHeight = bgUri ? (opts.visualHeight ?? VISUAL_BLOCK_HEIGHT) : null;
  const maxHeight = fixedHeight ?? opts.maxHeight ?? BLOCK_CANVAS_HEIGHT;

  const wrapped = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width,
        backgroundColor: '#ffffff',
        fontFamily: JP_FONT_FAMILY,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width,
          position: 'relative',
          // 배경 블록은 사진이 그 높이를 채우고 텍스트 카드가 세로 중앙에 얹힌다
          ...(fixedHeight ? { height: fixedHeight, justifyContent: 'center' } : {}),
        }}
      >
        {bgUri ? (
          // eslint-disable-next-line @next/next/no-img-element -- satori 렌더 트리(브라우저 DOM 아님)
          <img
            src={bgUri}
            alt=""
            style={{ position: 'absolute', top: 0, left: 0, width, height: maxHeight, objectFit: 'cover' }}
          />
        ) : null}
        {bgUri && opts.scrimOpacity ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width,
              height: maxHeight,
              backgroundColor: `rgba(255,255,255,${opts.scrimOpacity})`,
            }}
          />
        ) : null}
        {opts.content}
      </div>
      {/* 센티넬 — 콘텐츠 바로 뒤. 이 줄의 y가 곧 실제 콘텐츠 높이다(높이 고정 블록엔 불필요) */}
      {fixedHeight ? null : (
        <div style={{ display: 'flex', width, height: 2, backgroundColor: 'rgb(255,0,255)', flexShrink: 0 }} />
      )}
    </div>
  );

  const res = new ImageResponse(wrapped, { width, height: maxHeight, fonts: jpFonts() });
  const png = Buffer.from(await res.arrayBuffer());

  // 높이가 확정된 블록은 그대로 쓴다 — 크롭하면 배경 사진이 잘린다
  if (fixedHeight) return { png, height: fixedHeight };

  const height = await measureSentinel(png, width, maxHeight);
  if (height <= 0) {
    throw new Error(
      `블록 높이 측정 실패 — 콘텐츠가 캔버스(${maxHeight}px)를 넘었을 수 있습니다. 슬롯 텍스트를 줄이거나 블록을 분할하세요.`,
    );
  }

  const cropped = await sharp(png).extract({ left: 0, top: 0, width, height }).png().toBuffer();
  return { png: cropped, height };
}

/** 좌측 4px 컬럼만 raw 로 훑어 센티넬 y좌표를 찾는다(전체 디코딩 회피). */
async function measureSentinel(png: Buffer, width: number, height: number): Promise<number> {
  const probeWidth = Math.min(4, width);
  const { data, info } = await sharp(png)
    .extract({ left: 0, top: 0, width: probeWidth, height })
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let y = 0; y < info.height; y++) {
    const i = y * info.width * info.channels;
    if (
      Math.abs(data[i] - SENTINEL_RGB.r) < SENTINEL_TOLERANCE &&
      Math.abs(data[i + 1] - SENTINEL_RGB.g) < SENTINEL_TOLERANCE &&
      Math.abs(data[i + 2] - SENTINEL_RGB.b) < SENTINEL_TOLERANCE
    ) {
      return y;
    }
  }
  return -1;
}

/**
 * 슬롯 텍스트를 렌더 안전한 형태로 만든다.
 * 정규화로도 못 살리는 글자가 남으면 실패시킨다 — 그대로 두면 satori가
 * Google Fonts를 런타임 fetch하고, 실패 시 그 자리가 두부(tofu)가 된다.
 */
export function safeText(value: string, where: string): string {
  const normalized = normalizeForFont(value);
  const missing = uncoveredGlyphs(normalized);
  if (missing.length > 0) {
    throw new Error(`${where}: 폰트가 그릴 수 없는 문자 ${JSON.stringify(missing)} — 슬롯 텍스트를 수정하세요.`);
  }
  return normalized;
}
