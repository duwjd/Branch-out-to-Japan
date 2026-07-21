'use client';

/**
 * 앱 셸 — 사이드바 전역 내비(⓪ MAIN-01 축약: 3축 내비 + 운영 하위 아코디언 + 계정 행).
 * KPI 위젯·브랜드 스위처는 이번 범위 제외(09 §4b 하지 말 것). 세션은 서버 레이아웃이 주입한다.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { KglowLogo } from '@/components/brand/Logo';

interface ShellProps {
  userName: string;
  providerLabel: string;
  /** 기업 매칭 상태 배지(LIB-07) — null이면 미신청(배지 없음) */
  matchBadge: { label: string; tone: 'amber' | 'green' | 'neutral' } | null;
  children: React.ReactNode;
}

const OPS_ITEMS = [
  { href: '/app/library', label: '자산 라이브러리' },
  { href: '/app/brand', label: '브랜드 관리' },
  { href: '/app/matching', label: '기업 매칭' },
];

const BADGE_TONES = {
  amber: 'bg-amber-100 text-amber-900',
  green: 'bg-emerald-100 text-emerald-900',
  neutral: 'bg-neutral-100 text-neutral-600',
} as const;

/** 현재 경로가 해당 축이면 활성 스타일 */
function navClass(active: boolean): string {
  return `block rounded-lg px-3 py-2 text-sm font-medium ${
    active ? 'bg-[#FFF1F1] text-[#D93636]' : 'text-neutral-700 hover:bg-neutral-100'
  }`;
}

export function AppShell({ userName, providerLabel, matchBadge, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const opsActive = OPS_ITEMS.some((i) => pathname.startsWith(i.href));

  /** 목 세션 종료 후 로그인으로 */
  async function handleLogout() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="전역 내비게이션">
      <Link href="/app/report/new" className={navClass(pathname.startsWith('/app/report'))}>
        진단 리포트
      </Link>
      <Link href="/app/studio/thumbnail" className={navClass(pathname.startsWith('/app/studio'))}>
        마케팅 스튜디오
      </Link>
      <div>
        <span className={`${navClass(opsActive)} cursor-default`}>운영</span>
        {/* 운영 활성 시에만 하위 아코디언 펼침(LIB-00) */}
        {opsActive && (
          <div className="mt-1 flex flex-col gap-0.5 pl-3">
            {OPS_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                    active ? 'font-semibold text-[#D93636]' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {item.label}
                  {item.href === '/app/matching' && matchBadge && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BADGE_TONES[matchBadge.tone]}`}>
                      {matchBadge.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );

  const accountRow = (
    <div className="border-t border-neutral-200 pt-3">
      <div className="flex items-center gap-2 px-1">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF6464] text-sm font-bold text-white"
        >
          {userName.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="text-xs text-neutral-500">{providerLabel} 연결됨</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 px-1 text-xs">
        <Link href="/app/account" className="text-neutral-600 underline hover:text-[#D93636]">
          마이페이지
        </Link>
        <span aria-hidden className="text-neutral-300">·</span>
        <button type="button" onClick={() => void handleLogout()} disabled={busy} className="text-neutral-600 underline hover:text-[#D93636]">
          {busy ? '로그아웃 중…' : '로그아웃'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* PC 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-neutral-200 bg-white p-4 md:flex">
        <Link href="/app" aria-label="KGLOW 홈">
          <KglowLogo className="h-6" uid="shell-logo" />
        </Link>
        {nav}
        {accountRow}
      </aside>

      {/* 모바일 상단 바(반응형 대응만 — 기획서 §0) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
          <Link href="/app" aria-label="KGLOW 홈">
            <KglowLogo className="h-5" uid="shell-logo-m" />
          </Link>
          <nav className="flex items-center gap-3 text-xs" aria-label="전역 내비게이션(모바일)">
            <Link href="/app/report/new" className="text-neutral-700">리포트</Link>
            <Link href="/app/studio/thumbnail" className="text-neutral-700">스튜디오</Link>
            <Link href="/app/library" className="text-neutral-700">운영</Link>
            <Link href="/app/account" className="text-neutral-700">계정</Link>
          </nav>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
