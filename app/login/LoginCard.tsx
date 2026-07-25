'use client';

/**
 * 로그인 카드 인터랙션(LOGIN-01·06) — 소셜 기본 ↔ 이메일 펼침 모드 전환.
 * 소셜 버튼·이메일 패널은 게이트 모달(M4b)과 공유하는 components/auth 컴포넌트를 그대로 쓴다.
 * 정적 셸(로고·타이틀·"소개 페이지로")은 서버 컴포넌트 page.tsx가 감싼다.
 */

import { useState } from 'react';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { EmailAuthPanel } from '@/components/auth/EmailAuthPanel';
import { buttonClass } from '@/components/ui/primitives';
import { IconMail } from '@/components/ui/icons';

export function LoginCard() {
  const [mode, setMode] = useState<'social' | 'email'>('social');

  if (mode === 'email') {
    return (
      <div className="mt-[18px]">
        <button type="button" onClick={() => setMode('social')} className="text-[12.5px] font-semibold text-ink-mute hover:underline">
          ← 소셜 로그인으로
        </button>
        <EmailAuthPanel />
      </div>
    );
  }

  return (
    <>
      <SocialButtons />

      {/* LOGIN-06 · "또는" 구분선 + 이메일로 계속하기 */}
      <div className="my-4 flex items-center gap-2.5">
        <span aria-hidden className="h-px flex-1 bg-hairline" />
        <span className="text-[11.5px] text-ink-mute">또는</span>
        <span aria-hidden className="h-px flex-1 bg-hairline" />
      </div>
      <button type="button" onClick={() => setMode('email')} className={buttonClass('secondary', 'lg', 'w-full')}>
        <IconMail size={16} />
        이메일로 계속하기
      </button>

      {/* LOGIN-03 · 소셜은 동의 체크박스 없이 고지 방식 */}
      <p className="mt-[18px] text-[11.5px] leading-relaxed text-ink-mute">
        계속 진행하면 KGLOW의 <span className="underline">이용약관</span> 및 <span className="underline">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
      </p>
    </>
  );
}
