/**
 * 서명 세션 토큰(순수 모듈 — next 비의존, node:crypto + logger만 사용).
 * 포맷 `v1.<base64url(JSON payload)>.<hmacSha256Hex>` — HMAC은 `v1.<payload>` 전체를 서명한다.
 * 쿠키·헤더 접근은 이 모듈이 하지 않는다(session.ts가 담당) — 서명/검증 로직만 담는다.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '../logger';

/** 세션 발급 주체 — 이메일 자체 로그인 + 소셜(목) 3종 */
export type SessionProvider = 'email' | 'kakao' | 'naver' | 'google';

/** 서명 페이로드 — exp는 만료 epoch ms(절대 시각) */
export interface SessionPayload {
  userId: string;
  provider: SessionProvider;
  exp: number;
}

const PREFIX = 'v1.';
const PROVIDERS: readonly SessionProvider[] = ['email', 'kakao', 'naver', 'google'];
/** AUTH_SECRET 미설정 시의 dev 폴백 — 운영에서는 반드시 env로 덮어써야 한다 */
const DEV_SECRET = 'kglow-dev-insecure-session-secret';

let secretWarned = false;

/**
 * 서명 시크릿을 반환한다. AUTH_SECRET이 없으면 dev 고정값을 쓰되 최초 1회만 경고한다.
 * (모듈 로드 시가 아니라 실제 sign/verify 호출 시 1회 — 미사용 모듈에서 소음 방지)
 */
function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (!secretWarned) {
    secretWarned = true;
    logger.warn(
      'AUTH_SECRET 미설정 — dev 고정 시크릿으로 세션을 서명합니다. ' +
        '원인: 환경변수 누락 / 해결: 배포 전 .env에 AUTH_SECRET(랜덤 32바이트 이상) 지정',
    );
  }
  return DEV_SECRET;
}

/** UTF-8 문자열을 base64url로 인코딩 */
function encodeBody(payload: SessionPayload): string {
  return PREFIX + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** `v1.<payload>` 문자열에 대한 HMAC-SHA256 hex */
function sign(body: string): string {
  return createHmac('sha256', getSecret()).update(body).digest('hex');
}

/** 페이로드를 서명된 세션 토큰 문자열로 만든다 */
export function signSession(payload: SessionPayload): string {
  const body = encodeBody(payload);
  return `${body}.${sign(body)}`;
}

/** 값이 SessionPayload 형태인지 런타임 검증(파싱 결과 신뢰 금지) */
function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.userId === 'string' &&
    typeof o.exp === 'number' &&
    typeof o.provider === 'string' &&
    PROVIDERS.includes(o.provider as SessionProvider)
  );
}

/**
 * 토큰을 검증한다. 프리픽스·서명(timingSafeEqual)·형태·만료를 모두 통과해야 payload,
 * 하나라도 어긋나면 null. (예외는 던지지 않는다 — 세션 부재로 취급)
 */
export function verifySession(token: string): SessionPayload | null {
  if (!token.startsWith(PREFIX)) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = sign(body);
  const given = parts[2];
  // 길이가 다르면 timingSafeEqual이 throw → 먼저 방어
  if (given.length !== expected.length) return null;
  const givenBuf = Buffer.from(given, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (givenBuf.length !== expectedBuf.length || !timingSafeEqual(givenBuf, expectedBuf)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isSessionPayload(payload)) return null;
  if (payload.exp <= Date.now()) return null;
  return payload;
}
