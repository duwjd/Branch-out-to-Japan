/**
 * Hero — 눈썹 → H1 2줄 → 리드 2줄 → 태그 3 → CTA 2 → Hero_Visual(입력→진단→제작 목업).
 */

import { HERO } from './content';
import { LpChip, LpEyebrow, LpSection, lpButtonClass } from './primitives';
import { TrackedCta } from '@/components/landing/TrackedCta';
import { HeroVisual } from './HeroVisual';

export function Hero() {
  return (
    <LpSection tone="warm" className="relative overflow-hidden">
      {/*
        새벽 글로우 — 로고의 일출과 같은 결. 시안 실측: 위쪽 47%는 크림 그대로 평평하고,
        거기서부터 아래로 코랄 틴트까지 번진다(상단 중앙 글로우가 아니다). 장식이라 스크린리더에서 제외한다.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-page)_47%,var(--color-coral-tint)_100%)]"
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

      <div className="relative mx-auto mt-0 w-full max-w-[1200px]">
        <HeroVisual />
      </div>
    </LpSection>
  );
}
