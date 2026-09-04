'use client';

/**
 * 랜딩 상단 헤더 — Figma Header(sticky). 최상단은 배경만, 스크롤하면 반투명 흰 배경 + 하단 보더.
 * 로그인은 여기 한 곳에서만 시작한다(서비스 내부에는 로그인 동선이 없다).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { YoakeLogo } from '@/components/brand/Logo';
import { NAV_LINKS } from './content';
import { sendTrack } from '@/components/landing/track';

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200 ease-standard ${
        scrolled ? 'border-b border-lp-line bg-white/85 backdrop-blur' : 'border-b border-transparent bg-lp-surface'
      }`}
    >
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-[120px] max-lg:px-10 max-sm:px-5">
        <Link href="/" aria-label="YOAKE 홈" className="flex items-center">
          <YoakeLogo className="h-[22px] w-auto" uid="lp-header-logo" />
        </Link>

        <nav aria-label="주요 메뉴" className="flex items-center gap-9 max-lg:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-lp-body no-underline hover:text-lp-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <Link href="/login" className="text-[15px] font-semibold text-lp-ink no-underline hover:underline">
            로그인
          </Link>
          <a
            href="#apply"
            onClick={() => sendTrack('cta_click', { cta: 'header_pilot' })}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-lp-coral px-[22px] text-[15px] font-semibold text-white no-underline transition-[filter] duration-200 ease-standard hover:brightness-95 max-sm:hidden"
          >
            무료 파일럿 신청
          </a>
        </div>
      </div>
    </header>
  );
}
