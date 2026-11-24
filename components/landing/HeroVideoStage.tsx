'use client';

/**
 * 랜딩 첫 화면 — 제품 소개 영상을 헤더 아래에 고정해 두고, 스크롤하면 뒤따르는 내용(children)이 그 위로 올라온다.
 *
 * 스크롤 전환은 두 겹이다.
 * - 고정(sticky): 영상 구역이 헤더 아래에 붙어 있고 children 이 그 위를 덮으며 올라온다. JS 없이도 동작한다.
 * - 진행률(--hero-p, 0→1): 덮이는 만큼 영상이 조금 줄어들고 흐려지며 스크롤 안내가 사라진다(app/globals.css `.lp-hero-*`).
 *
 * 고정과 변형은 태블릿 폭(md, 768px) 이상에서, 모션 최소화를 켜지 않은 경우에만 건다. 그 밖에는 영상 → 내용이 위아래로 그냥 이어진다.
 *
 * 재생 규칙: 소리 없는 반복 재생이며 5초를 넘으므로 멈춤 버튼을 둔다(WCAG 2.2.2).
 * 모션 최소화·데이터 절약이 켜져 있으면 자동 재생하지 않고 포스터만 보여 준다. 가려지면 스스로 멈췄다가 돌아오면 다시 튼다.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** 영상이 다 가려졌다고 보는 진행률 — 이 뒤로는 재생을 멈춘다 */
const COVERED_AT = 0.98;
/** 다시 틀기 시작하는 진행률 — 경계에서 멈춤·재생이 떨리지 않게 간격을 둔다 */
const UNCOVERED_AT = 0.9;

export interface HeroVideoLabels {
  /** 구역 이름 — 짧게(예: "제품 소개 영상") */
  region: string;
  /** 영상이 무엇을 보여 주는지 — 스크린리더용 대체 설명 */
  description: string;
  play: string;
  pause: string;
  /** 아래 소개로 내려가는 안내 링크의 이름 */
  scrollCue: string;
}

/**
 * 브라우저가 "데이터 절약"을 켰는지 — 지원하지 않는 브라우저에서는 false.
 * @returns 절약 모드면 true
 */
function prefersSaveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

export function HeroVideoStage({
  children,
  labels,
  poster,
  webm,
  mp4,
  targetId,
}: {
  /** 영상 뒤에 이어지는 내용 — 스크롤하면 영상 위로 올라온다 */
  children: ReactNode;
  labels: HeroVideoLabels;
  /** 포스터 = 영상의 0프레임(재생이 시작될 때 화면이 바뀌지 않는다) */
  poster: string;
  webm: string;
  mp4: string;
  /** 스크롤 안내가 가리키는 섹션 id(# 제외) */
  targetId: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  /** 사용자가 직접 멈췄는가 — 그렇다면 화면에 돌아와도 다시 틀지 않는다 */
  const userPausedRef = useRef(false);
  /** 가려져서 우리가 멈췄는가 */
  const autoPausedRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  // 재생 상태는 영상 이벤트에서만 읽는다 — 자동 재생이 막힌 경우에도 버튼이 실제 상태를 따른다
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    // React 는 muted 를 속성으로 내보내지 않아, 재생 전에 직접 켜야 자동 재생 정책을 통과한다
    video.muted = true;
    video.defaultMuted = true;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && !prefersSaveData()) {
      // 저전력 모드 등으로 막히면 포스터가 남고, 버튼으로 직접 틀 수 있다
      video.play().catch(() => undefined);
    }
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, []);

  // 스크롤 진행률 → CSS 변수. 상태로 올리지 않고 스타일에 바로 써서 프레임마다 리렌더하지 않는다
  useEffect(() => {
    const root = rootRef.current;
    const pin = pinRef.current;
    if (!root || !pin) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const distance = pin.offsetHeight || 1;
      const progress = Math.min(1, Math.max(0, window.scrollY / distance));
      root.style.setProperty('--hero-p', progress.toFixed(4));

      const video = videoRef.current;
      if (!video) return;
      if (progress >= COVERED_AT && !video.paused) {
        autoPausedRef.current = true;
        video.pause();
      } else if (progress <= UNCOVERED_AT && autoPausedRef.current) {
        autoPausedRef.current = false;
        if (!userPausedRef.current) video.play().catch(() => undefined);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(raf);
    };
  }, []);

  /** 멈춤·재생 전환 — 사용자의 선택을 기억해 스크롤로 되돌아와도 뒤집지 않는다 */
  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      video.play().catch(() => undefined);
    } else {
      userPausedRef.current = true;
      video.pause();
    }
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <section
        ref={pinRef}
        aria-label={labels.region}
        className="lp-hero-pin relative z-0 flex flex-col items-center justify-center bg-lp-surface px-[120px] max-lg:px-10 max-lg:pt-6 max-sm:px-5"
      >
        <div className="lp-hero-frame relative">
          <video
            ref={videoRef}
            className="lp-hero-video block aspect-video w-full"
            poster={poster}
            width={1920}
            height={1080}
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            aria-label={labels.description}
          >
            <source src={webm} type="video/webm" />
            <source src={mp4} type="video/mp4" />
          </video>

          {/* 멈춤·재생 — 영상 안 카드 아래의 빈 띠(왼쪽)에 얹는다. 좁은 화면에서는 띠가 얇아 영상 아래로 내린다 */}
          <button
            type="button"
            onClick={toggle}
            className="absolute bottom-[1.4%] left-[4.2%] inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-lp-line bg-white pr-3.5 pl-3 text-[13px] font-semibold text-lp-body transition-colors duration-200 ease-standard hover:border-lp-line-strong hover:text-lp-ink max-lg:static max-lg:mt-2"
          >
            <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 flex-none fill-current">
              {playing ? <path d="M2.5 1.5h2.4v9H2.5zM7.1 1.5h2.4v9H7.1z" /> : <path d="M3 1.3 10.2 6 3 10.7z" />}
            </svg>
            {playing ? labels.pause : labels.play}
          </button>
        </div>

        {/* 스크롤 안내 — 첫 화면이 영상뿐이라 아래에 내용이 있음을 알린다. 덮이기 시작하면 사라진다 */}
        <a
          href={`#${targetId}`}
          aria-label={labels.scrollCue}
          className="lp-hero-cue absolute bottom-5 left-1/2 -ml-5 flex h-10 w-10 items-center justify-center rounded-full border border-lp-line bg-white text-lp-ink no-underline transition-colors duration-200 ease-standard hover:border-lp-line-strong max-md:hidden"
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-4 w-4 fill-none stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 6 8 10.5 12.5 6" />
          </svg>
        </a>
      </section>

      {/* 뒤따르는 내용은 영상보다 위 층에서 흐른다 — 고정된 영상을 덮으며 올라온다 */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
