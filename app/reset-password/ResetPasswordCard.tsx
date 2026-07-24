'use client';

/**
 * 새 비밀번호 설정 카드(LOGIN-10) — `?token=` + 새 비밀번호를 /api/auth/email/reset로 POST.
 * 8자·일치 클라이언트 검증(서버 재검증). 성공 → 완료 안내 + 로그인 링크 /
 * 400(만료·무효)·토큰없음 → 재요청 안내(로그인 화면의 비번찾기로).
 */

import { useState } from 'react';
import Link from 'next/link';
import { buttonClass, fieldLabelClass, inputClass } from '@/components/ui/primitives';

type View = 'form' | 'done' | 'invalid';

export function ResetPasswordCard({ token }: { token: string | null }) {
  const [view, setView] = useState<View>(token ? 'form' : 'invalid');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = password.length >= 8 && password === password2;

  /** 재설정 제출 — 400은 만료·무효 안내로 전환 */
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !token) return;
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (password !== password2) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/email/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (res.status === 400) {
        setView('invalid');
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setView('done');
    } catch {
      setError('네트워크 오류로 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  if (view === 'done') {
    return (
      <div className="mt-5 text-center">
        <p className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">비밀번호가 변경되었습니다</p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">새 비밀번호로 다시 로그인해 주세요.</p>
        <Link href="/login" className={buttonClass('primary', 'lg', 'mt-5 w-full')}>
          로그인하러 가기
        </Link>
      </div>
    );
  }

  if (view === 'invalid') {
    return (
      <div className="mt-5 text-center">
        <p className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">링크가 만료되었거나 유효하지 않습니다</p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">재설정 링크는 일정 시간 후 만료됩니다. 다시 요청해 주세요.</p>
        <Link href="/login" className={buttonClass('primary', 'lg', 'mt-5 w-full')}>
          재설정 메일 다시 요청
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <h1 className="text-center text-[20px] font-extrabold tracking-[-0.02em] text-ink">새 비밀번호 설정</h1>
      <p className="mt-2 text-center text-[13px] leading-relaxed text-ink-mute">계정에 사용할 새 비밀번호를 입력해 주세요.</p>
      <form onSubmit={submit} className="mt-5 text-left">
        <label htmlFor="rs-pw" className={fieldLabelClass}>
          새 비밀번호
        </label>
        <input
          id="rs-pw"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8자 이상"
          className={inputClass}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'rs-err' : undefined}
        />
        <label htmlFor="rs-pw2" className={`${fieldLabelClass} mt-3`}>
          새 비밀번호 확인
        </label>
        <input
          id="rs-pw2"
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="비밀번호 다시 입력"
          className={inputClass}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'rs-err' : undefined}
        />
        {error && (
          <p id="rs-err" role="alert" className="mt-2 text-[12.5px] font-semibold text-danger-text">
            ✕ {error}
          </p>
        )}
        <button type="submit" disabled={!valid || busy} className={buttonClass('primary', 'lg', 'mt-4 w-full')}>
          {busy ? '변경 중…' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  );
}
