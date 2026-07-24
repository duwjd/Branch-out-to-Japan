'use client';

/**
 * 소셜 로그인 버튼 3종 (LOGIN-02) — 클릭 시 목 세션 발급 후 성공 콜백.
 * app/login/LoginButtons.tsx에서 이식·일반화(M4a): onSuccess prop을 받아 로그인 카드와
 * 게이트 모달(M4b)이 공유한다. onSuccess 없으면 기본 동작(/app 이동)을 한다.
 * "최근 로그인" 배지는 localStorage. 소셜 브랜드색은 디자인 토큰이 아니라 각 사 가이드
 * 고정색 — 인라인 리터럴로만 쓴다.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthProvider } from '@/lib/server/session';
import { Toast } from '@/components/ui/Toast';
import { IconSpinner } from '@/components/ui/icons';

const RECENT_KEY = 'kglow-recent-login';

/** 카카오 말풍선 심볼 */
function KakaoSymbol() {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24">
      <path
        fill="#191919"
        d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65-.15.52-.96 3.32-.99 3.54 0 0-.02.17.09.23.11.07.24.02.24.02.32-.04 3.63-2.37 4.2-2.77.58.08 1.18.13 1.8.13 5.52 0 10-3.54 10-7.9S17.52 3 12 3z"
      />
    </svg>
  );
}

/** 네이버 N 심볼 */
function NaverSymbol() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      <path fill="#fff" d="M14.62 12.35 8.98 4.2H4.2v15.6h5.18v-8.15l5.64 8.15h4.78V4.2h-5.18v8.15z" />
    </svg>
  );
}

/** 구글 G 심볼(4색) */
function GoogleSymbol() {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

interface SocialButtonSpec {
  provider: AuthProvider;
  label: string;
  /** 각 사 브랜드 고정색(hover 포함) — 디자인 토큰 승격 금지, 인라인 리터럴 */
  className: string;
  Symbol: () => React.JSX.Element;
}

const BUTTONS: SocialButtonSpec[] = [
  { provider: 'kakao', label: '카카오로 계속하기', className: 'bg-[#FEE500] text-[#191919] hover:bg-[#F2DA00]', Symbol: KakaoSymbol },
  { provider: 'naver', label: '네이버로 계속하기', className: 'bg-[#03C75A] text-white hover:bg-[#02B350]', Symbol: NaverSymbol },
  { provider: 'google', label: 'Google로 계속하기', className: 'border border-input-border bg-canvas text-ink-body hover:bg-n-50', Symbol: GoogleSymbol },
];

/** 소셜 로그인 성공 후 착지 — 게이트는 onSuccess로 "모달 닫고 재개"를 넘긴다 */
export function SocialButtons({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string | null>(null);

  useEffect(() => {
    setRecent(localStorage.getItem(RECENT_KEY));
  }, []);

  // 실패 토스트 자동 소거(LOGIN-04)
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  /** 목 로그인 — provider 쿠키 발급 후 성공 콜백(없으면 /app 이동) */
  async function handleLogin(provider: AuthProvider) {
    setBusy(provider);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      localStorage.setItem(RECENT_KEY, provider);
      if (onSuccess) {
        onSuccess();
        return;
      }
      router.replace('/app');
      router.refresh();
    } catch (err) {
      setError(String((err as Error).message));
      setBusy(null);
    }
  }

  return (
    <div className="mt-[26px] flex flex-col gap-2.5">
      {BUTTONS.map(({ provider, label, className, Symbol }) => {
        const isBusy = busy === provider;
        return (
          <button
            key={provider}
            type="button"
            disabled={busy !== null}
            onClick={() => void handleLogin(provider)}
            className={`relative flex h-12 w-full items-center justify-center gap-2 rounded-[10px] text-[15px] font-bold transition-colors disabled:cursor-default ${className} ${
              busy !== null && !isBusy ? 'opacity-60' : ''
            }`}
          >
            {isBusy && <IconSpinner size={15} className="absolute left-4 animate-spin" />}
            <span aria-hidden="true" className={isBusy ? 'invisible' : ''}>
              <Symbol />
            </span>
            <span>{isBusy ? '로그인 중…' : label}</span>
            {recent === provider && busy === null && (
              <span className="absolute right-3 inline-flex h-[19px] items-center rounded-full bg-coral-tint px-[7px] text-[10px] font-bold text-coral-strong">
                최근 로그인
              </span>
            )}
          </button>
        );
      })}

      <Toast show={error !== null}>
        <p role="alert" className="text-[13px] font-bold">
          로그인에 실패했습니다 ✕
        </p>
        <p className="mt-[3px] text-[11.5px] text-white/70">잠시 후 다시 시도해 주세요.</p>
      </Toast>
    </div>
  );
}
