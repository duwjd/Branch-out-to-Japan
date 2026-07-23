/**
 * 인증 메일 발송 — 현재는 dev 스텁(로그만 남기고 링크를 응답으로 되돌려준다).
 * 실 메일 서비스(Resend 등)로 교체할 때는 이 함수 내부만 바꾸면 된다 — 연결 지점 단일화.
 */

import { logger } from '../logger';

export interface AuthMailInput {
  to: string;
  kind: 'verify' | 'reset';
  link: string;
}

/**
 * 인증/재설정 메일을 보낸다(dev: 발송 대신 로그).
 * @returns devLink — 비-운영 환경에서만 링크 원문(프론트가 화면에 노출해 클릭 테스트).
 *   운영(NODE_ENV==='production')에서는 null(링크는 실제 메일로만 전달).
 */
export async function sendAuthMail(input: AuthMailInput): Promise<{ devLink: string | null }> {
  const { to, kind, link } = input;
  // 링크 원문(토큰 포함)은 로그에 남기지 않는다 — 수신자·종류만 기록
  logger.info('인증 메일(dev)', { to, kind });
  const devLink = process.env.NODE_ENV !== 'production' ? link : null;
  return { devLink };
}
