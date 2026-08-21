/**
 * 이미지 API 비용 계기 — OpenAI images 응답의 `usage` 를 USD 로 환산한다.
 *
 * 왜 필요한가: 두 이미지 경로(`imageGen.ts` 썸네일 · `detail/imageGen.ts` 배경컷)가 응답의 `usage`
 * 를 버리고 있었다. 건별 비용을 집계할 수 없으면 "20명 UT 에 얼마 드는가"를 추정으로만 말하게 된다.
 *
 * 왜 추정치를 채우지 않는가: `usage` 가 없으면 `null` 을 돌려준다. 여기서 그럴듯한 값을 만들어 두면
 * 나중에 실측과 구분할 수 없어진다 — 없다는 사실 자체가 정보다.
 *
 * 계산식·검증값의 출처는 `scripts/ut/make-ut-products.mjs` 의 `costUsd()` 와
 * `docs/research/ut-agent/fixtures/products/usage.json` 실측 원장이다(둘 다 테스트 픽스처로 쓴다).
 */

/** OpenAI images 응답의 usage — 필드가 모델·버전마다 빠질 수 있어 전부 optional 이다. */
export interface ImageUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    text_tokens?: number;
    image_tokens?: number;
    cached_tokens?: number;
  };
}

/** 이미지 호출 1건의 원장 행. `비용측정.csv` 한 줄과 1:1 대응한다. */
export interface ImageCallRecord {
  call: 'edit' | 'generate';
  size: string;
  quality: string;
  usage: ImageUsage | null;
  usd: number | null;
  /** 상세 배경컷일 때만 — 어느 블록인지 */
  blockType?: string;
  /** 파라미터 거부·크기 거부로 같은 컷을 다시 부른 횟수(0 = 첫 호출에 성공) */
  retry?: number;
}

/** 자산 레코드에 남기는 합계. `usd` 는 전 콜의 usage 가 다 있을 때만 숫자다. */
export interface ImageUsageSummary {
  calls: ImageCallRecord[];
  totalCalls: number;
  usd: number | null;
}

/**
 * gpt-image-2 토큰 단가 (USD / 1M).
 * 출처: https://developers.openai.com/api/docs/pricing · 확인 2026-08-20.
 * 요금이 개정되면 배포 없이 env 로 덮어쓴다.
 */
export function imagePrice(): { imageIn: number; cachedIn: number; textIn: number; out: number } {
  return {
    imageIn: Number(process.env.OPENAI_IMAGE_PRICE_IMAGE_IN ?? 8),
    cachedIn: Number(process.env.OPENAI_IMAGE_PRICE_CACHED_IN ?? 2),
    textIn: Number(process.env.OPENAI_IMAGE_PRICE_TEXT_IN ?? 5),
    out: Number(process.env.OPENAI_IMAGE_PRICE_OUT ?? 30),
  };
}

/**
 * usage → USD. usage 가 없으면 null(추정치로 채우지 않는다).
 * `image_tokens` 는 `cached_tokens` 를 포함하는 값이라 캐시분을 빼고 나머지에 정상 단가를 매긴다.
 */
export function estimateImageCostUsd(usage: ImageUsage | null | undefined): number | null {
  if (!usage) return null;
  const price = imagePrice();
  const details = usage.input_tokens_details ?? {};
  const cached = details.cached_tokens ?? 0;
  const imageIn = Math.max(0, (details.image_tokens ?? 0) - cached);
  const textIn = details.text_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  return (imageIn * price.imageIn + cached * price.cachedIn + textIn * price.textIn + out * price.out) / 1_000_000;
}

/**
 * 콜 목록을 자산 레코드용 합계로 접는다.
 * 한 건이라도 usd 가 null 이면 합계도 null 이다 — 일부만 더한 숫자는 실측이 아니라 착시다.
 */
export function summarizeImageUsage(calls: ImageCallRecord[]): ImageUsageSummary {
  const complete = calls.length > 0 && calls.every((c) => typeof c.usd === 'number');
  const usd = complete ? calls.reduce((sum, c) => sum + (c.usd ?? 0), 0) : null;
  return { calls, totalCalls: calls.length, usd };
}

/**
 * OpenAI 응답에서 usage 를 안전하게 꺼낸다 — SDK 타입에 없는 버전도 있어 좁은 캐스트를 한 곳에 모은다.
 */
export function readImageUsage(res: unknown): ImageUsage | null {
  const usage = (res as { usage?: ImageUsage } | null | undefined)?.usage;
  return usage ?? null;
}
