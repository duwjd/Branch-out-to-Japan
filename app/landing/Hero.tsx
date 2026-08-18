/**
 * Hero — 눈썹 → H1 2줄 → 리드 2줄 → 태그 3 → CTA 2.
 * Figma의 Hero_Visual(입력→진단→제작 목업)은 원본이 원격 SVG 자산이라 이 환경에서 내려받지 못했다.
 * 목업을 임의로 다시 그리면 실제 화면과 다른 약속을 하게 되므로, 아래 ProductExample 섹션이
 * 같은 이야기를 텍스트와 실제 문구로 대신한다.
 */

import { HERO } from './content';
import { LpChip, LpEyebrow, LpSection, lpButtonClass } from './primitives';
import { TrackedCta } from '@/components/landing/TrackedCta';

export function Hero() {
  return (
    <LpSection tone="warm" className="relative overflow-hidden">
      {/* 새벽 글로우 — 로고의 일출과 같은 결. 장식이라 스크린리더에서 제외한다 */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,111,97,0.16),transparent)]"
      />
      <div className="relative mx-auto flex max-w-[900px] flex-col items-center gap-5 text-center">
        <LpEyebrow>{HERO.eyebrow}</LpEyebrow>
        <h1 className="text-lp-h1 font-bold break-keep text-lp-ink max-lg:text-[44px] max-sm:text-[32px] [text-wrap:balance]">
          {HERO.headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="text-lp-lead break-keep text-lp-body max-sm:text-[16px] [text-wrap:pretty]">
          {HERO.lead.map((line) => (
            <span key={line} className="block max-sm:inline">
              {line}{' '}
            </span>
          ))}
        </p>

        <ul className="mt-2 flex list-none flex-wrap justify-center gap-2.5">
          {HERO.tags.map((tag) => (
            <li key={tag}>
              <LpChip>{tag}</LpChip>
            </li>
          ))}
        </ul>

        <div className="mt-3.5 flex flex-wrap justify-center gap-3.5">
          <TrackedCta cta="hero_pilot" targetId="apply" className={lpButtonClass('primary', 'min-w-[180px]')}>
            {HERO.primaryCta}
          </TrackedCta>
          <a href="#service" className={lpButtonClass('secondary', 'min-w-[180px]')}>
            {HERO.secondaryCta}
          </a>
        </div>
      </div>
    </LpSection>
  );
}
