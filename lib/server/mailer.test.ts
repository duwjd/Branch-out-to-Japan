/**
 * 인증 메일 발송 계약 — 실 발송이 없는 동안 지켜야 할 것 셋.
 * ① 링크는 언제나 돌아온다(이게 깨지면 아무도 가입을 끝낼 수 없다)
 * ② 어떤 입력에서도 던지지 않는다(발송 사정이 가입을 죽이지 않는다)
 * ③ 운영 고지는 프로세스당 한 번(매 가입마다 같은 줄을 쌓지 않는다)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sendAuthMail } from './mailer';

const LINK = 'https://example.test/verify-email?token=abc123';

/** stdout 을 가로채 로그 줄을 모은다 — logger 는 INFO·WARN 을 stdout 으로 쓴다 */
async function captureLogs(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    lines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return lines;
}

/** NODE_ENV 를 잠시 바꿔 실행하고 원복한다 */
async function withNodeEnv(value: string, fn: () => Promise<void>): Promise<void> {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  }
}

// ⚠ 이 테스트가 파일에서 **가장 먼저** 와야 한다 — 고지 플래그가 모듈 수준이라
//    다른 테스트가 운영 경로를 먼저 밟으면 여기서 셀 줄이 이미 사라진다.
test('운영 고지는 프로세스당 한 번만 남는다', async () => {
  const lines = await captureLogs(async () => {
    await withNodeEnv('production', async () => {
      await sendAuthMail({ to: 'a@example.test', kind: 'verify', link: LINK });
      await sendAuthMail({ to: 'b@example.test', kind: 'verify', link: LINK });
      await sendAuthMail({ to: 'c@example.test', kind: 'reset', link: LINK });
    });
  });

  const notices = lines.filter((l) => l.includes('실 메일 발송 없이 운영 중'));
  assert.equal(notices.length, 1, '고지가 여러 번 남으면 로그가 가입 수만큼 오염된다');
  assert.match(notices[0], /WARN/, '차단 사유가 아니라 주의 등급이다');
});

test('링크는 NODE_ENV 와 무관하게 언제나 돌아온다', async () => {
  for (const env of ['development', 'production', 'test']) {
    await withNodeEnv(env, async () => {
      const verify = await sendAuthMail({ to: 'u@example.test', kind: 'verify', link: LINK });
      assert.equal(verify.devLink, LINK, `${env}: 인증 링크가 비면 가입을 끝낼 수 없다`);

      const reset = await sendAuthMail({ to: 'u@example.test', kind: 'reset', link: LINK });
      assert.equal(reset.devLink, LINK, `${env}: 재설정 링크가 비면 비밀번호를 되찾을 수 없다`);
    });
  }
});

test('링크 원문은 로그에 남기지 않는다', async () => {
  const lines = await captureLogs(async () => {
    await sendAuthMail({ to: 'u@example.test', kind: 'verify', link: LINK });
  });
  assert.ok(
    lines.every((l) => !l.includes('abc123')),
    '토큰이 로그에 남으면 로그 열람만으로 계정을 인증할 수 있다',
  );
});

test('빈 입력에도 던지지 않는다', async () => {
  await assert.doesNotReject(() => sendAuthMail({ to: '', kind: 'verify', link: '' }));
});
