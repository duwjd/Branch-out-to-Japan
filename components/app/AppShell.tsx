'use client';

/**
 * 앱 셸 — 좌측 248px 고정 사이드바 + 본문(상단 중앙 코랄 글로우).
 * 디자인 정본: docs/specs/00-main/1-home.html MAIN-01~02 (셸 마크업).
 * 구성: 워드마크 → 브랜드 스위처 → 3축 내비(+성숙도 배지, 운영 하위 아코디언)
 *       → KPI 위젯 → 품의용 PDF · 계정 행(드롭업 메뉴).
 * 1024px 미만에서는 사이드바가 상단 블록으로 접힌다(디자인 §반응형).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { KglowLogo } from '@/components/brand/Logo';
import { StatusBadge, type BadgeTone } from '@/components/ui/primitives';
import {
  IconBox,
  IconChevronDown,
  IconChevronUp,
  IconDoc,
  IconDocDown,
  IconHome,
  IconImage,
} from '@/components/ui/icons';

interface ShellProps {
  userName: string;
  userEmail: string;
  providerLabel: string;
  /** 브랜드 프로필(스위처 표시용) — 미등록이면 null */
  brand: { name: string; category: string } | null;
  /** KPI 위젯 값 */
  kpi: { reportCount: number; thumbnailCount: number; latestScore: number | null; megawari: { dDay: number; month: string } };
  /** 품의용 PDF 진입점 — 최신 발행 리포트. 없으면 버튼 비노출 */
  latestReportId: string | null;
  /** 기업 매칭 상태 배지(LIB-07) — null이면 미신청(배지 없음) */
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

/** 카테고리 값 → 한/일 병기 라벨 (디자인: "스킨케어 / スキンケア"). 저장값은 Category 키다 */
const CATEGORY_LABELS: Record<string, { kr: string; ja: string }> = {
  skincare: { kr: '스킨케어', ja: 'スキンケア' },
  makeup: { kr: '메이크업', ja: 'メイク' },
  suncare: { kr: '선케어', ja: '日焼け止め' },
  cleansing: { kr: '클렌징', ja: 'クレンジング' },
};

/** 3축 내비 항목 클래스 */
function navClass(active: boolean): string {
  return [
    'flex h-[42px] items-center gap-2.5 rounded-[10px] px-3 text-[13.5px] font-semibold no-underline transition-colors',
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

export function AppShell({ userName, userEmail, providerLabel, brand, kpi, latestReportId, matchBadge, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [swOpen, setSwOpen] = useState(false);
  const [avOpen, setAvOpen] = useState(false);
  const swRef = useRef<HTMLDivElement>(null);
  const avRef = useRef<HTMLDivElement>(null);

  const dashActive = pathname === '/app';
  const reportActive = pathname.startsWith('/app/report');
  const studioActive = pathname.startsWith('/app/studio');
  const opsActive = OPS_ITEMS.some((i) => pathname.startsWith(i.href));
  const hasAssets = kpi.reportCount > 0 || kpi.thumbnailCount > 0;

  /* 드롭다운: 바깥 클릭·Esc 닫힘 */
  useEffect(() => {
    if (!swOpen && !avOpen) return;
    function onDown(e: MouseEvent) {
      if (swOpen && !swRef.current?.contains(e.target as Node)) setSwOpen(false);
      if (avOpen && !avRef.current?.contains(e.target as Node)) setAvOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSwOpen(false);
        setAvOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [swOpen, avOpen]);

  /* 경로가 바뀌면 드롭다운 닫기 */
  useEffect(() => {
    setSwOpen(false);
    setAvOpen(false);
  }, [pathname]);

  /** 목 세션 종료 후 로그인으로 */
  async function handleLogout() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const brandName = brand?.name ?? '브랜드 미설정';
  const brandCat = brand ? CATEGORY_LABELS[brand.category] : undefined;
  const brandInitial = brandName.slice(0, 1);

  /* ── 1b · 브랜드 프로필 스위처 ─────────────────────────── */
  const brandSwitcher = (
    <div ref={swRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={swOpen}
        onClick={() => setSwOpen((v) => !v)}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-[11px] border bg-canvas px-2.5 py-2 text-left transition-colors hover:border-coral ${
          swOpen ? 'border-coral bg-coral-tint' : 'border-input-border'
        }`}
      >
        <span
          aria-hidden
          className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-linear-135 from-[#ffe9df] to-[#ffcfb8] text-[11px] font-extrabold text-amber-text"
        >
          {brandInitial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-tight font-bold text-ink">{brandName}</span>
          <span className="block truncate text-[10.5px] leading-tight text-ink-mute">
            {brand ? (
              <>
                {brandCat?.kr ?? brand.category}
                {brandCat && (
                  <>
                    {' / '}
                    <span lang="ja">{brandCat.ja}</span>
                  </>
                )}
              </>
            ) : (
              '브랜드 관리에서 등록'
            )}
          </span>
        </span>
        <IconChevronDown className="flex-none text-[#70737c]" />
      </button>
      {swOpen && (
        <div
          role="listbox"
          aria-label="브랜드 프로필 전환"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-70 rounded-xl border border-card-border bg-canvas p-1.5 shadow-2 animate-drop-in"
        >
          <div role="option" aria-selected="true" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left">
            <span
              aria-hidden
              className="inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] bg-linear-135 from-[#ffe9df] to-[#ffcfb8] text-[10px] font-extrabold text-amber-text"
            >
              {brandInitial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-bold text-ink">{brandName}</span>
              <span className="block text-[10.5px] text-ink-mute">
                리포트 {kpi.reportCount} · 썸네일 {kpi.thumbnailCount}
              </span>
            </span>
            <span aria-hidden className="text-[13px] font-extrabold text-green-text">
              ✓
            </span>
          </div>
          <div aria-hidden className="mx-1 my-1.5 h-px bg-hairline" />
          <div
            aria-disabled="true"
            title="다중 브랜드 지원 범위 (미정)"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-ink-faint"
          >
            ＋ 브랜드 추가
            <span className="ml-auto rounded-full bg-n-150 px-[7px] py-0.5 text-[9.5px] font-bold text-[#9ca0a8]">미정</span>
          </div>
        </div>
      )}
    </div>
  );

  /* ── 1c · 3축 내비 ────────────────────────────────────── */
  const nav = (
    <nav className="mt-4 flex flex-col gap-0.5" aria-label="주요 메뉴">
      <Link href="/app" className={navClass(dashActive)} aria-current={dashActive ? 'page' : undefined}>
        <IconHome className={dashActive ? 'text-coral-strong' : 'text-ink-mute'} />
        대시보드
      </Link>
      <Link href="/app/report/new" className={navClass(reportActive)} aria-current={reportActive ? 'page' : undefined}>
        <IconDoc className={reportActive ? 'text-coral-strong' : 'text-ink-mute'} />
        진단 리포트
        <StatusBadge tone="ok" className="ml-auto">
          이용 가능 ○
        </StatusBadge>
      </Link>
      <Link href="/app/studio/thumbnail" className={navClass(studioActive)} aria-current={studioActive ? 'page' : undefined}>
        <IconImage className={studioActive ? 'text-coral-strong' : 'text-ink-mute'} />
        마케팅 스튜디오
        <StatusBadge tone="warn" className="ml-auto">
          썸네일 우선 △
        </StatusBadge>
      </Link>
      <Link href="/app/library" className={navClass(opsActive)}>
        <IconBox className={opsActive ? 'text-coral-strong' : 'text-ink-mute'} />
        운영
        <StatusBadge tone="warn" className="ml-auto">
          라이브러리 우선 △
        </StatusBadge>
      </Link>
      {/* LIB-00 · 운영 활성 시에만 펼치는 하위 아코디언 */}
      {opsActive && (
        <ul className="relative mt-0.5 mb-1.5 ml-[21px] list-none pl-3 before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-n-150">
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

  /* ── MAIN-02 · KPI 위젯 ───────────────────────────────── */
  const kpiWidget = (
    <div className="rounded-xl border border-card-border bg-n-50 px-3.5 py-3">
      <p className="mb-1 text-[11px] font-bold tracking-[0.01em] text-ink-mute">브랜드 자산</p>
      {hasAssets ? (
        <>
          <div className="flex items-baseline justify-between py-1 text-xs">
            <span className="text-ink-body">진단 리포트</span>
            <b className="text-[13px] font-bold text-ink">
              <span className="tnum">{kpi.reportCount}</span>건
            </b>
          </div>
          <div className="flex items-baseline justify-between py-1 text-xs">
            <span className="text-ink-body">생성 썸네일</span>
            <b className="text-[13px] font-bold text-ink">
              <span className="tnum">{kpi.thumbnailCount}</span>건
            </b>
          </div>
          {kpi.latestScore !== null && (
            <div className="flex items-baseline justify-between py-1 text-xs">
              <span className="text-ink-body">최근 진단 점수</span>
              <b className="text-[13px] font-bold text-ink">
                <span className="tnum">{kpi.latestScore}</span>
                <span className="font-semibold text-ink-faint">/100</span>
              </b>
            </div>
          )}
          <div className="flex items-baseline justify-between py-1 text-xs">
            <span className="text-ink-body">다음 메가와리</span>
            <b className="text-[13px] font-bold text-ink">
              D-<span className="tnum">{kpi.megawari.dDay}</span>
              <span className="font-semibold text-ink-faint"> · {kpi.megawari.month}</span>
            </b>
          </div>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-ink-faint">
          아직 자산이 없습니다.
          <br />첫 진단에서 시작됩니다.
        </p>
      )}
    </div>
  );

  /* ── 1d·1e · 품의 PDF + 계정 ──────────────────────────── */
  const sideFoot = (
    <div className="mt-3 border-t border-hairline pt-3">
      {latestReportId && (
        <Link
          href={`/app/report/${latestReportId}`}
          className="mb-2.5 flex h-[34px] w-full items-center justify-center gap-[7px] rounded-lg border border-input-border bg-canvas text-[13px] font-semibold text-ink-body no-underline transition-colors hover:bg-n-100"
        >
          <IconDocDown size={13} />
          품의용 PDF
        </Link>
      )}
      <div ref={avRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={avOpen}
          aria-label="계정 메뉴"
          onClick={() => setAvOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 py-[7px] text-left transition-colors hover:bg-n-50"
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-coral/35 bg-coral-tint text-xs font-extrabold text-coral-strong"
          >
            {userName.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] leading-tight font-bold text-ink">{userName}</span>
            <span className="block truncate text-[10.5px] leading-tight text-ink-mute">{userEmail}</span>
          </span>
          <IconChevronUp className="flex-none text-ink-faint" />
        </button>
        {avOpen && (
          <div
            role="menu"
            className="absolute inset-x-0 bottom-[calc(100%+6px)] z-70 rounded-xl border border-card-border bg-canvas p-1.5 shadow-2 animate-drop-in"
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
        <p className="sr-only">{providerLabel} 연결됨</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-stretch max-lg:flex-col">
      {/* 사이드바 — 1024px 미만에서 상단 블록으로 */}
      <aside
        aria-label="전역 내비게이션"
        className="flex w-sidebar flex-none flex-col border-r border-hairline bg-canvas px-3.5 pt-[18px] pb-3.5 max-lg:static max-lg:h-auto max-lg:w-auto max-lg:border-r-0 max-lg:border-b lg:sticky lg:top-0 lg:h-screen"
      >
        <Link href="/app" aria-label="KGLOW 대시보드" className="block px-2.5 pt-1 pb-4">
          <KglowLogo className="h-[22px] w-auto" uid="shell-logo" />
        </Link>
        {brandSwitcher}
        {nav}
        <span className="flex-1 max-lg:hidden" aria-hidden />
        <div className="max-lg:hidden">{kpiWidget}</div>
        {sideFoot}
      </aside>

      {/* 본문 — 상단 중앙 코랄 글로우 */}
      <div className="main-glow min-w-0 flex-1">{children}</div>
    </div>
  );
}
