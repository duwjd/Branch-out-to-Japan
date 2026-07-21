'use client';

/** /app 세그먼트 오류 화면(MAIN-08) — ✕ 기호 + 재시도. 셸은 레이아웃이 유지한다. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[960px] px-8 pb-24">
      <div className="mt-[88px] rounded-card border border-card-border bg-canvas px-8 py-16 text-center shadow-card">
        <span
          aria-hidden
          className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-danger-bg text-base font-extrabold text-danger-text"
        >
          ✕
        </span>
        <h2 className="mt-3.5 text-lg font-extrabold text-ink">화면을 불러오지 못했습니다</h2>
        <p className="mt-2 text-[13px] text-ink-mute">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-10 cursor-pointer items-center rounded-[10px] bg-coral px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-coral-strong"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
