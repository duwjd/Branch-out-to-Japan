/**
 * POST /api/auth/login — **2026-08-31 부터 비활성.** 항상 404 를 돌려준다.
 *
 * 왜 막았나: 이 라우트는 자격증명을 전혀 검사하지 않았다. `{"provider":"kakao"}` 한 줄이면
 * `demo-user` 세션 쿠키를 발급했고, 그 계정은 레거시 브랜드 데이터의 소유자다. 목 소셜 로그인이라
 * 의도된 동작이었지만 배포본에 그대로 열려 있었다 — 화면에서 버튼을 숨기는 것만으로는 닫히지 않는다.
 *
 * 되살리는 조건: **실 OAuth 연동**. 그때 이 파일을 OAuth 콜백 핸들러로 교체하고
 * `lib/server/session.ts` 의 `SOCIAL_LOGIN_ENABLED` 를 true 로 되돌린다.
 * 파일을 지우지 않고 남겨 둔 이유는 여기가 그 교체 지점이기 때문이다.
 *
 * 근거: docs/decisions/2026-08-31-목-소셜로그인-차단.md
 */

import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: '지원하지 않는 로그인 수단입니다.' }, { status: 404 });
}
