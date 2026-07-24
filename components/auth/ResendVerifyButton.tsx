'use client';

/**
 * 인증 메일 재발송 버튼(LOGIN-09) — 60초 쿨다운 카운트다운 + 429 retryAfterSec 반영 + devLink 노출.
 * EmailAuthPanel(가입 완료·로그인 미인증)과 verify-email 화면이 공유한다.
 * 계정 존재 여부는 서버가 비노출하므로(미가입·이미 인증도 200) 성공/실패 문구를 구분하지 않는다.
 */

import { useEffect, useState } from 'react';
import { buttonClass } from '@/components/ui/primitives';
import { DevLink } from './DevLink';
import { isEmailish } from './authUtils';

/** 재발송 쿨다운 기본값(초) — 서버 정책(resend route)과 동일 */
const RESEND_COOLDOWN_SEC = 60;

interface ResendVerifyButtonProps {
  /** 재발송 대상 이메일 */
  email: string;
  /** 직전 응답에서 받은 dev 링크(있으면 즉시 노출) */
  initialDevLink?: string | null;
  /** 진입 시 남은 쿨다운(초) — 방금 토큰을 만든 직후 화면은 60을 넘겨 즉시 재발송(429)을 막는다 */
  initialCooldownSec?: number;
  className?: string;
}

export function ResendVerifyButton({
  email,
  initialDevLink = null,
  initialCooldownSec = 0,
  className = '',
}: ResendVerifyButtonProps) {
  const [cooldown, setCooldown] = useState(initialCooldownSec);
  const [busy, setBusy] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(initialDevLink);
  const [error, setError] = useState<string | null>(null);

  // 쿨다운 카운트다운(1초 간격) — 0 이하로 내려가지 않게 정지
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const disabled = busy || cooldown > 0 || !isEmailish(email);

  /** 재발송 요청 — 429면 retryAfterSec만큼 쿨다운, 200이면 60초 쿨다운 + devLink 갱신 */
  async function handleResend() {
    if (disabled) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        devLink?: string | null;
        retryAfterSec?: number;
        error?: string;
      };
      if (res.status === 429) {
        setCooldown(data.retryAfterSec ?? RESEND_COOLDOWN_SEC);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `재발송에 실패했습니다 (HTTP ${res.status}).`);
        return;
      }
      setDevLink(data.devLink ?? null);
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch {
      setError('네트워크 오류로 재발송하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button type="button" onClick={() => void handleResend()} disabled={disabled} className={buttonClass('secondary', 'md', 'w-full')}>
        {busy ? '보내는 중…' : cooldown > 0 ? `다시 보내기 (${cooldown}초)` : '인증 메일 다시 보내기'}
      </button>
      {devLink && <DevLink href={devLink} />}
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-semibold text-danger-text">
          ✕ {error}
        </p>
      )}
    </div>
  );
}
