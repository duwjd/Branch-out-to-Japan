'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 실행 직전 게이트(GATE-00~04) — 제출이 401이면 로그인 모달을 띄우고, 인증 성공 시
 * 원래 액션을 자동 재개한다. 입력값은 호출측 React state에 그대로 살아 있어(모달은 페이지
 * 이동을 하지 않는다) 별도 보존 장치가 필요 없다(GATE-04). 취소 시 화면·입력 유지(GATE-03).
 */
export function useLoginGate() {
  const router = useRouter();
  const [gateOpen, setGateOpen] = useState(false);
  const pending = useRef<(() => void | Promise<void>) | null>(null);

  /** 401을 만난 액션(파라미터 없는 재시도 함수)을 보관하고 모달을 연다 */
  const openGate = useCallback((retry: () => void | Promise<void>) => {
    pending.current = retry;
    setGateOpen(true);
  }, []);

  /** 취소 = 재개 안 함(입력·화면은 그대로 유지) */
  const closeGate = useCallback(() => {
    pending.current = null;
    setGateOpen(false);
  }, []);

  /** 인증 성공 — 셸을 회원 상태로 갱신하고 보관해 둔 원래 액션을 재개한다 */
  const onAuthedGate = useCallback(() => {
    setGateOpen(false);
    router.refresh(); // 셸을 회원 상태로 갱신
    const retry = pending.current;
    pending.current = null;
    if (retry) void retry(); // GATE-02 원래 액션 재개(로그인으로 세션 쿠키가 이미 설정됨)
  }, [router]);

  return { gateOpen, openGate, closeGate, onAuthedGate };
}
