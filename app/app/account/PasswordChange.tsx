'use client';

/**
 * 비밀번호 변경(MYPAGE-07 · 이메일 계정 전용) — 본인 이메일로 비밀번호 재설정 링크를 발송한다.
 * 로그인 화면의 "비밀번호 찾기"와 같은 /api/auth/email/forgot 계약을 쓰되, 이메일은 세션에서
 * 고정으로 넘겨 입력을 받지 않는다. 소셜 계정은 이 액션을 노출하지 않는다(호출측에서 분기).
 */

import { useState } from 'react';
import { buttonClass } from '@/components/ui/primitives';
import { DevLink } from '@/components/auth/DevLink';

export function PasswordChange({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** 재설정 링크 발송 — 계정 존재 여부는 서버가 비노출(항상 동일 안내로 전환) */
  async function handleSend() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/email/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { devLink?: string | null };
      setDevLink(data.devLink ?? null);
      setSent(true);
    } catch {
      setError('네트워크 오류로 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="text-[12.5px] leading-relaxed">
        <p className="font-semibold text-green-text">○ 재설정 링크를 이메일로 보냈어요</p>
        <p className="mt-1 text-ink-mute">
          <span className="font-semibold text-ink-body">{email}</span>(으)로 보낸 메일의 링크로 비밀번호를 변경해 주세요.
        </p>
        {devLink && <DevLink href={devLink} label="(dev) 재설정 링크 바로 열기" />}
      </div>
    );
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={() => void handleSend()} className={buttonClass('secondary', 'sm')}>
        {busy ? '보내는 중…' : '비밀번호 변경'}
      </button>
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] font-semibold text-danger-text">
          ✕ {error}
        </p>
      )}
    </div>
  );
}
