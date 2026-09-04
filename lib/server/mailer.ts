/**
 * 인증 메일 발송 — **실 발송은 아직 없다.**
 *
 * 인증·재설정 링크를 응답으로 그대로 돌려주고, 화면이 그 링크를 직접 보여준다(폐쇄 UT 전제).
 * 실 발송(Resend·SMTP 등)은 이번 스프린트 범위에서 제외했다 —
 * 근거: `docs/decisions/2026-09-02-실메일-보류-devlink-정식화.md`.
 *
 * ## 이 방식이 포기하는 것
 *
 * 링크가 **요청한 쪽으로 곧장 돌아가므로 이메일 소유 확인이 성립하지 않는다.**
 * 남의 주소로 가입해도 응답에 실린 링크를 눌러 `emailVerified` 를 통과할 수 있다.
 * 아는 사람만 부르는 폐쇄 UT 에서만 유효하고, **공개 모집 전에는 실 발송이 선행돼야 한다.**
 *
 * ## 교체 지점은 여기 하나다
 *
 * 실 발송을 붙일 때 이 함수 내부만 바꾼다. 호출부 3곳(`signup`·`resend`·`forgot`)과
 * 화면(`EmailAuthPanel`·`ResendVerifyButton`·`PasswordChange`)은 손대지 않아도 되도록
 * 반환 계약(`{ devLink }`)을 유지한다. 그때 `devLink` 는 다시 null 이 될 수 있다.
 */

import { logger } from '../logger';

export interface AuthMailInput {
  to: string;
  kind: 'verify' | 'reset';
  link: string;
}

/** 운영 고지를 프로세스당 한 번만 남기기 위한 플래그 — 매 가입마다 같은 줄을 쌓지 않는다 */
let noticeLogged = false;

/**
 * 인증/재설정 링크를 발급한다. **메일을 보내지 않고 링크를 그대로 돌려준다.**
 *
 * 실패로 끝나는 경로가 없다 — 발송이 없으므로 가입이 발송 실패로 죽지 않는다.
 * 실 발송을 붙인 뒤에도 이 성질은 지킨다(유저는 만들고 재발송으로 복구).
 *
 * @param input 수신자·종류·링크 원문
 * @returns devLink — 화면이 노출할 링크. 지금은 항상 채워진다.
 */
export async function sendAuthMail(input: AuthMailInput): Promise<{ devLink: string | null }> {
  const { to, kind, link } = input;
  // 링크 원문(토큰 포함)은 로그에 남기지 않는다 — 수신자·종류만 기록
  logger.info('인증 링크 발급', { to, kind });

  // 운영에서 이 상태로 도는 것은 **의도된 선택**이지만 조용히 지나가면 안 된다.
  // 실 발송이 붙었다고 착각한 채 공개 모집으로 넘어가는 것이 이 코드의 유일한 위험이다.
  if (process.env.NODE_ENV === 'production' && !noticeLogged) {
    noticeLogged = true;
    logger.warn(
      '실 메일 발송 없이 운영 중 — 인증 링크를 응답 본문으로 전달합니다(폐쇄 UT 전제). ' +
        '이메일 소유 검증이 성립하지 않으므로 공개 모집 전에 실 발송을 붙여야 합니다' +
        '(lib/server/mailer.ts · docs/decisions/2026-09-02-실메일-보류-devlink-정식화.md).',
    );
  }

  return { devLink: link };
}
