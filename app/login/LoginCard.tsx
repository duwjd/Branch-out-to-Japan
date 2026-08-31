'use client';

/**
 * 로그인 카드 인터랙션(LOGIN-01·06) — **이메일 단독**(2026-08-31).
 * 소셜 로그인은 목 세션이라 숨겼다(`lib/server/session.ts` `SOCIAL_LOGIN_ENABLED = false`).
 * 이전에는 "소셜 기본 ↔ 이메일 펼침" 2모드였고 그 전환 UI(← 소셜 로그인으로 · "또는" 구분선)는
 * 함께 사라졌다. 실 OAuth 를 붙이면 `SocialButtons` 를 다시 올린다 — 컴포넌트는 남겨 뒀다.
 * 정적 셸(로고·타이틀·"소개 페이지로")은 서버 컴포넌트 page.tsx가 감싼다.
 */

import { EmailAuthPanel } from '@/components/auth/EmailAuthPanel';

export function LoginCard() {
  return (
    <div className="mt-[18px]">
      <EmailAuthPanel />

      {/* LOGIN-03 · 고지 방식(동의 체크박스 없음) */}
      <p className="mt-[18px] text-[11.5px] leading-relaxed text-ink-mute">
        계속 진행하면 YOAKE의 <span className="underline">이용약관</span> 및{' '}
        <span className="underline">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
      </p>
    </div>
  );
}
