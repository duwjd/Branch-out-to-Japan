/**
 * imageCost 단위 테스트.
 * 러너: node:test (tsc → .tmp-node → node --test) · 실행: npm run test
 *
 * 픽스처는 `docs/research/ut-agent/fixtures/products/usage.json` 의 실측 원장이다 —
 * 계획서 §10-2 에 적힌 장당 단가($0.0420 generate / $0.0652 edit)를 그대로 재현하는지 본다.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { estimateImageCostUsd, summarizeImageUsage, readImageUsage, type ImageCallRecord } from './imageCost';

/** usage.json 의 `cream` 콜 — generate 1024x1536 medium */
const GENERATE_USAGE = {
  input_tokens: 172,
  input_tokens_details: { text_tokens: 172, image_tokens: 0 },
  output_tokens: 1372,
  total_tokens: 1544,
};

/** usage.json 의 `__thumbnail-probe` 콜 — edit 1024x1024 medium */
const EDIT_USAGE = {
  input_tokens: 1582,
  input_tokens_details: { text_tokens: 46, image_tokens: 1536 },
  output_tokens: 1756,
  total_tokens: 3338,
};

const PRICE_ENV = [
  'OPENAI_IMAGE_PRICE_IMAGE_IN',
  'OPENAI_IMAGE_PRICE_CACHED_IN',
  'OPENAI_IMAGE_PRICE_TEXT_IN',
  'OPENAI_IMAGE_PRICE_OUT',
] as const;

describe('estimateImageCostUsd', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of PRICE_ENV) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of PRICE_ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('generate 1024x1536 medium 실측 $0.04202 를 재현한다', () => {
    const usd = estimateImageCostUsd(GENERATE_USAGE);
    assert.ok(usd !== null);
    assert.equal(Number(usd.toFixed(6)), 0.04202);
  });

  it('edit 1024x1024 medium 실측 $0.065198 를 재현한다', () => {
    const usd = estimateImageCostUsd(EDIT_USAGE);
    assert.ok(usd !== null);
    assert.equal(Number(usd.toFixed(6)), 0.065198);
  });

  it('edit 이 generate 보다 비싸다 — 계획서 §10-2 의 반직관 지점', () => {
    assert.ok(estimateImageCostUsd(EDIT_USAGE)! > estimateImageCostUsd(GENERATE_USAGE)!);
  });

  it('usage 가 없으면 null 이다 — 추정치로 채우지 않는다', () => {
    assert.equal(estimateImageCostUsd(null), null);
    assert.equal(estimateImageCostUsd(undefined), null);
  });

  it('캐시된 이미지 입력은 image_tokens 에서 빼고 캐시 단가로 계산한다', () => {
    const usd = estimateImageCostUsd({
      input_tokens: 1536,
      input_tokens_details: { text_tokens: 0, image_tokens: 1536, cached_tokens: 1536 },
      output_tokens: 0,
    });
    // 1536 전부 캐시 → 1536 × $2/1M
    assert.equal(Number(usd!.toFixed(9)), 0.003072);
  });

  it('details 가 비어도 출력 토큰만으로 계산한다', () => {
    assert.equal(Number(estimateImageCostUsd({ output_tokens: 1000 })!.toFixed(6)), 0.03);
  });

  it('env 로 단가를 덮어쓸 수 있다 — 요금 개정 무배포 대응', () => {
    process.env.OPENAI_IMAGE_PRICE_OUT = '60';
    const usd = estimateImageCostUsd({ output_tokens: 1000 });
    assert.equal(Number(usd!.toFixed(6)), 0.06);
  });
});

describe('summarizeImageUsage', () => {
  const call = (usd: number | null): ImageCallRecord => ({
    call: 'generate',
    size: '1024x1536',
    quality: 'medium',
    usage: usd === null ? null : GENERATE_USAGE,
    usd,
  });

  it('전 콜의 usd 가 있으면 합계를 낸다', () => {
    const s = summarizeImageUsage([call(0.042), call(0.0652)]);
    assert.equal(s.totalCalls, 2);
    assert.equal(Number(s.usd!.toFixed(4)), 0.1072);
  });

  it('한 건이라도 usd 가 null 이면 합계도 null 이다', () => {
    const s = summarizeImageUsage([call(0.042), call(null)]);
    assert.equal(s.totalCalls, 2);
    assert.equal(s.usd, null);
  });

  it('콜이 없으면 합계는 null 이다 — 0 은 "공짜"라는 거짓 신호가 된다', () => {
    assert.equal(summarizeImageUsage([]).usd, null);
  });
});

describe('readImageUsage', () => {
  it('응답에서 usage 를 꺼낸다', () => {
    assert.deepEqual(readImageUsage({ usage: GENERATE_USAGE }), GENERATE_USAGE);
  });

  it('usage 가 없거나 응답이 비면 null 이다', () => {
    assert.equal(readImageUsage({}), null);
    assert.equal(readImageUsage(null), null);
    assert.equal(readImageUsage(undefined), null);
  });
});
