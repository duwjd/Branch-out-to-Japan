import Link from 'next/link';
import type { SeasonPhase, SeasonRunwayStep } from '@/lib/season';

/**
 * 홈 히어로(MAIN-03) — 시즌 D-day 한 장.
 *
 * 2026-08-20 개편: 다음 단계 밴드가 "다가오는 이벤트" 카드 안에 얹혀 있던 구조를 걷어내고,
 * 본문 맨 위 **카드 없는 페이지 머리**로 올렸다. 홈에 들어온 사람이 가장 먼저 읽어야 하는 것은
 * 대시보드라는 제목이 아니라 "다음 시즌까지 며칠 남았는가"라서, 그 숫자를 화면에서 제일 큰 요소로 둔다.
 * 구성: 브랜드 eyebrow → 큰 D-day → 한 줄 근거 → 시즌 눈금 → CTA 2개(화면 유일 primary).
 *
 * 상태에 따라 문구·CTA만 바뀌고 뼈대는 그대로다 — 첫 방문(자산 0)에서도 시즌은 똑같이 다가오므로
 * 숫자는 숨기지 않고 CTA만 "진단 시작"으로 바꾼다.
 */

export interface HeroCta {
  href: string;
  label: string;
}

/** 눈금 칸 색 — 면이라 코랄 원색을 쓴다(글자가 아니므로 대비 규칙 대상 아님) */
const PHASE_BAR: Record<SeasonPhase, string> = {
  now: 'bg-coral',
  prep: 'bg-bar-mid',
  later: 'bg-n-200',
};

/** 눈금 한 칸의 상태 문구 — 색만으로 읽히지 않게 sr-only 요약에 함께 쓴다 */
const PHASE_TEXT: Record<SeasonPhase, string> = {
  now: '지금 준비할 시즌',
  prep: '착수를 시작할 시즌',
  later: '아직 여유 있는 시즌',
};

/** "가을 신색 · 진행 중" / "크리스마스 코프레 D-1" / "9월 메가와리 오늘 시작" */
function stepLabel(step: SeasonRunwayStep): string {
  if (step.inProgress) return `${step.name} · 진행 중`;
  return step.dDay === 0 ? `${step.name} 오늘 시작` : `${step.name} D-${step.dDay}`;
}

/**
 * 시즌 눈금 — 임박순 시즌 이벤트를 한 칸씩 그린다. 진척률이 아니라 **다가오는 순서**다.
 * 눈금 자체는 aria-hidden 이고, 같은 내용을 sr-only 문장과 아래 캡션 두 줄이 글자로 전달한다.
 */
function SeasonRunwayBar({ steps, heroEventId }: { steps: SeasonRunwayStep[]; heroEventId: string }) {
  if (steps.length === 0) return null;

  const head = steps[0];
  // 오른쪽 캡션은 "그다음 마감" — 히어로가 이미 말하고 있는 이벤트는 건너뛴다(같은 D-day 두 번 금지)
  const next = steps.slice(1).find((s) => s.id !== heroEventId) ?? null;
  const nowCount = steps.filter((s) => s.phase !== 'later').length;

  return (
    <div className="mt-7 max-w-[680px]">
      <p className="sr-only">
        다가오는 시즌 {steps.length}건 중 {nowCount}건이 지금 준비할 구간입니다.
      </p>
      <div aria-hidden className="flex items-center gap-2">
        {steps.map((s) => (
          <span
            key={s.id}
            className={`h-1.5 flex-1 rounded-full ${PHASE_BAR[s.phase]}`}
            title={`${stepLabel(s)} — ${PHASE_TEXT[s.phase]}`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-5 text-[12px] text-ink-mute">
        <span className="min-w-0 truncate font-semibold">{stepLabel(head)}</span>
        {next && <span className="min-w-0 truncate text-right">{stepLabel(next)}</span>}
      </div>
    </div>
  );
}

/**
 * 홈 히어로 본체.
 * @param eyebrow 브랜드 · 카테고리 (브랜드 컨텍스트 — 어느 브랜드의 화면인지)
 * @param dDay 히어로 이벤트까지 남은 일수(0 = 오늘)
 * @param eventLabel 히어로 이벤트명("9월 메가와리")
 * @param heroEventId 히어로 이벤트 id — 시즌 눈금 캡션에서 중복을 피하는 데 쓴다
 */
export function HomeHero({
  eyebrow,
  dDay,
  eventLabel,
  heroEventId,
  desc,
  runway,
  primary,
  secondary,
}: {
  eyebrow: string;
  dDay: number;
  eventLabel: string;
  heroEventId: string;
  desc: React.ReactNode;
  runway: SeasonRunwayStep[];
  primary: HeroCta;
  secondary: HeroCta | null;
}) {
  return (
    <header>
      <p className="truncate text-[13px] font-bold tracking-[0.02em] text-coral-strong">{eyebrow}</p>

      {/* 큰 숫자 + 이벤트명은 한 문장이다 — "13일 뒤 9월 메가와리"로 읽히도록 한 h1 안에 둔다 */}
      <h1 className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-ink [text-wrap:pretty]">
        {dDay === 0 ? (
          <>
            <span className="text-[68px] leading-[0.95] font-extrabold tracking-[-0.04em] max-sm:text-[48px]">
              오늘
            </span>
            <span className="text-[26px] leading-snug font-extrabold tracking-[-0.02em] max-sm:text-[20px]">
              {eventLabel} 시작
            </span>
          </>
        ) : (
          <>
            <span className="tnum text-[100px] leading-[0.9] font-extrabold tracking-[-0.045em] max-sm:text-[64px]">
              {dDay}
            </span>
            <span className="text-[26px] leading-snug font-extrabold tracking-[-0.02em] max-sm:text-[20px]">
              일 뒤 {eventLabel}
            </span>
          </>
        )}
      </h1>

      <p className="mt-4 max-w-[680px] text-[15px] leading-[1.7] text-ink-body [text-wrap:pretty]">{desc}</p>

      <SeasonRunwayBar steps={runway} heroEventId={heroEventId} />

      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Link
          href={primary.href}
          className="inline-flex h-12 items-center rounded-xl bg-coral px-[26px] text-[15px] font-bold text-white no-underline transition-colors hover:bg-coral-hover active:bg-coral-pressed"
        >
          {primary.label}
        </Link>
        {secondary && (
          <Link
            href={secondary.href}
            className="inline-flex h-12 items-center rounded-xl border border-border-strong bg-canvas px-5 text-sm font-semibold text-ink no-underline transition-colors hover:bg-n-150"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </header>
  );
}
