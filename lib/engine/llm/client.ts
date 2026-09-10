/**
 * Claude 구조화 콜 클라이언트 — 08 §4.0 공통 규약의 구현.
 * - `output_config.format(json_schema)` · system 캐싱(cache_control) · 콜별 모델·effort 지정
 * - 샘플링 파라미터(temperature 등)는 보내지 않는다(Sonnet 5·Opus 5 모두 400 거부 — 08 §8-D6)
 * - 키 없음 또는 LLM_MODE=mock → 목 픽스처 응답(전체 플로우 확인용)
 * - 실패 처리: SDK 자동 재시도(429/5xx) + 아래 2단 검증 재시도
 *
 * ## 검증 훅이 두 개인 이유 — `validate`(치명) vs `repair`(비치명)
 *
 * `validate` 는 소진 시 **throw** 한다. 계약이 깨진 응답(항목 1:1 불일치, 조항 id 창작)은
 * 리포트로 조립할 수 없으니 잡을 죽이는 게 맞다.
 *
 * 언어 표류는 성격이 다르다. 서술 일부가 일본어로 나왔다고 리포트 전체를 죽이면, 고칠 수 있는
 * 문제 때문에 못 고치는 결과가 된다. 그래서 `repair` 는 한 번 교정을 시도하고, 그래도 남으면
 * **사유를 로그에 남기고 데이터를 그대로 돌려준다.** 콜⑨ `humanizeCall.ts` 가 문체 규칙을
 * `validate` 에 넣지 않은 것과 같은 판단이다.
 *
 * 단, **통째 표류는 `validate` 쪽에서 잡는다**(calls.ts 참조) — 일본어 리포트를 발행하느니
 * 잡을 실패시키고 기존 폴백(카테고리 일반형 / 브랜드 진단 실패)에 맡기는 게 낫다.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../logger';

/** ② 스튜디오 축의 기본 모델. ① 리포트 콜은 calls.ts 에서 REPORT_MODEL 로 덮어쓴다 */
export const LLM_MODEL = 'claude-sonnet-5';

/**
 * ① 진단 리포트 전용 모델.
 *
 * 왜 나눴는가: 리포트는 판정·근거·재설계가 한 번에 걸린 산출물이라 추론 품질이 곧 상품 품질이다.
 * ② 스튜디오는 이미지 왕복이 많아 콜당 비용이 크고, 카피 재설계는 Sonnet 5로 충분하다.
 * 한쪽만 올려 비용을 필요한 곳에 쓴다.
 */
export const REPORT_MODEL = 'claude-opus-5';

/** 추론 깊이 — output_config.effort. 낮을수록 빠르고 싸다 */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type LlmMode = 'real' | 'mock';

/** LlmCallLog 저장용 레코드(08 §6) — 저장은 호출자가 주입한 onLog가 담당 */
export interface LlmCallLogEntry {
  callName: string;
  model: string;
  mode: LlmMode;
  requestSummary: { systemChars: number; payloadChars: number; maxTokens: number; effort?: Effort };
  responseBody: unknown;
  usage: unknown;
  status: 'ok' | 'retried' | 'failed';
  durationMs: number;
  /** 교정 재시도로도 해소되지 않은 비치명 문제(주로 언어 표류). 비어 있으면 정상 */
  repairIssues?: string[];
  /**
   * 재시도를 유발한 응답들 — 사유와 본문.
   * 08 §8-D6이 재현성 담보 수단으로 "LlmCallLog 편차 관찰"을 지정했는데, 정작 재시도를 유발한
   * 응답이 남지 않아 관찰이 반쪽이었다. effort 스윕·표류 추적이 이 필드 위에서 돈다.
   * (fileStore 는 스프레드로 자동 저장. supabase 는 컬럼 추가 전까지 저장되지 않는다.)
   */
  rejectedAttempts?: { reason: string; body: unknown }[];
}

export interface StructuredCallOptions<T> {
  callName: string;
  system: string;
  userPayload: string;
  schema: object;
  maxTokens: number;
  /** 모델 오버라이드 — 생략하면 LLM_MODEL(② 스튜디오 기본) */
  model?: string;
  /** 추론 깊이 — 생략하면 API 기본(high) */
  effort?: Effort;
  /** 원본 이미지 첨부(비전 콜 — 콜⑥ studioCopy) — user content 맨 앞에 image 블록으로 들어간다 */
  image?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string };
  /** 복수 이미지 첨부(비전 콜 — 콜⓪ 상세페이지 추출, 1~10장) — 위→아래 순서로 앞에 들어간다 */
  images?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }[];
  /** 계약 검증 — 문제 있으면 교정 지시 반환. 재시도로도 해소 안 되면 **throw**(잡 실패 경로) */
  validate?: (data: T) => string | null;
  /** 비치명 검증 — 문제 있으면 교정 지시 반환. 재시도로도 해소 안 되면 **로그만 남기고 통과** */
  repair?: (data: T) => string | null;
  /** 목 모드 응답(키 없음 / LLM_MODE=mock) */
  mockData: T;
  /**
   * 이 콜에 허용된 **총 벽시계 상한(ms) — 재시도까지 포함**. 생략하면 상한 없음(SDK 기본 10분).
   *
   * 왜 1회 왕복이 아니라 총합인가: 상위(잡 예산)가 "이 콜에 N초"를 줬는데 아래에서 재시도로
   * N초를 여러 번 쓰면 예산이 조용히 배가 된다. `lib/engine/reportBudget.ts` 가 주는 값이
   * 그대로 벽시계 상한이어야 예산 계산이 성립한다.
   */
  timeoutMs?: number;
  onLog?: (entry: LlmCallLogEntry) => Promise<void> | void;
}

/** 최대 API 호출 횟수 — 초기 1회 + 교정 2회(validate·repair 각 1회분) */
const MAX_ATTEMPTS = 3;

/**
 * 한 번의 시도가 성립하는 최소 시간.
 * 이보다 짧게 남았으면 걸어 봐야 타임아웃으로 버릴 시간이라, 시도하지 않고 실패 경로로 보낸다.
 * `reportBudget.ts` 가 `HUMANIZE_MIN_MS` 를 이 값 위에 세운다 — 두 벌로 갈리면 한쪽만 느슨해진다.
 */
export const MIN_ATTEMPT_MS = 30_000;

/** 비스트리밍 요청의 상한 — 이 위로는 SDK HTTP 타임아웃 위험이 있어 스트리밍이 필요하다 */
const MAX_TOKENS_CEILING = 16000;

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

class MaxTokensError extends Error {
  constructor() {
    super('max_tokens 도달 — 상향 재시도 필요');
    this.name = 'MaxTokensError';
  }
}

/**
 * 안전 분류기가 요청을 거절한 경우.
 * HTTP 200 + `stop_reason: 'refusal'` 로 오므로 예외가 아니다 — 분기하지 않으면
 * `parseTextJson` 이 "응답에 텍스트 블록 없음"으로 오해를 부른다.
 * 화장품 성분·薬機法 텍스트를 다루는 콜이라 오탐 가능성이 실제로 있다.
 */
class RefusalError extends Error {
  constructor(category: string) {
    super(`모델이 요청을 거절했습니다(사유 분류: ${category}). 입력 문구를 확인해 주세요.`);
    this.name = 'RefusalError';
  }
}

async function callOnce<T>(
  opts: StructuredCallOptions<T>,
  maxTokens: number,
  correction?: string,
  timeoutMs?: number,
): Promise<{ data: T; usage: unknown }> {
  const text = correction ? `${opts.userPayload}\n\n[교정 지시 — 직전 응답의 문제] ${correction}` : opts.userPayload;
  const imgs = opts.images ?? (opts.image ? [opts.image] : []);
  const content: Anthropic.ContentBlockParam[] = [
    ...imgs.map((im): Anthropic.ContentBlockParam => ({
      type: 'image',
      source: { type: 'base64', media_type: im.mediaType, data: im.dataBase64 },
    })),
    { type: 'text', text },
  ];

  const params = {
    model: opts.model ?? LLM_MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: opts.system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    // effort 는 format 과 같은 output_config 안에 들어간다. SDK 타입에 없어 아래 캐스트가 덮는다
    output_config: {
      format: { type: 'json_schema', schema: opts.schema },
      ...(opts.effort ? { effort: opts.effort } : {}),
    },
    messages: [{ role: 'user', content }],
  } as Anthropic.MessageCreateParamsNonStreaming;

  // 요청별 상한 — 클라이언트는 프로세스당 1개라 생성자 기본값을 콜마다 바꿀 수 없다
  // (② `lib/studio/detail/imageGen.ts` 가 이미지 콜에 쓰는 방식과 같다).
  //
  // ⚠ **`maxRetries: 0` 이 함께 있어야 한다.** SDK 기본 재시도(2회)는 타임아웃도 재시도하므로
  //   그냥 두면 실 소요가 `timeout × 3` 이 되고, 위의 `MAX_ATTEMPTS` 루프까지 곱해져 최악 9회
  //   왕복이 된다 — 예산 가드를 무력화하는 조합이다. 재시도는 이 파일의 루프 하나만 남긴다.
  const message =
    timeoutMs === undefined
      ? await getClient().messages.create(params)
      : await getClient().messages.create(params, { timeout: timeoutMs, maxRetries: 0 });

  if (message.stop_reason === 'refusal') {
    const details = (message as { stop_details?: { category?: string | null } }).stop_details;
    throw new RefusalError(details?.category ?? '미상');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new MaxTokensError();
  }
  return { data: parseTextJson<T>(message), usage: message.usage };
}

/**
 * 구조화 JSON 콜 실행.
 * `validate` 미해소 → throw(폴백은 파이프라인이 결정) / `repair` 미해소 → 로그 후 통과.
 */
export async function runStructuredCall<T>(opts: StructuredCallOptions<T>): Promise<T> {
  const mode = currentLlmMode();
  const model = opts.model ?? LLM_MODEL;
  const started = Date.now();
  const summary = {
    systemChars: opts.system.length,
    payloadChars: opts.userPayload.length,
    maxTokens: opts.maxTokens,
    ...(opts.effort ? { effort: opts.effort } : {}),
  };

  if (mode === 'mock') {
    const data = structuredClone(opts.mockData);
    await opts.onLog?.({
      callName: opts.callName,
      model,
      mode,
      requestSummary: summary,
      responseBody: data,
      usage: null,
      status: 'ok',
      durationMs: Date.now() - started,
    });
    logger.info('LLM 콜(목 모드)', { call: opts.callName });
    return data;
  }

  let status: LlmCallLogEntry['status'] = 'ok';
  /** 다음 시도에 주입할 교정 지시. **모델이 고칠 수 있는 문제만** 여기 들어간다 */
  let correction: string | undefined;
  /**
   * 토큰 상향이 걸렸는가. **한 번 켜지면 끄지 않는다** — 잘림을 겪었다는 건 기본값이 이 입력에
   * 모자란다는 뜻이라, 이후 교정 재시도에서 기본값으로 되돌리면 같은 자리에서 다시 잘린다.
   */
  let bumpTokens = false;
  /** 마지막 실패 사유(에러 메시지 포함 — 교정 지시와 분리해서 관리한다) */
  let lastError = '';
  const rejectedAttempts: { reason: string; body: unknown }[] = [];
  /** validate 는 통과했지만 repair 가 남은 데이터 — 시도 소진 시 이걸 돌려준다 */
  let repairPending: { data: T; usage: unknown; issue: string } | null = null;

  /** 이 콜의 마감 — 재시도를 포함한 총 벽시계다. 미지정이면 상한 없음(현행 동작) */
  const callDeadline = opts.timeoutMs === undefined ? null : started + opts.timeoutMs;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    /** 이번 시도에 줄 상한 — 남은 예산 전부. 재시도할수록 저절로 짧아진다 */
    let attemptTimeoutMs: number | undefined;
    if (callDeadline !== null) {
      const left = callDeadline - Date.now();
      if (left < MIN_ATTEMPT_MS) {
        // 한 번의 시도조차 성립하지 않는다 — 걸어 봐야 타임아웃으로 버릴 시간이다.
        // 여기서 멈춰야 상위 폴백(콜① 0점 · 콜③ 일반형 · 콜④ 축소 · 콜⑩ 원문 유지)에 도달한다.
        status = 'failed';
        // 직전 실패 사유(주로 "Request timed out.")를 지우지 않는다 — 왜 예산을 다 썼는지가 그 안에 있다
        const budgetNote = `예산 소진 — 남은 시간 ${Math.max(0, Math.round(left / 1000))}초`;
        lastError = lastError ? `${lastError} / ${budgetNote}` : budgetNote;
        logger.warn('LLM 콜 예산 소진 — 시도 중단', { call: opts.callName, attempt, leftMs: left });
        break;
      }
      attemptTimeoutMs = left;
    }
    try {
      const maxTokens = bumpTokens ? Math.min(opts.maxTokens * 2, MAX_TOKENS_CEILING) : opts.maxTokens;
      const { data, usage } = await callOnce(opts, maxTokens, correction, attemptTimeoutMs);

      const contractProblem = opts.validate?.(data) ?? null;
      if (contractProblem) {
        status = 'retried';
        correction = contractProblem;
        lastError = contractProblem;
        rejectedAttempts.push({ reason: `계약 위반: ${contractProblem}`, body: data });
        logger.warn('LLM 응답 계약 검증 실패 — 재시도', { call: opts.callName, problem: contractProblem });
        continue;
      }

      const repairProblem = opts.repair?.(data) ?? null;
      if (repairProblem) {
        status = 'retried';
        correction = repairProblem;
        lastError = repairProblem;
        rejectedAttempts.push({ reason: `교정 필요: ${repairProblem}`, body: data });
        // 계약은 통과했으므로 시도가 소진되면 이 데이터를 쓴다 — 잡을 죽이지 않는다
        repairPending = { data, usage, issue: repairProblem };
        logger.warn('LLM 응답 교정 필요 — 재시도', { call: opts.callName, problem: repairProblem });
        continue;
      }

      await opts.onLog?.({
        callName: opts.callName,
        model,
        mode,
        requestSummary: { ...summary, maxTokens },
        responseBody: data,
        usage,
        status,
        durationMs: Date.now() - started,
        ...(rejectedAttempts.length ? { rejectedAttempts } : {}),
      });
      return data;
    } catch (err) {
      if (err instanceof RefusalError) {
        // 거절은 재시도해도 같은 결과다 — 같은 입력을 다시 보내지 않는다
        lastError = err.message;
        status = 'failed';
        break;
      }
      if (err instanceof MaxTokensError) {
        status = 'retried';
        bumpTokens = true;
        lastError = 'max_tokens';
        logger.warn('LLM 응답 잘림 — max_tokens 상향 재시도', { call: opts.callName });
        continue;
      }
      // 네트워크·API 오류는 **모델이 고칠 수 있는 문제가 아니다.**
      // 예전에는 이 메시지가 [교정 지시]로 프롬프트에 붙어("Connection error." 를 고치라는 지시가 됐다)
      // 다음 시도의 입력을 오염시켰다. 재시도는 유지하되 교정 지시는 건드리지 않는다.
      status = 'retried';
      lastError = String((err as Error)?.message ?? err);
      logger.warn('LLM 콜 오류 — 재시도', { call: opts.callName, reason: lastError });
    }
  }

  // 계약은 통과했고 교정만 남은 경우 — 발행을 막지 않는다. 사유는 로그에 남는다
  if (repairPending) {
    logger.warn('교정 미해소 — 원본 채택', { call: opts.callName, issue: repairPending.issue });
    await opts.onLog?.({
      callName: opts.callName,
      model,
      mode,
      requestSummary: summary,
      responseBody: repairPending.data,
      usage: repairPending.usage,
      status: 'retried',
      durationMs: Date.now() - started,
      repairIssues: [repairPending.issue],
      ...(rejectedAttempts.length ? { rejectedAttempts } : {}),
    });
    return repairPending.data;
  }

  await opts.onLog?.({
    callName: opts.callName,
    model,
    mode,
    requestSummary: summary,
    responseBody: null,
    usage: null,
    status: 'failed',
    durationMs: Date.now() - started,
    ...(rejectedAttempts.length ? { rejectedAttempts } : {}),
  });
  throw new Error(`${opts.callName} 실패: ${lastError}`);
}

// ───────────────────────────────────────────────────────────────────────────
// 웹 검색 서버 툴 콜
// ───────────────────────────────────────────────────────────────────────────

/** 검색 결과의 출처 1건 — 후보와 함께 화면에 노출한다(값이 어디서 왔는지 말하기 위해). */
export interface WebSearchSource {
  url: string;
  title: string;
}

export interface WebSearchCallOptions<T> {
  callName: string;
  system: string;
  userPayload: string;
  images?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }[];
  /** 검색 횟수 상한 — 없으면 모델이 원하는 만큼 돈다 */
  maxUses?: number;
  /** 검색 지역. 일본 등재명을 찾을 때는 일본으로 둔다 */
  userLocation?: { type: 'approximate'; country: string };
  maxTokens?: number;
  /** **필수** — 생략하면 SDK 기본 10분이 라우트 상한보다 길어 콜 하나가 함수를 통째로 먹는다 */
  timeoutMs: number;
  mockData: T;
  mockSources?: WebSearchSource[];
}

/**
 * 응답 본문에서 **마지막** 텍스트 블록의 JSON 을 읽는다.
 *
 * `parseTextJson` 과 다른 이유: 서버 툴을 쓰면 모델이 검색 전후로 텍스트를 흘린다.
 * 첫 블록은 "검색해 보겠습니다" 같은 서두일 수 있어, 첫 블록을 집으면 조용히 깨진다.
 */
function parseLastTextJson<T>(message: Anthropic.Message): T {
  const texts = message.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
  if (texts.length === 0) throw new Error('응답에 텍스트 블록 없음');
  const raw = texts[texts.length - 1].text.trim();
  // 툴을 쓰면 output_config 를 못 걸어 코드펜스가 섞여 올 수 있다
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : raw) as T;
}

/**
 * 서버 툴이 돌려준 출처를 모은다.
 *
 * ⚠ **서버 툴 오류는 예외를 던지지 않는다.** HTTP 200 에 `web_search_tool_result` 가 실려 오고,
 * 성공이면 `content` 가 **배열**, 실패면 **객체**(`{type: 'web_search_tool_result_error', error_code}`)다.
 * 인덱싱 전에 `Array.isArray` 로 분기하지 않으면 조용히 깨진다.
 */
function collectSearchSources(message: Anthropic.Message): { sources: WebSearchSource[]; toolError: string | null } {
  const sources: WebSearchSource[] = [];
  let toolError: string | null = null;
  for (const block of message.content as unknown as { type: string; content?: unknown }[]) {
    if (block.type !== 'web_search_tool_result') continue;
    const content = block.content;
    if (!Array.isArray(content)) {
      toolError = String((content as { error_code?: string } | undefined)?.error_code ?? 'unknown');
      continue;
    }
    for (const r of content as { type?: string; url?: string; title?: string }[]) {
      if (r?.url) sources.push({ url: r.url, title: r.title ?? r.url });
    }
  }
  return { sources, toolError };
}

/**
 * 웹 검색 서버 툴을 태운 1회 콜. 구조화 출력(`output_config.format`)은 걸지 않는다 —
 * 툴 사용과 함께 쓸 수 없어, JSON 형식은 프롬프트로 요구하고 마지막 텍스트 블록을 파싱한다.
 *
 * 재시도하지 않는다. 검색은 **보조**라 실패하면 수동 경로가 이미 열려 있고,
 * 재시도는 상한(`timeoutMs`)을 배로 쓰면서 얻는 게 적다.
 */
export async function runWebSearchCall<T>(
  opts: WebSearchCallOptions<T>,
): Promise<{ data: T; sources: WebSearchSource[]; toolError: string | null }> {
  if (currentLlmMode() === 'mock') {
    logger.info('웹 검색 콜(목 모드)', { call: opts.callName });
    return { data: opts.mockData, sources: opts.mockSources ?? [], toolError: null };
  }

  const imgs = opts.images ?? [];
  const content: Anthropic.ContentBlockParam[] = [
    ...imgs.map((im): Anthropic.ContentBlockParam => ({
      type: 'image',
      source: { type: 'base64', media_type: im.mediaType, data: im.dataBase64 },
    })),
    { type: 'text', text: opts.userPayload },
  ];

  const params = {
    model: LLM_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
    tools: [
      {
        type: 'web_search_20260209',
        name: 'web_search',
        ...(opts.maxUses ? { max_uses: opts.maxUses } : {}),
        ...(opts.userLocation ? { user_location: opts.userLocation } : {}),
      },
    ],
    messages: [{ role: 'user', content }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming;

  const started = Date.now();
  // maxRetries: 0 — 재시도는 상한을 배로 쓴다(runStructuredCall 주석과 같은 이유)
  const message = await getClient().messages.create(params, { timeout: opts.timeoutMs, maxRetries: 0 });
  const { sources, toolError } = collectSearchSources(message);
  logger.info('웹 검색 콜', {
    call: opts.callName,
    durationMs: Date.now() - started,
    sources: sources.length,
    ...(toolError ? { toolError } : {}),
  });
  return { data: parseLastTextJson<T>(message), sources, toolError };
}
