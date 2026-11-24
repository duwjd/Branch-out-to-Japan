/**
 * Hero — 눈썹 → H1 2줄 → 리드 2줄 → 태그 3 → CTA 2 → Hero_Visual(입력→진단→제작 목업).
 *
 * 첫 화면은 영상(HeroVideoStage)이 차지하고, 이 블록은 그 바로 아래에서 영상을 덮으며 올라온다.
 * 그래서 섹션 자체에는 배경을 두지 않고(tone="clear") 바탕을 직접 그린다 — 태블릿 폭(md) 이상에서는 윗변 140px 을
 * 투명에서 크림으로 풀어, 고정된 영상이 선 없이 부드럽게 가려지게 한다.
 */

import { HERO } from './content';
import { LpChip, LpEyebrow, LpSection, lpButtonClass } from './primitives';
import { TrackedCta } from '@/components/landing/TrackedCta';
import { Reveal } from '@/components/landing/Reveal';
import { HeroVisual } from './HeroVisual';

/** 영상의 스크롤 안내가 가리키는 앵커 */
export const HERO_INTRO_ID = 'intro';

export function Hero() {
  return (
    <LpSection id={HERO_INTRO_ID} tone="clear" className="relative overflow-hidden">
      {/*
        새벽 글로우 — 로고의 일출과 같은 결. 시안 실측: 위쪽 47%는 크림 그대로 평평하고,
        거기서부터 아래로 코랄 틴트까지 번진다(상단 중앙 글로우가 아니다). 장식이라 스크린리더에서 제외한다.
        태블릿 폭(md) 이상에서는 맨 위 140px 이 투명 → 크림으로 번져, 뒤에 고정된 영상을 경계선 없이 덮는다.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-page)_47%,var(--color-coral-tint)_100%)] md:bg-[linear-gradient(to_bottom,rgb(250_248_245/0)_0,var(--color-page)_140px,var(--color-page)_47%,var(--color-coral-tint)_100%)]"
      />
      <Reveal className="relative mx-auto flex max-w-[900px] flex-col items-center gap-5 text-center">
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
      </Reveal>

      <div className="relative mx-auto mt-0 w-full max-w-[1200px]">
        <HeroVisual />
      </div>
    </LpSection>
  );
}
