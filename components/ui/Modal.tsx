'use client';

/**
 * 모달 — 스크림 45% + 카드(modalIn). Esc·바깥 클릭 닫힘, 열릴 때 포커스 이동,
 * 닫히면 트리거로 포커스 복귀(호출부 버튼이 document.activeElement였다는 전제).
 */

import { useEffect, useRef } from 'react';

export function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** 모달 제목 요소의 id (aria-labelledby) */
  labelledBy: string;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();

    /** Esc로 닫기 */
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[rgba(16,18,20,0.45)] p-6 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="w-full max-w-[420px] rounded-2xl bg-canvas p-6 shadow-2 animate-modal-in focus:outline-none"
      >
        {children}
      </div>
    </div>
  );
}
