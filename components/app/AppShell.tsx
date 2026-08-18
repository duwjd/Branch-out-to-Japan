'use client';

/**
 * 앱 셸 — 좌측 사이드바(펼침 248px · 접힘 64px 아이콘 레일) + 본문(상단 중앙 코랄 글로우).
 * 디자인 정본: docs/specs/00-main/1-home.html MAIN-01 (2026-07-24 개정 — 성숙도 배지·KPI 위젯·
 * 품의용 PDF를 사이드바에서 제거하고 접기/펼치기 아이콘 레일을 추가).
 * 구성: (접기 토글) → 워드마크 → 3축 내비(운영 하위 아코디언) → 계정 행.
 * 2026-08-18 개편: 계정당 브랜드 1개 전제로 브랜드 스위처·추가를 없앴고, /app 이하는 로그인
 * 필수라 게스트 CTA도 없앴다(로그인은 랜딩에서만). 상단 브랜드 정보 행도 제거했다 —
 * 브랜드는 운영 > 브랜드 관리와 홈 위젯에서 다룬다(내비에 같은 정보를 두 번 두지 않는다).
 * 접힘은 ≥lg(1024px)에서만 적용되고 상태는 localStorage로 페이지 간 유지된다.
 * 1024px 미만에서는 사이드바가 상단 블록으로 접히며 접기 토글은 자동 no-op(숨김)이다.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { YoakeLogo, YoakeMark } from '@/components/brand/Logo';
import { StatusBadge, type BadgeTone } from '@/components/ui/primitives';
import {
  IconBox,
  IconChevronLeft,
  IconChevronUp,
  IconDoc,
  IconHome,
  IconImage,
} from '@/components/ui/icons';

interface ShellProps {
  /** 로그인 세션 유저 — /app 이하는 로그인 필수라 항상 존재한다 */
  user: { name: string; email: string; providerLabel: string };
  /** 기업 매칭 상태 배지(LIB-07) — null이면 미신청(배지 없음). 성숙도 배지가 아닌 라이브 상태 배지 */
  matchBadge: { label: string; tone: 'amber' | 'green' | 'neutral' } | null;
  children: React.ReactNode;
}

const OPS_ITEMS = [
  { href: '/app/library', label: '자산 라이브러리' },
  { href: '/app/brand', label: '브랜드 관리' },
  { href: '/app/matching', label: '기업 매칭' },
];

/** matchBadge tone → StatusBadge tone */
const MATCH_TONE: Record<'amber' | 'green' | 'neutral', BadgeTone> = {
  amber: 'warn',
  green: 'ok',
  neutral: 'off',
};

/** ≥lg 접힘(아이콘 레일)에서 숨길 라벨·텍스트. 라벨은 DOM에 유지하고 시각만 숨겨 모바일 스택은 무영향 */
const HIDE_ON_RAIL = 'lg:group-data-[collapsed=true]:hidden';
/** 접힘 상태 지속 키 */
const COLLAPSE_KEY = 'yoake:sidebar-collapsed';

/** 3축 내비 항목 클래스 — 접힘 시 아이콘만 가운데 정렬 */
function navClass(active: boolean): string {
  return [
    'flex h-[42px] items-center gap-2.5 rounded-[10px] px-3 text-[13.5px] font-semibold no-underline transition-colors',
    'lg:group-data-[collapsed=true]:justify-center lg:group-data-[collapsed=true]:gap-0 lg:group-data-[collapsed=true]:px-0',
    active ? 'bg-coral-tint text-coral-strong font-bold' : 'text-ink-body hover:bg-n-100 hover:text-ink',
  ].join(' ');
}

/** 운영 하위 메뉴 항목 클래스 */
function subClass(active: boolean): string {
  return [
    'flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold no-underline transition-colors',
    active ? 'bg-coral-tint text-coral-strong font-bold' : 'text-ink-mute hover:bg-n-100 hover:text-ink',
  ].join(' ');
}

export function AppShell({ user, matchBadge, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [avOpen, setAvOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const avRef = useRef<HTMLDivElement>(null);

  const dashActive = pathname === '/app';
  const reportActive = pathname.startsWith('/app/report');
  const studioActive = pathname.startsWith('/app/studio');
  const opsActive = OPS_ITEMS.some((i) => pathname.startsWith(i.href));

  /* 접힘 상태 localStorage 복원 — 초기값 false로 렌더한 뒤 마운트 후 반영(하이드레이션 미스매치 방지) */
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  /** 접기/펼치기 토글(MAIN-01 2026-07-24) — 상태를 localStorage로 페이지 간 유지 */
  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  /* 드롭다운: 바깥 클릭·Esc 닫힘 */
  useEffect(() => {
    if (!avOpen) return;
    function onDown(e: MouseEvent) {
      if (!avRef.current?.contains(e.target as Node)) setAvOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAvOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [avOpen]);

  /* 경로가 바뀌면 드롭다운 닫기 */
  useEffect(() => {
    setAvOpen(false);
  }, [pathname]);

  /** 목 세션 종료 후 로그인으로 */
  async function handleLogout() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  /* ── 1c · 3축 내비 (성숙도 배지 제거 · 2026-07-24) ─────── */
  const nav = (
    <nav className="mt-1 flex flex-col gap-0.5" aria-label="주요 메뉴">
      <Link href="/app" className={navClass(dashActive)} aria-current={dashActive ? 'page' : undefined}>
        <IconHome className={dashActive ? 'text-coral-strong' : 'text-ink-mute'} />
        <span className={HIDE_ON_RAIL}>홈</span>
      </Link>
      <Link href="/app/report/new" className={navClass(reportActive)} aria-current={reportActive ? 'page' : undefined}>
        <IconDoc className={reportActive ? 'text-coral-strong' : 'text-ink-mute'} />
        <span className={HIDE_ON_RAIL}>진단 리포트</span>
      </Link>
      <Link href="/app/studio" className={navClass(studioActive)} aria-current={studioActive ? 'page' : undefined}>
        <IconImage className={studioActive ? 'text-coral-strong' : 'text-ink-mute'} />
        <span className={HIDE_ON_RAIL}>마케팅 스튜디오</span>
      </Link>
      <Link href="/app/library" className={navClass(opsActive)}>
        <IconBox className={opsActive ? 'text-coral-strong' : 'text-ink-mute'} />
        <span className={HIDE_ON_RAIL}>운영</span>
      </Link>
      {/* LIB-00 · 운영 활성 시에만 펼치는 하위 아코디언 — 레일(접힘)에서는 숨김 */}
      {opsActive && (
        <ul
          className={`relative mt-0.5 mb-1.5 ml-[21px] list-none pl-3 before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-n-150 ${HIDE_ON_RAIL}`}
        >
          {OPS_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} className={subClass(active)} aria-current={active ? 'page' : undefined}>
                  {item.label}
                  {item.href === '/app/matching' && matchBadge && (
                    <StatusBadge tone={MATCH_TONE[matchBadge.tone]} className="ml-auto h-[18px] text-[9.5px]">
                      {matchBadge.label}
                    </StatusBadge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );

  /* ── 1e · 계정 (사이드바 최하단 · 품의 PDF는 2026-07-24 제거) ─── */
  const sideFoot = (
    <div className="mt-3 border-t border-hairline pt-3">
      <div ref={avRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={avOpen}
          aria-label="계정 메뉴"
          onClick={() => setAvOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 py-[7px] text-left transition-colors hover:bg-n-50 lg:group-data-[collapsed=true]:justify-center lg:group-data-[collapsed=true]:px-0"
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-coral/35 bg-coral-tint text-xs font-extrabold text-coral-strong"
          >
            {user.name.slice(0, 1)}
          </span>
          <span className={`min-w-0 flex-1 ${HIDE_ON_RAIL}`}>
            <span className="block truncate text-[12.5px] leading-tight font-bold text-ink">{user.name}</span>
            <span className="block truncate text-[10.5px] leading-tight text-ink-mute">{user.email}</span>
          </span>
          <IconChevronUp className={`flex-none text-ink-faint ${HIDE_ON_RAIL}`} />
        </button>
        {avOpen && (
          <div
            role="menu"
            className="absolute inset-x-0 bottom-[calc(100%+6px)] z-70 rounded-xl border border-card-border bg-canvas p-1.5 shadow-2 animate-drop-in lg:group-data-[collapsed=true]:right-auto lg:group-data-[collapsed=true]:min-w-[200px]"
          >
            <Link
              href="/app/account"
              role="menuitem"
              aria-current={pathname.startsWith('/app/account') ? 'page' : undefined}
              className={`block w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold no-underline transition-colors ${
                pathname.startsWith('/app/account') ? 'bg-coral-tint text-coral-strong' : 'text-ink-body hover:bg-n-50'
              }`}
            >
              마이페이지
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              disabled={busy}
              className="block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold text-ink-body transition-colors hover:bg-n-50 disabled:opacity-50"
            >
              {busy ? '로그아웃 중…' : '로그아웃'}
            </button>
          </div>
        )}
        <p className="sr-only">{user.providerLabel} 연결됨</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-stretch max-lg:flex-col">
      {/* 사이드바 — 1024px 미만에서 상단 블록으로. 접힘(≥lg)은 data-collapsed로 구동(group) */}
      <aside
        aria-label="전역 내비게이션"
        data-collapsed={collapsed ? 'true' : 'false'}
        className="group flex w-sidebar flex-none flex-col border-r border-hairline bg-canvas px-3.5 pt-[18px] pb-3.5 transition-[width] duration-200 max-lg:static max-lg:h-auto max-lg:w-auto max-lg:border-r-0 max-lg:border-b lg:sticky lg:top-0 lg:h-screen lg:data-[collapsed=true]:w-16 lg:data-[collapsed=true]:px-2"
      >
        {/* 접기/펼치기 토글 — ≤lg(상단 블록)에서는 숨김(자동 no-op) */}
        <button
          type="button"
          onClick={toggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className="mb-1.5 inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center self-end rounded-lg border border-card-border bg-canvas text-ink-mute transition-colors hover:bg-n-100 hover:text-ink max-lg:hidden lg:group-data-[collapsed=true]:self-center"
        >
          <IconChevronLeft className="transition-transform lg:group-data-[collapsed=true]:rotate-180" />
        </button>

        {/* 1a · 로고 — 접힘 시 일출 마크만 남긴다(정사각 자리 정본 자산) */}
        <Link
          href="/app"
          aria-label="YOAKE 홈"
          className="block px-2.5 pt-1 pb-4 lg:group-data-[collapsed=true]:px-0 lg:group-data-[collapsed=true]:text-center"
        >
          <YoakeLogo className={`h-[22px] w-auto ${HIDE_ON_RAIL}`} uid="shell-logo" />
          <YoakeMark
            aria-hidden
            className="hidden h-[26px] w-[26px] lg:group-data-[collapsed=true]:inline-block"
            uid="shell-mark"
          />
        </Link>
        {nav}
        <span className="flex-1 max-lg:hidden" aria-hidden />
        {sideFoot}
      </aside>

      {/* 본문 — 상단 중앙 코랄 글로우 */}
      <div className="main-glow min-w-0 flex-1">{children}</div>
    </div>
  );
}
