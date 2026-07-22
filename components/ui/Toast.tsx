/**
 * 토스트 — aria-live polite, 포커스를 훔치지 않는다.
 * variant 'dark' = 하단 중앙 다크(브랜드 전환·로그인 실패) / 'card' = 우하단 카드(생성 완료).
 */

export function Toast({
  show,
  variant = 'dark',
  children,
  className = '',
}: {
  show: boolean;
  variant?: 'dark' | 'card';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="contents">
      {show && (
        <div
          className={
            variant === 'dark'
              ? `fixed bottom-6 left-1/2 z-110 -translate-x-1/2 rounded-xl bg-[rgba(16,18,20,0.92)] px-4.5 py-3 text-[13px] font-semibold text-white shadow-2 animate-toast-in ${className}`
              : `fixed right-5 bottom-5 z-110 w-[324px] rounded-2xl border border-card-border bg-canvas p-4 shadow-2 animate-toast-in ${className}`
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}
