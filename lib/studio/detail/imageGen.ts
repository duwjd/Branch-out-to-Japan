/**
 * 블록 배경컷 생성 — OpenAI images.edit 래퍼(썸네일 imageGen 미러).
 *
 * 썸네일과의 결정적 차이: **글자를 그리게 하지 않는다.**
 * 캐치카피를 포함한 모든 문자는 satori 가 벡터로 렌더하므로, 생성 이미지에 글자가 섞이면
 * 이중 표기가 되어 오히려 오탈자를 만든다. 프롬프트 negative 1순위가 그것이고,
 * 여기서는 세로로 긴 슬롯(1024x1536)을 우선 요청한다.
 */

import OpenAI, { toFile } from 'openai';
import { logger } from '../../logger';
import {
  currentImageMode,
  imageModel,
  isInputFidelityRejection,
  noInputFidelityModels,
  type ImageMode,
} from '../imageGen';
import type { BlockType } from './output';

export { currentImageMode, imageModel } from '../imageGen';

/** 세로 배너형 블록에 맞는 크기. 미지원 모델이면 정사각으로 폴백한다. */
const PREFERRED_SIZE = '1024x1536';
const FALLBACK_SIZE = '1024x1024';

/**
 * 이미지 1콜의 상한. 콜 하나가 무한정 매달리면 300초 예산을 통째로 먹고
 * 그 잡의 **모든** 블록이 스테일 가드로 죽는다 — 한 블록만 포기하는 게 낫다.
 * 실측 40~90초라 120초면 정상 호출을 자르지 않는다.
 */
export const IMAGE_TIMEOUT_MS = 120_000;

/**
 * SDK 자동 재시도 횟수(429·5xx·연결 오류 대상, 지수 백오프).
 * 2를 넘기지 않는 이유: 재시도 1회가 최대 120초라 300초 예산을 쉽게 넘긴다.
 * 여기서 못 살린 실패는 **잡을 죽이지 않고 블록을 강등**하고(detailJob),
 * 사용자가 결과 화면에서 그 블록만 다시 만들게 한다.
 * 동시성이 6으로 올라가면서(2026-08-18) 429 확률이 올랐지만, 이 백오프와 강등 경로가
 * 그대로 봉쇄 장치가 되므로 신규 코드는 필요 없다 — 한 장이 죽어도 잡은 살아 있다.
 */
const IMAGE_MAX_RETRIES = 2;

/** size 파라미터를 거부하는 모델 기억 — 한 프로세스 안에서 재시도를 반복하지 않는다 */
const noTallSizeModels = new Set<string>();

function isSizeRejection(err: unknown): boolean {
  return err instanceof OpenAI.APIError && err.status === 400 && /size/i.test(err.message);
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ timeout: IMAGE_TIMEOUT_MS, maxRetries: IMAGE_MAX_RETRIES });
  return client;
}

/** 배경컷 생성 실패 사유 — 사용자가 취할 조치가 서로 다르므로 나눈다. */
export type ImageFailureKind =
  | 'moderation'   // 안전 필터 — 프롬프트를 바꿔야 한다
  | 'rate-limit'   // 429 — 잠시 후 재시도
  | 'quota'        // 크레딧·결제 — 운영자 조치
  | 'auth'         // 키 문제 — 운영자 조치
  | 'timeout'      // 응답 지연
  | 'transient'    // 5xx·네트워크
  | 'unknown';

/**
 * 배경컷 생성 실패. 원문 대신 **사용자가 읽고 행동할 수 있는 한국어 문구**를 들고 다닌다.
 * 화면에 그대로 노출되므로 영문 API 메시지를 그대로 흘리지 않는다.
 */
export class BlockVisualError extends Error {
  readonly kind: ImageFailureKind;
  /** 화면 노출용 문구 */
  readonly userMessage: string;
  /** 같은 입력으로 다시 시도할 가치가 있는가 */
  readonly retryable: boolean;
  /** 로그용 원문 */
  readonly cause: string;

  constructor(kind: ImageFailureKind, userMessage: string, retryable: boolean, cause: string) {
    super(userMessage);
    this.name = 'BlockVisualError';
    this.kind = kind;
    this.userMessage = userMessage;
    this.retryable = retryable;
    this.cause = cause;
  }
}

/**
 * OpenAI 오류를 사용자 조치 단위로 분류한다.
 * @param err 원 오류
 * @param blockNameKo 화면에 쓰는 블록 이름(문구에 넣는다)
 */
export function classifyImageError(err: unknown, blockNameKo: string): BlockVisualError {
  const raw = err instanceof Error ? err.message : String(err);
  const api = err instanceof OpenAI.APIError ? err : null;
  const status = api?.status;
  const lower = raw.toLowerCase();

  if (status === 400 && /moderation|safety|content[_ ]policy|rejected as a result/i.test(raw)) {
    return new BlockVisualError(
      'moderation',
      `이미지 안전 필터에 걸려 "${blockNameKo}" 배경컷을 만들지 못했습니다. 추가 요청 문구에서 신체·피부 묘사를 덜어내고 이 블록만 다시 만들어 보세요.`,
      false,
      raw,
    );
  }
  if (status === 429 || /rate[_ ]?limit/i.test(raw)) {
    // 잔여 크레딧 소진도 429로 오므로 문구에서 갈라준다
    if (/quota|billing|insufficient/i.test(lower)) {
      return new BlockVisualError(
        'quota',
        'OpenAI 크레딧이 부족해 배경컷을 만들지 못했습니다. 결제·사용량을 확인한 뒤 다시 시도해 주세요.',
        false,
        raw,
      );
    }
    return new BlockVisualError(
      'rate-limit',
      `요청이 몰려 "${blockNameKo}" 배경컷 생성이 제한됐습니다. 잠시 후 이 블록만 다시 만들면 됩니다.`,
      true,
      raw,
    );
  }
  if (status === 401 || status === 403) {
    return new BlockVisualError(
      'auth',
      'OpenAI 키가 거부됐습니다. 서버의 OPENAI_API_KEY 설정을 확인해 주세요.',
      false,
      raw,
    );
  }
  // SDK 실제 문구는 "Request timed out." 이다 — 'timeout' 만 보면 못 잡는다(테스트로 확인)
  if (api?.status === undefined && /timed?\s?out|aborted|ETIMEDOUT|ECONNRESET/i.test(raw)) {
    return new BlockVisualError(
      'timeout',
      `"${blockNameKo}" 배경컷 생성이 시간 안에 끝나지 않았습니다. 이 블록만 다시 만들어 주세요.`,
      true,
      raw,
    );
  }
  if (status !== undefined && status >= 500) {
    return new BlockVisualError(
      'transient',
      `이미지 생성 서버가 일시적으로 응답하지 않았습니다("${blockNameKo}"). 잠시 후 이 블록만 다시 만들어 주세요.`,
      true,
      raw,
    );
  }
  return new BlockVisualError(
    'unknown',
    `"${blockNameKo}" 배경컷 생성에 실패했습니다. 이 블록만 다시 만들어 보고, 반복되면 추가 요청 문구를 줄여 주세요.`,
    true,
    raw,
  );
}

export interface GenerateBlockVisualOptions {
  prompt: string;
  blockType: BlockType;
  /** 화면·로그에 쓰는 블록 이름 — 실패 문구에 들어간다 */
  blockNameKo?: string;
  /** 원본 제품컷 — 제품이 등장하는 블록에만 넘긴다(라벨 보존) */
  source?: Buffer;
  sourceMediaType?: string;
  /**
   * 이 호출 1건의 상한(ms). 잡의 남은 시간이 IMAGE_TIMEOUT_MS 보다 짧을 때 budget.ts 가 넘긴다.
   * 생략하면 클라이언트 기본값(IMAGE_TIMEOUT_MS)을 쓴다.
   */
  timeoutMs?: number;
}

export interface GeneratedVisual {
  buf: Buffer;
  model: string;
  mode: ImageMode;
}

/**
 * 글자 없는 배경컷 1장.
 * 목 모드는 단색 그라디언트를 sharp 로 만들어 반환한다 — 픽스처 PNG를 블록마다 두지 않기 위해서다.
 */
export async function generateBlockVisual(opts: GenerateBlockVisualOptions): Promise<GeneratedVisual> {
  const mode = currentImageMode();
  if (mode === 'mock') {
    const sharp = (await import('sharp')).default;
    // 블록 타입을 시드로 색을 흔들어 블록마다 다른 배경이 나오게 한다(결정적)
    const hue = ([...opts.blockType].reduce((a, c) => a + c.charCodeAt(0), 0) % 60) + 200;
    const buf = await sharp({
      create: { width: 1024, height: 1536, channels: 3, background: { r: 246, g: 244 - (hue % 8), b: 242 } },
    })
      .png()
      .toBuffer();
    await new Promise((r) => setTimeout(r, 300));
    logger.info('배경컷 생성(목 모드)', { blockType: opts.blockType });
    return { buf, model: 'mock', mode };
  }

  const model = imageModel();
  const quality = process.env.OPENAI_IMAGE_QUALITY ?? 'medium';
  const started = Date.now();

  const params: Record<string, unknown> = {
    model,
    prompt: opts.prompt,
    size: noTallSizeModels.has(model) ? FALLBACK_SIZE : PREFERRED_SIZE,
    quality,
  };

  // 제품이 등장하는 블록은 원본을 편집한다(라벨·형상 보존). 그 외는 순수 생성.
  const useEdit = Boolean(opts.source);
  if (opts.source) {
    const mediaType = opts.sourceMediaType ?? 'image/png';
    params.image = await toFile(opts.source, `source.${mediaType === 'image/png' ? 'png' : 'jpg'}`, { type: mediaType });
    // 라벨·로고 보존 파라미터 — 썸네일 경로와 같은 가드를 공유한다. 기본 모델(gpt-image-2)은
    // 항상 고정밀이라 붙이지 않지만, OPENAI_IMAGE_MODEL 을 바꾸면 상세만 보존을 잃던 구멍이었다.
    if (!noInputFidelityModels.has(model)) params.input_fidelity = 'high';
  }

  // 요청별 timeout — 클라이언트는 프로세스당 1개라 기본값을 바꿀 수 없다.
  // 잡의 남은 예산이 짧으면 이 값이 내려와, 한 콜이 매달려 예산을 통째로 먹는 일을 막는다.
  const reqOpts = opts.timeoutMs ? { timeout: opts.timeoutMs } : undefined;
  const call = async (): Promise<OpenAI.ImagesResponse> =>
    (useEdit
      ? await getClient().images.edit(params as unknown as OpenAI.Images.ImageEditParams, reqOpts)
      : await getClient().images.generate(params as unknown as OpenAI.Images.ImageGenerateParams, reqOpts)) as OpenAI.ImagesResponse;

  const label = opts.blockNameKo ?? opts.blockType;
  let res: OpenAI.ImagesResponse;
  try {
    res = await call();
  } catch (err) {
    if ('input_fidelity' in params && isInputFidelityRejection(err)) {
      // env로 교체한 미지 모델이 파라미터를 거부하는 경우 — 제거 후 1회 재시도(스펙 §6-Q1)
      noInputFidelityModels.add(model);
      logger.warn('input_fidelity 미지원 모델 — 파라미터 제거 후 재시도', { model, blockType: opts.blockType });
      delete params.input_fidelity;
      try {
        res = await call();
      } catch (retryErr) {
        throw classifyImageError(retryErr, label);
      }
    } else if (isSizeRejection(err) && params.size !== FALLBACK_SIZE) {
      // 세로 슬롯을 지원하지 않는 모델 — 정사각으로 1회 재시도하고 이후 결합 단계가 리사이즈한다
      noTallSizeModels.add(model);
      logger.warn('세로 크기 미지원 모델 — 정사각으로 재시도', { model, blockType: opts.blockType });
      params.size = FALLBACK_SIZE;
      try {
        res = await call();
      } catch (retryErr) {
        throw classifyImageError(retryErr, label);
      }
    } else {
      // 원문 대신 분류된 오류로 바꿔 던진다 — 화면까지 그대로 흘러가므로 한국어 문구가 필요하다
      throw classifyImageError(err, label);
    }
  }

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) {
    throw new BlockVisualError(
      'unknown',
      `"${label}" 배경컷 응답이 비어 있습니다. 이 블록만 다시 만들어 주세요.`,
      true,
      '응답에 b64_json 없음 — 모델 ID·파라미터 확인 필요',
    );
  }

  logger.info('배경컷 생성(실호출)', {
    model,
    quality,
    blockType: opts.blockType,
    size: params.size,
    durationMs: Date.now() - started,
  });
  return { buf: Buffer.from(b64, 'base64'), model, mode };
}
