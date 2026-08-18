/**
 * /lp 전용 측정 헬퍼 — 순수 함수 모듈(부수효과는 호출 시점에만 발생).
 * 목적: 방문(pageview)·CTA 클릭(cta_click)·신청 완료(lead_submit)를 /api/track에 적립해
 * 지불의향(상담 신청)·관심(자료받기)을 구분해 잰다. 측정 실패가 사용자 경험을 막아선 안 되므로
 * 모든 전송은 실패해도 조용히 무시한다.
 */

import { resolveSource, type TrackEventType } from '@/lib/lead';

/** 현재 페이지의 유입 소스(utm_source > src > referrer 호스트 > direct). SSR 안전. */
export function getSource(): string {
  if (typeof window === 'undefined') return 'direct';
  return resolveSource(window.location.search, document.referrer);
}

/**
 * 퍼널 이벤트를 /api/track으로 전송한다. source·path는 지정하지 않으면 자동으로 채운다.
 * navigator.sendBeacon을 우선 쓰고(언로드 중에도 전송 보장), 지원하지 않으면 keepalive fetch로 대체한다.
 */
export function sendTrack(
  type: TrackEventType,
  opts?: { cta?: string; source?: string; path?: string }
): void {
  if (typeof window === 'undefined') return;

  const payload = {
    type,
    cta: opts?.cta,
    source: opts?.source ?? getSource(),
    path: opts?.path ?? window.location.pathname,
  };

  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/track', blob)) return;
    }
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* 측정 실패는 UX를 막지 않는다 */
    });
  } catch {
    /* 측정 실패는 UX를 막지 않는다 */
  }
}
