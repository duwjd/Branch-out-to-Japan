'use client';

/**
 * 이메일 인증 확인 카드(LOGIN-09) — 마운트 시 `?token=`을 /api/auth/email/verify로 POST.
 * 검증 중(스피너) → 성공("인증 완료" + 로그인 링크) / 실패·만료·토큰없음(재발송 안내).
 * 자동 로그인은 없다(verify API가 세션을 주지 않음) — 사용자를 로그인으로 유도한다.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { buttonClass, fieldLabelClass, inputClass } from '@/components/ui/primitives';
import { IconSpinner } from '@/components/ui/icons';
import { ResendVerifyButton } from '@/components/auth/ResendVerifyButton';

type Status = 'verifying' | 'success' | 'error' | 'noToken';

export function VerifyEmailCard({ token }: { token: string | null }) {
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'noToken');
  const [email, setEmail] = useState('');
  // StrictMode 이중 마운트에서 1회용 토큰이 두 번 소비되지 않도록 가드
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await fetch('/api/auth/email/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        setStatus(res.ok ? 'success' : 'error');
      } catch {
        setStatus('error');
      }
    })();
  }, [token]);

  if (status === 'verifying') {
    return (
      <div className="mt-6">
        <div className="flex justify-center">
          <IconSpinner size={24} className="animate-spin text-coral" />
        </div>
        <p className="mt-3.5 text-[14px] font-bold text-ink">이메일 인증 확인 중…</p>
        <p className="mt-1.5 text-[12.5px] text-ink-mute">잠시만 기다려 주세요.</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="mt-5">
        <p className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">이메일 인증 완료</p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">이제 로그인하여 KGLOW를 시작할 수 있어요.</p>
        <Link href="/login" className={buttonClass('primary', 'lg', 'mt-5 w-full')}>
          로그인하러 가기
        </Link>
      </div>
    );
  }

  // error | noToken — 재발송 안내
  return (
    <div className="mt-5 text-left">
      <p className="text-center text-[18px] font-extrabold tracking-[-0.01em] text-ink">
        {status === 'noToken' ? '인증 링크가 올바르지 않습니다' : '링크가 만료되었거나 유효하지 않습니다'}
      </p>
      <p className="mt-2 text-center text-[13px] leading-relaxed text-ink-mute">인증 메일을 다시 받으려면 가입한 이메일을 입력해 주세요.</p>
      <label htmlFor="vf-email" className={`${fieldLabelClass} mt-5`}>
        이메일
      </label>
      <input
        id="vf-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className={inputClass}
      />
      <ResendVerifyButton email={email} className="mt-4" />
    </div>
  );
}
