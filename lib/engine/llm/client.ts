/**
 * Claude 구조화 콜 클라이언트 — 08 §4.0 공통 규약의 구현.
 * - 모델 claude-sonnet-5 · output_config.format(json_schema) · system 캐싱(cache_control)
 * - 샘플링 파라미터(temperature 등)는 보내지 않는다(Sonnet 5는 400 거부 — 08 §8-D6)
 * - 키 없음 또는 LLM_MODE=mock → 목 픽스처 응답(전체 플로우 확인용)
 * - 실패 처리: SDK 자동 재시도(429/5xx) + 검증 실패 1회 재시도 + max_tokens 상향 1회
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../logger';

export const LLM_MODEL = 'claude-sonnet-5';

export type LlmMode = 'real' | 'mock';

/** LlmCallLog 저장용 레코드(08 §6) — 저장은 호출자가 주입한 onLog가 담당 */
export interface LlmCallLogEntry {
  callName: string;
  model: string;
  mode: LlmMode;
  requestSummary: { systemChars: number; payloadChars: number; maxTokens: number };
  responseBody: unknown;
  usage: unknown;
  status: 'ok' | 'retried' | 'failed';
  durationMs: number;
}

export interface StructuredCallOptions<T> {
  callName: string;
  system: string;
  userPayload: string;
  schema: object;
  maxTokens: number;
  /** 원본 이미지 첨부(비전 콜 — 콜⑥ studioCopy) — user content 맨 앞에 image 블록으로 들어간다 */
  image?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string };
  /** 데이터 유효성 검증 — 문제 있으면 교정 지시 문자열 반환(1회 재시도), 정상이면 null */
  validate?: (data: T) => string | null;
  /** 목 모드 응답(키 없음 / LLM_MODE=mock) */
  mockData: T;
  onLog?: (entry: LlmCallLogEntry) => Promise<void> | void;
}

/** 현재 실행 모드 판별 */
export function currentLlmMode(): LlmMode {
  if (process.env.LLM_MODE === 'mock') return 'mock';
  return process.env.ANTHROPIC_API_KEY ? 'real' : 'mock';
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** 응답에서 텍스트 블록을 뽑아 JSON 파싱 */
function parseTextJson<T>(message: Anthropic.Message): T {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!block) throw new Error('응답에 텍스트 블록 없음');
  return JSON.parse(block.text) as T;
}

async function callOnce<T>(opts: StructuredCallOptions<T>, maxTokens: number, correction?: string): Promise<{ data: T; usage: unknown }> {
  const text = correction ? `${opts.userPayload}\n\n[교정 지시 — 직전 응답의 문제] ${correction}` : opts.userPayload;
  const content: Anthropic.ContentBlockParam[] = opts.image
    ? [
        {
          type: 'image',
          source: { type: 'base64', media_type: opts.image.mediaType, data: opts.image.dataBase64 },
        },
        { type: 'text', text },
      ]
    : [{ type: 'text', text }];

  const message = await getClient().messages.create({
    model: LLM_MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: opts.system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: { format: { type: 'json_schema', schema: opts.schema } },
    messages: [{ role: 'user', content }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (message.stop_reason === 'max_tokens') {
    throw new MaxTokensError();
  }
  return { data: parseTextJson<T>(message), usage: message.usage };
}

class MaxTokensError extends Error {
  constructor() {
    super('max_tokens 도달 — 상향 재시도 필요');
    this.name = 'MaxTokensError';
  }
}

/**
 * 구조화 JSON 콜 실행. 검증 실패·잘림에 1회씩 재시도하고, 소진 시 throw(폴백은 파이프라인이 결정).
 */
export async function runStructuredCall<T>(opts: StructuredCallOptions<T>): Promise<T> {
  const mode = currentLlmMode();
  const started = Date.now();

  if (mode === 'mock') {
    const data = structuredClone(opts.mockData);
    await opts.onLog?.({
      callName: opts.callName,
      model: LLM_MODEL,
      mode,
      requestSummary: { systemChars: opts.system.length, payloadChars: opts.userPayload.length, maxTokens: opts.maxTokens },
      responseBody: data,
      usage: null,
      status: 'ok',
      durationMs: Date.now() - started,
    });
    logger.info('LLM 콜(목 모드)', { call: opts.callName });
    return data;
  }

  let status: LlmCallLogEntry['status'] = 'ok';
  let lastError = '';

  // 시도 순서: 정상 → (잘림이면 토큰 상향 / 검증 실패면 교정 지시) → 실패
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const maxTokens = lastError === 'max_tokens' ? Math.min(opts.maxTokens * 2, 16000) : opts.maxTokens;
      const correction = lastError && lastError !== 'max_tokens' ? lastError : undefined;
      const { data, usage } = await callOnce(opts, maxTokens, correction);

      const problem = opts.validate?.(data) ?? null;
      if (problem) {
        lastError = problem;
        status = 'retried';
        logger.warn('LLM 응답 검증 실패 — 재시도', { call: opts.callName, problem });
        continue;
      }

      await opts.onLog?.({
        callName: opts.callName,
        model: LLM_MODEL,
        mode,
        requestSummary: { systemChars: opts.system.length, payloadChars: opts.userPayload.length, maxTokens },
        responseBody: data,
        usage,
        status,
        durationMs: Date.now() - started,
      });
      return data;
    } catch (err) {
      if (err instanceof MaxTokensError) {
        lastError = 'max_tokens';
        status = 'retried';
        logger.warn('LLM 응답 잘림 — max_tokens 상향 재시도', { call: opts.callName });
        continue;
      }
      lastError = String((err as Error)?.message ?? err);
      status = 'retried';
      logger.warn('LLM 콜 오류 — 재시도', { call: opts.callName, reason: lastError });
    }
  }

  await opts.onLog?.({
    callName: opts.callName,
    model: LLM_MODEL,
    mode,
    requestSummary: { systemChars: opts.system.length, payloadChars: opts.userPayload.length, maxTokens: opts.maxTokens },
    responseBody: null,
    usage: null,
    status: 'failed',
    durationMs: Date.now() - started,
  });
  throw new Error(`${opts.callName} 실패: ${lastError}`);
}
