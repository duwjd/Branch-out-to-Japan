/**
 * 진행 표시 공용 — 매칭 스테퍼 · 파이프라인 단계 리스트 · 검수 게이트 배지.
 * 상태는 색+글자+기호(○/△/✕) 3중 표기.
 */

/** 3단 스테퍼(매칭) — done ○ green / current 코랄 / todo neutral */
export function Stepper({
  steps,
  currentIdx,
  className = '',
}: {
  steps: { label: string; date?: string }[];
  /** 현재 단계 인덱스. 이전 단계는 done, 이후는 todo */
  currentIdx: number;
  className?: string;
}) {
  return (
    <ol className={`flex ${className}`}>
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const cur = i === currentIdx;
        return (
          <li
            key={step.label}
            aria-current={cur ? 'step' : undefined}
            className={`relative flex-1 pt-9 text-center text-xs font-semibold ${
              cur ? 'font-bold text-ink' : 'text-ink-mute'
            }`}
          >
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-[13px] left-[-50%] h-0.5 w-full ${done || cur ? 'bg-green' : 'bg-n-150'}`}
              />
            )}
            <span
              aria-hidden
              className={`absolute top-0 left-1/2 z-1 inline-flex h-[27px] w-[27px] -translate-x-1/2 items-center justify-center rounded-full text-xs font-extrabold ${
                done
                  ? 'bg-green-bg text-green-text'
                  : cur
                    ? 'border-[1.5px] border-coral bg-coral-tint text-coral-strong'
                    : 'bg-n-150 text-[#9ca0a8]'
              }`}
            >
              {done ? '○' : i + 1}
            </span>
            {step.label}
            {step.date && <span className="mt-0.5 block text-[10.5px] font-medium text-ink-faint">{step.date}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 파이프라인 단계 리스트 — 완료 ✓(green) / 현재 코랄 pulse / 대기 dot.
 * 대시보드 진행 패널 · 스튜디오 생성중 · 리포트 처리 화면 공유.
 */
export function StageList({
  stages,
  activeIdx,
  className = '',
}: {
  stages: string[];
  /** 현재 진행 중 단계 인덱스. stages.length 이상이면 전부 완료 */
  activeIdx: number;
  className?: string;
}) {
  return (
    <ul className={`flex flex-col gap-2 ${className}`}>
      {stages.map((stage, i) => {
        const done = i < activeIdx;
        const cur = i === activeIdx;
        return (
          <li
            key={stage}
            className={`flex items-center gap-2.5 text-[12.5px] ${
              cur ? 'font-bold text-ink' : done ? 'font-semibold text-green-text' : 'font-medium text-ink-faint'
            }`}
          >
            <span
              aria-hidden
              className={`inline-flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-extrabold ${
                done
                  ? 'bg-green-bg text-green-text'
                  : cur
                    ? 'bg-coral-tint text-coral-strong animate-soft-pulse'
                    : 'bg-n-150 text-ink-faint'
              }`}
            >
              {done ? '✓' : '·'}
            </span>
            {stage}
            {cur && <span className="sr-only">(진행 중)</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** 검수 게이트 3항목 배지 — 통과 ○ / 실패 ✕ */
export function GateBadges({
  items,
  className = '',
}: {
  items: { label: string; pass: boolean }[];
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {items.map((item) => (
        <li
          key={item.label}
          className={`inline-flex h-[27px] items-center gap-1.5 rounded-full px-[11px] text-xs font-bold ${
            item.pass ? 'bg-green-bg text-green-text' : 'bg-danger-bg text-danger-text'
          }`}
        >
          {item.label} {item.pass ? '○' : '✕'}
        </li>
      ))}
    </ul>
  );
}

/** 인디터미네이트 진행 바 — 처리 화면 공용 */
export function IndetBar({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`h-1 overflow-hidden rounded-full bg-n-150 ${className}`}>
      <div className="h-full w-1/4 rounded-full bg-coral animate-indet" />
    </div>
  );
}
