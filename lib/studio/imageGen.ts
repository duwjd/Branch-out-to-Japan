/**
 * ⑥ 생성 호출 — OpenAI images.edit 래퍼(08 §4.7) + 이미지 목 모드(LLM_MODE=mock 패턴 미러).
 * 모델 ID·품질은 env 주입 — 실검증으로 gpt-image-2 확정(2026-07-21, 스펙 §6-Q1 해소).
 */

import OpenAI, { toFile } from 'openai';
import { logger } from '../logger';
import { mockImageBuffer } from './fixtures';
import type { StyleId } from './promptPack';

export type ImageMode = 'real' | 'mock';

/** 실 API 검증으로 확정된 모델 ID(2026-07-21) — 교체 필요 시 OPENAI_IMAGE_MODEL로 무배포 오버라이드 */
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

/** 현재 이미지 생성 모드 판별 — 키 없거나 IMAGE_MODE=mock이면 목 */
export function currentImageMode(): ImageMode {
  if (process.env.IMAGE_MODE === 'mock') return 'mock';
  return process.env.OPENAI_API_KEY ? 'real' : 'mock';
}

export function imageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
}

/** input_fidelity 미지원 모델 — gpt-image-2는 입력을 항상 고정밀 처리라 파라미터 자체를 400으로 거부한다(2026-07-22 실검증) */
const noInputFidelityModels = new Set<string>(['gpt-image-2']);

/** 400 + input_fidelity 언급이면 미지원 모델의 파라미터 거부로 판정 */
function isInputFidelityRejection(err: unknown): boolean {
  return err instanceof OpenAI.APIError && err.status === 400 && err.message.includes('input_fidelity');
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

export interface GenerateThumbnailOptions {
  prompt: string;
  original: Buffer;
  mediaType: string;
  styleId: StyleId;
}

/**
 * 일본향 썸네일 1장 생성 — 원본을 유지하며 편집(input_fidelity high, 제품 라벨 보존의 핵심).
 * 목 모드는 프로토타입 실측 샘플 PNG를 반환한다(생성중 화면 확인용 지연 포함).
 */
export async function generateThumbnail(opts: GenerateThumbnailOptions): Promise<{ buf: Buffer; model: string; mode: ImageMode }> {
  const mode = currentImageMode();

  if (mode === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logger.info('이미지 생성(목 모드)', { styleId: opts.styleId });
    return { buf: mockImageBuffer(opts.styleId), model: 'mock', mode };
  }

  const model = imageModel();
  const quality = process.env.OPENAI_IMAGE_QUALITY ?? 'medium';
  const started = Date.now();

  const params: Record<string, unknown> = {
    model,
    image: await toFile(opts.original, `source.${opts.mediaType === 'image/png' ? 'png' : 'jpg'}`, {
      type: opts.mediaType,
    }),
    prompt: opts.prompt,
    size: '1024x1024',
    quality,
  };
  // 제품 라벨·로고 보존 파라미터(스펙 §2-⑥) — 지원 모델에만 붙인다. gpt-image-2는 항상 고정밀이라 불필요·거부
  if (!noInputFidelityModels.has(model)) params.input_fidelity = 'high';

  // params를 넓은 캐스트로 넘기면 반환이 stream 유니온으로 잡힌다 — 비스트리밍 응답으로 좁힌다
  let res: OpenAI.ImagesResponse;
  try {
    res = (await getClient().images.edit(params as unknown as OpenAI.Images.ImageEditParams)) as OpenAI.ImagesResponse;
  } catch (err) {
    // env로 교체한 미지 모델이 파라미터를 거부하는 경우 — 제거 후 1회 재시도(스펙 §6-Q1)
    if (!('input_fidelity' in params) || !isInputFidelityRejection(err)) throw err;
    noInputFidelityModels.add(model);
    logger.warn('input_fidelity 미지원 모델 — 파라미터 제거 후 재시도', { model });
    delete params.input_fidelity;
    res = (await getClient().images.edit(params as unknown as OpenAI.Images.ImageEditParams)) as OpenAI.ImagesResponse;
  }
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error('이미지 생성 응답에 b64_json 없음 — 모델 ID·파라미터 확인 필요(스펙 §6-Q1)');

  logger.info('이미지 생성(실호출)', { model, quality, durationMs: Date.now() - started });
  return { buf: Buffer.from(b64, 'base64'), model, mode };
}
