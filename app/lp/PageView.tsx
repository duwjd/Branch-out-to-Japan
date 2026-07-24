'use client';

import { useEffect, useRef } from 'react';
import { sendTrack } from './track';

/**
 * 마운트 시 1회 pageview 이벤트를 전송한다. 화면에는 아무것도 렌더하지 않는다.
 * StrictMode의 effect 이중 실행으로 중복 전송되지 않도록 ref로 가드한다.
 */
export function PageView() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    sendTrack('pageview');
  }, []);

  return null;
}
