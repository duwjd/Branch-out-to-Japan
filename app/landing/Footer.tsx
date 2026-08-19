/**
 * 랜딩 푸터 — 시안(LP_Nonmember_Desktop_v2) 기준 네이비 반전 면.
 * 좌측에 로고·카테고리 서술어, 우측에 레이블이 붙은 링크 3열, 헤어라인 아래 저작권·필수 고지.
 * 배경이 잉크색인 것은 `design/lp-components-spec.md` §3 FooterNav(#182333)와도 같다.
 */

import Link from 'next/link';
import { YoakeLogo } from '@/components/brand/Logo';
import { FOOTER } from './content';

/** 앵커(#)는 같은 페이지 스크롤이라 <a>, 라우트·mailto는 각각 Link·<a>로 나눈다 */
function FooterLink({ href, label }: { href: string; label: string }) {
  const cls = 'text-[14px] text-lp-on-navy-muted no-underline transition-colors duration-150 ease-standard hover:text-white';
  if (href.startsWith('#') || href.startsWith('mailto:')) {
    return (
      <a href={href} className={cls}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  );
}

export function LandingFooter() {
  return (
    <footer className="bg-lp-ink">
      <div className="mx-auto max-w-[1440px] px-[120px] py-16 max-lg:px-10 max-sm:px-5">
        <div className="flex justify-between gap-16 max-lg:flex-col max-lg:gap-12">
          <div>
            <YoakeLogo tone="onDark" className="h-[23px] w-auto" uid="lp-footer-logo" />
            <p className="mt-4 text-[14px] text-lp-on-navy-muted">{FOOTER.tagline}</p>
          </div>

          <nav aria-label="푸터 메뉴" className="flex gap-16 max-sm:flex-col max-sm:gap-8">
            {FOOTER.columns.map((col) => (
              <div key={col.title}>
                <h2 className="text-[14px] font-semibold text-white">{col.title}</h2>
                <ul className="mt-4 flex list-none flex-col gap-3">
                  {col.links.map((link) => (
                    <li key={`${col.title}-${link.label}`}>
                      <FooterLink href={link.href} label={link.label} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <hr className="mt-14 border-white/12" />
        <div className="mt-6 flex justify-between gap-8 max-sm:flex-col max-sm:gap-2">
          <p className="text-[14px] text-lp-on-navy-muted">{FOOTER.copyright}</p>
          <p className="text-[14px] text-lp-on-navy-muted">{FOOTER.disclosure}</p>
        </div>
      </div>
    </footer>
  );
}
