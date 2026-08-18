'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 스크롤 진입 시 한 번 fade-up 하는 래퍼 — "이미 보이는 기본"을 강화만 한다.
 * 콘텐츠는 항상 렌더(opacity 1)되고, JS·모션 허용 시에만 진입 애니메이션을 얹는다.
 * (no-JS·크롤러·prefers-reduced-motion에서는 그대로 노출 — 가시성을 클래스에 의존하지 않는다.)
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** 스태거용 지연(ms) */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.animate(
            [
              { opacity: 0, transform: 'translateY(18px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            { duration: 640, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
          );
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
