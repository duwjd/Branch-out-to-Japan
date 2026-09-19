/**
 * 데모 계정 설정(서버 전용) — "데모 계정 체험하기" 버튼이 로그인할 계정.
 * `DEMO_ACCOUNT_EMAIL` · `DEMO_ACCOUNT_PASSWORD` 두 env 가 모두 있을 때만 켜진다.
 * 하나라도 비면 null — 로그인 화면은 버튼을 숨기고, `/api/auth/demo` 는 404 를 준다.
 * 계정 자체는 여기서 만들지 않는다. 해당 환경의 DB 에 가입·인증된 계정이 있어야 한다.
 */

import { normalizeEmail } from './email';

/** 데모 계정 자격 증명 */
export interface DemoAccount {
  email: string;
  password: string;
}

/** env 에서 데모 계정을 읽는다. 둘 중 하나라도 비어 있으면 null(데모 비활성) */
export function getDemoAccount(): DemoAccount | null {
  const email = normalizeEmail(process.env.DEMO_ACCOUNT_EMAIL ?? '');
  const password = process.env.DEMO_ACCOUNT_PASSWORD ?? '';
  if (!email || !password) return null;
  return { email, password };
}
