'use client';

import { useEffect, useState } from 'react';

/**
 * 페이지 상단 얇은 코랄 진행바 — "얼마나 남았나"를 조용히 알려 끝까지 스크롤을 유도한다.
 * 정보성 표시라 reduced-motion에서도 유지하되, 장식적 모션은 없다(폭만 스크롤에 연동).
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        setProgress(max > 0 ? Math.min(1, doc.scrollTop / max) : 0);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[3px]" aria-hidden="true">
      <div
        className="h-full origin-left bg-coral"
        style={{ transform: `scaleX(${progress})`, transition: 'transform 90ms linear' }}
      />
    </div>
  );
}
