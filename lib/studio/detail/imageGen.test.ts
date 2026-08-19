/**
 * 배경컷 실패 분류 — 화면에 그대로 노출되는 문구라 **사용자가 취할 조치가 달라야** 한다.
 * 영문 API 원문이 새어 나가지 않는 것도 함께 확인한다.
 * 아래쪽은 요청 구성(편집 vs 순수 생성·크기 폴백) — 입력 이미지가 결과에 반영되는지의 계약이다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { classifyImageError, generateBlockVisual } from './imageGen';

/** 상태코드를 가진 OpenAI 오류 만들기 */
function apiError(status: number, message: string): Error {
  return new OpenAI.APIError(status, { message }, message, undefined) as unknown as Error;
}

test('모더레이션 차단 — 재시도 대상이 아니고 프롬프트 조정을 안내한다', () => {
  const e = classifyImageError(
    apiError(400, 'Your request was rejected as a result of our safety system.'),
    '문제 제기·공감',
  );
  assert.equal(e.kind, 'moderation');
  assert.equal(e.retryable, false);
  assert.match(e.userMessage, /안전 필터/);
  assert.match(e.userMessage, /문제 제기·공감/);
});

test('429 — 재시도 가능하고 "잠시 후" 안내', () => {
  const e = classifyImageError(apiError(429, 'Rate limit reached for images'), '히어로 제품컷');
  assert.equal(e.kind, 'rate-limit');
  assert.equal(e.retryable, true);
  assert.match(e.userMessage, /잠시 후/);
});

test('429 + 크레딧 소진 — 재시도가 아니라 결제 안내', () => {
  const e = classifyImageError(apiError(429, 'You exceeded your current quota, please check your billing'), '히어로');
  assert.equal(e.kind, 'quota');
  assert.equal(e.retryable, false);
  assert.match(e.userMessage, /크레딧/);
});

test('401 — 운영자용 키 안내', () => {
  const e = classifyImageError(apiError(401, 'Incorrect API key provided'), '히어로');
  assert.equal(e.kind, 'auth');
  assert.equal(e.retryable, false);
  assert.match(e.userMessage, /OPENAI_API_KEY/);
});

test('5xx — 일시 장애로 보고 재시도 안내', () => {
  const e = classifyImageError(apiError(503, 'The server is overloaded'), '텍스처·질감 컷');
  assert.equal(e.kind, 'transient');
  assert.equal(e.retryable, true);
});

test('타임아웃 — 상태코드 없이 메시지로 판정', () => {
  const e = classifyImageError(new Error('Request timed out.'), '비교 도해');
  assert.equal(e.kind, 'timeout');
  assert.equal(e.retryable, true);
});

test('분류 불가 — 그래도 한국어 조치 문구를 준다', () => {
  const e = classifyImageError(new Error('something weird'), '브랜드 스토리');
  assert.equal(e.kind, 'unknown');
  assert.match(e.userMessage, /브랜드 스토리/);
});

test('원문 영문 메시지는 userMessage 에 새지 않는다(cause 로만 보존)', () => {
  const raw = 'Your request was rejected as a result of our safety system.';
  const e = classifyImageError(apiError(400, raw), '문제 제기');
  assert.equal(e.userMessage.includes(raw), false, 'userMessage 에 영문 원문이 섞였다');
  // cause 는 로그용이라 SDK 가 붙이는 상태코드 접두사가 남아도 된다
  assert.ok(e.cause.includes(raw), 'cause 에 원문이 보존되지 않았다');
});

test('연결 끊김도 일시 오류로 잡는다', () => {
  assert.equal(classifyImageError(new Error('ECONNRESET'), '히어로').kind, 'timeout');
});

// ── 요청 구성 ────────────────────────────────────────────────────────────────
// "입력 이미지와 다른 결과물이 나온다"의 핵심 경로다. source 가 있으면 반드시 편집(images.edit)
// 이어야 하고, 없으면 순수 생성이어야 한다 — 이 분기가 뒤집히면 모델이 없는 용기를 지어낸다.

/** images.edit·generate 를 가로채 호출 종류와 파라미터를 기록한다 */
function stubImages(impl: {
  edit?: (params: Record<string, unknown>) => unknown;
  generate?: (params: Record<string, unknown>) => unknown;
}): { calls: { method: 'edit' | 'generate'; params: Record<string, unknown> }[]; restore: () => void } {
  const proto = OpenAI.Images.prototype as unknown as Record<string, unknown>;
  const original = { edit: proto.edit, generate: proto.generate };
  const calls: { method: 'edit' | 'generate'; params: Record<string, unknown> }[] = [];
  const ok = { data: [{ b64_json: Buffer.from('png').toString('base64') }] };

  proto.edit = function edit(params: Record<string, unknown>) {
    calls.push({ method: 'edit', params });
    return Promise.resolve(impl.edit ? impl.edit(params) : ok);
  };
  proto.generate = function generate(params: Record<string, unknown>) {
    calls.push({ method: 'generate', params });
    return Promise.resolve(impl.generate ? impl.generate(params) : ok);
  };
  return {
    calls,
    restore: () => {
      proto.edit = original.edit;
      proto.generate = original.generate;
    },
  };
}

/** 실호출 경로를 타게 한다(목 모드면 요청 자체가 없다) */
function withRealMode<T>(fn: () => Promise<T>): Promise<T> {
  const before = { key: process.env.OPENAI_API_KEY, mode: process.env.IMAGE_MODE };
  process.env.OPENAI_API_KEY = 'test-key';
  delete process.env.IMAGE_MODE;
  return fn().finally(() => {
    if (before.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = before.key;
    if (before.mode === undefined) delete process.env.IMAGE_MODE;
    else process.env.IMAGE_MODE = before.mode;
  });
}

test('제품컷을 넘기면 편집(images.edit)으로 부르고 원본을 image 로 싣는다', async () => {
  const stub = stubImages({});
  try {
    await withRealMode(() =>
      generateBlockVisual({
        prompt: 'hero',
        blockType: 'hero-product',
        source: Buffer.from('product-bytes'),
        sourceMediaType: 'image/png',
      }),
    );
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0].method, 'edit', 'source 가 있으면 순수 생성으로 떨어지면 안 된다');
    assert.ok(stub.calls[0].params.image, 'image 파라미터가 비어 있으면 원본이 반영되지 않는다');
  } finally {
    stub.restore();
  }
});

test('제품컷이 없으면 순수 생성(images.generate)으로 부른다', async () => {
  const stub = stubImages({});
  try {
    await withRealMode(() => generateBlockVisual({ prompt: 'mood', blockType: 'problem-hook' }));
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0].method, 'generate');
    assert.equal(stub.calls[0].params.image, undefined);
  } finally {
    stub.restore();
  }
});

test('세로 크기를 거부하면 정사각으로 1회 재시도한다', async () => {
  let first = true;
  const stub = stubImages({
    generate: () => {
      if (first) {
        first = false;
        throw apiError(400, 'Invalid value for size: 1024x1536');
      }
      return { data: [{ b64_json: Buffer.from('png').toString('base64') }] };
    },
  });
  try {
    await withRealMode(() => generateBlockVisual({ prompt: 'diagram', blockType: 'before-after-diagram' }));
    assert.equal(stub.calls.length, 2, '크기 거부 후 1회 재시도해야 한다');
    assert.equal(stub.calls[1].params.size, '1024x1024');
  } finally {
    stub.restore();
  }
});
