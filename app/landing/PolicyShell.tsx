/**
 * 정책 문서 껍데기 — 개인정보처리방침·이용약관 공용.
 * 시안 푸터의 '정책·문의' 링크가 실제로 도착할 곳이 필요해 만든 최소 골격이다.
 * 본문은 확정되는 대로 채운다(법무 확인 전이라 임의로 조항을 쓰지 않는다).
 */

import type { ReactNode } from 'react';
import { LandingHeader } from './Header';
import { LandingFooter } from './Footer';

export function PolicyShell({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <>
      <LandingHeader />
      <main className="bg-white">
        <div className="mx-auto max-w-[860px] px-[120px] py-[120px] max-lg:px-10 max-lg:py-20 max-sm:px-5 max-sm:py-14">
          <h1 className="text-lp-h2 font-bold break-keep text-lp-ink max-sm:text-[30px]">{title}</h1>
          <p className="mt-5 text-lp-lead break-keep text-lp-body max-sm:text-[16px]">{lead}</p>

          <div className="mt-10 rounded-panel border border-lp-line bg-lp-surface px-6 py-5">
            <p className="text-lp-body text-lp-body break-keep">
              문서 준비 중입니다. 확정 전까지 문의는{' '}
              <a href="mailto:hello@yoake.kr" className="font-semibold text-coral-strong underline underline-offset-2">
                hello@yoake.kr
              </a>
              로 주시면 안내해 드립니다.
            </p>
          </div>

          {children}
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
