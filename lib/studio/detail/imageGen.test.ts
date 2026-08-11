/**
 * 배경컷 실패 분류 — 화면에 그대로 노출되는 문구라 **사용자가 취할 조치가 달라야** 한다.
 * 영문 API 원문이 새어 나가지 않는 것도 함께 확인한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { classifyImageError } from './imageGen';

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
