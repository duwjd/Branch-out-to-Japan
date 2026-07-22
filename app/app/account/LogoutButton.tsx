'use client';

/** 로그아웃(MYPAGE-07a) — 확인 모달 없이 세션 종료 후 로그인 화면으로 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonClass } from '@/components/ui/primitives';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={() => void handleLogout()} className={buttonClass('secondary', 'sm')}>
      {busy ? '로그아웃 중…' : '로그아웃'}
    </button>
  );
}
