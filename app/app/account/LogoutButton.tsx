'use client';

/** 로그아웃(MYPAGE-07a) — 확인 모달 없이 세션 종료 후 로그인 화면으로 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleLogout()}
      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:border-[#D93636] hover:text-[#D93636]"
    >
      {busy ? '로그아웃 중…' : '로그아웃'}
    </button>
  );
}
