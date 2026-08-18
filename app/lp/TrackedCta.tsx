'use client';

import type { ReactNode } from 'react';
import { sendTrack } from './track';

/** 기본 CTA 스타일 — 코랄 primary(app/page.tsx 관례: bg-[#FF6464]/hover:bg-[#D93636]) */
const DEFAULT_CLASS =
  'inline-flex items-center justify-center rounded-lg bg-[#FF6464] px-6 py-3 text-lg font-bold text-white transition-colors hover:bg-[#D93636] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral';

/**
 * 클릭 시 cta_click 이벤트를 전송하고 페이지 내 앵커(targetId)로 스무스 스크롤하는 CTA.
 * 실제 이동은 <a href="#targetId">가 담당하고(html { scroll-behavior: smooth }), 클릭 측정만 얹는다.
 */
export function TrackedCta({
  cta,
  targetId,
  className,
  children,
}: {
  /** 어느 CTA인지 구분하는 식별자(예: 'hero-consult') — 트래킹 payload에 그대로 실린다 */
  cta: string;
  /** 스크롤 대상 섹션의 id(# 제외) */
  targetId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={`#${targetId}`} className={className ?? DEFAULT_CLASS} onClick={() => sendTrack('cta_click', { cta })}>
      {children}
    </a>
  );
}
