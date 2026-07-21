'use client';

/**
 * 소셜 로그인 버튼 3종 (LOGIN-02) — 클릭 시 목 세션 발급 후 /app/library 이동.
 * "최근 로그인" 배지는 localStorage(기획서 LOGIN-02 명시 위치).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthProvider } from '@/lib/server/session';

const RECENT_KEY = 'kglow-recent-login';

const BUTTONS: { provider: AuthProvider; label: string; className: string; symbol: string }[] = [
  { provider: 'kakao', label: '카카오로 계속하기', className: 'bg-[#FEE500] text-black', symbol: 'K' },
  { provider: 'naver', label: '네이버로 계속하기', className: 'bg-[#03C75A] text-white', symbol: 'N' },
  { provider: 'google', label: 'Google로 계속하기', className: 'border border-neutral-300 bg-white text-neutral-700', symbol: 'G' },
];

export function LoginButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string | null>(null);

  useEffect(() => {
    setRecent(localStorage.getItem(RECENT_KEY));
  }, []);

  /** 목 로그인 — provider 쿠키 발급 후 앱으로 이동 */
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
      router.replace('/app/library');
      router.refresh();
    } catch (err) {
      setError(String((err as Error).message));
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-2.5">
      {BUTTONS.map(({ provider, label, className, symbol }) => (
        <button
          key={provider}
          type="button"
          disabled={busy !== null}
          onClick={() => void handleLogin(provider)}
          className={`relative flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold ${className} ${
            busy !== null ? 'opacity-60' : 'hover:opacity-90'
          }`}
        >
          <span aria-hidden className="text-base font-bold">{symbol}</span>
          {busy === provider ? '로그인 중…' : label}
          {recent === provider && busy === null && (
            <span className="absolute right-3 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-medium">
              최근 로그인
            </span>
          )}
        </button>
      ))}
      {error && (
        <p role="alert" className="rounded-lg border border-[#F0483C] bg-red-50 p-2.5 text-xs text-[#B3271D]">
          로그인에 실패했습니다. 잠시 후 다시 시도해 주세요. ({error})
        </p>
      )}
    </div>
  );
}
