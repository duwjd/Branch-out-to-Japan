/** 랜딩 푸터 — 로고 · 카테고리 서술어 · 링크 · 필수 고지 · 저작권 */

import Link from 'next/link';
import { YoakeLogo } from '@/components/brand/Logo';
import { FOOTER } from './content';

export function LandingFooter() {
  return (
    <footer className="border-t border-lp-line bg-lp-surface">
      <div className="mx-auto max-w-[1440px] px-[120px] py-12 max-lg:px-10 max-sm:px-5">
        <YoakeLogo className="h-[23px] w-auto" uid="lp-footer-logo" />
        <p className="mt-3 text-[14px] text-lp-muted">{FOOTER.tagline}</p>

        <nav aria-label="푸터 메뉴" className="mt-6 flex flex-wrap gap-x-7 gap-y-2">
          {FOOTER.links.map((link) =>
            link.href.startsWith('#') ? (
              <a key={link.href} href={link.href} className="text-[14px] text-lp-body no-underline hover:text-lp-ink">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="text-[14px] text-lp-body no-underline hover:text-lp-ink">
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <hr className="mt-8 border-lp-line" />
        <p className="mt-6 text-[14px] text-lp-muted">{FOOTER.disclosure}</p>
        <p className="mt-1.5 text-[14px] text-lp-faint">{FOOTER.copyright}</p>
      </div>
    </footer>
  );
}
