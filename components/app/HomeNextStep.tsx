import Link from 'next/link';
import { HERO_VISUAL } from '@/app/landing/content';
import { cardClass } from '@/components/ui/primitives';
import { IconCheck } from '@/components/ui/icons';
import type { PipelineState, PipelineStepId } from '@/lib/home/nextStep';

/**
 * 홈 1단 — **다음 단계 카드**(MAIN-03 · MAIN-04 · MAIN-06).
 *
 * 한 장 안에 세 가지를 묶는다: ① 지금 할 일(제목 · 한 줄 설명 · 화면 유일의 채워진 버튼)
 * ② 그 일이 만들어 내는 것의 예시 그림 ③ 준비 흐름 4단계(브랜드→진단→썸네일→상세) 스테퍼.
 * 2026-11-24 1차 개편은 이 셋을 카드 없는 히어로 · 오른쪽 카드 · 별도 밴드로 흩어 놓아 화면이
 * 헐거웠다. "어디까지 왔고 다음이 무엇인가"는 한 덩어리로 읽혀야 해서 한 카드로 모았다.
 * 스테퍼 칸은 그 단계의 목록·만들기 화면으로 가는 링크이자 건수 표기다(구 건수 타일 3개의 자리).
 * 근거: docs/decisions/2026-11-24-홈-다음단계-히어로.md
 */

export interface NextStepCta {
  href: string;
  label: string;
}

/** 스테퍼 한 칸 */
export interface PipelineCell {
  id: PipelineStepId;
  state: PipelineState;
  /** 단계 이름 — "진단 리포트" */
  label: string;
  /** 상태 한 줄 — 완료면 "1건 · 2026.11.23", 다음 단계면 "지금 할 차례", 이후면 "아직 없음" */
  status: string;
  href: string;
  /** 지금 만드는 중 — 점을 깜빡인다 */
  running: boolean;
}

/** 다음 단계가 속한 축 — 예시 그림을 고른다 */
export type NextStepAxis = 'report' | 'thumbnail' | 'detail';

/** 스크린리더용 상태 문구 — 표식이 aria-hidden 이라 글자로 한 번 더 전한다 */
const STATE_TEXT: Record<PipelineState, string> = {
  done: '완료',
  current: '다음 단계',
  todo: '이후 단계',
};

/** 단계 표식 — 완료 ✓(초록) · 다음(코랄 테 + 번호) · 이후(중립 + 번호). 색+기호/숫자 2중 표기 */
function StepMarker({ state, index }: { state: PipelineState; index: number }) {
  if (state === 'done') {
    return (
      <span
        aria-hidden
        className="mt-px inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-green-bg text-green-text"
      >
        <IconCheck size={12} strokeWidth={2.75} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`tnum mt-px inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-extrabold ${
        state === 'current' ? 'border-[1.5px] border-coral bg-canvas text-coral-strong' : 'bg-n-200 text-ink-mute'
      }`}
    >
      {index + 1}
    </span>
  );
}

// ── 예시 그림 — 다음 단계가 만들어 내는 것. 브랜드의 결과물이 아니므로 "예시" 배지를 붙인다 ──

/** 그림 자리 — 코랄 틴트 면 위에 결과물 예시를 올린다 */
function VisualFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="relative flex h-full min-h-[204px] items-center justify-center overflow-hidden rounded-panel bg-coral-tint"
    >
      <span className="absolute top-3 left-3 inline-flex h-5 items-center rounded-full bg-canvas px-2 text-[11px] font-bold text-ink-mute">
        예시
      </span>
      {children}
    </div>
  );
}

/** 썸네일 예시 — 스튜디오 메뉴가 쓰는 정적 컷 3장을 겹쳐 놓는다(새 자산을 만들지 않는다) */
function ThumbnailVisual() {
  const frame =
    'absolute h-[108px] w-[108px] rounded-[10px] border-2 border-canvas object-cover shadow-[0_8px_18px_rgba(24,35,51,0.16)]';
  return (
    <VisualFrame>
      <div className="relative mt-3 h-[136px] w-[204px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 public 자산, 고정 크기 */}
        <img src="/studio-templates/04-copy-ingredient.jpg" alt="" className={`${frame} top-4 left-0 -rotate-6`} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/studio-templates/08-premium.jpg" alt="" className={`${frame} top-5 left-24 rotate-[5deg]`} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/studio-templates/07-promo.jpg" alt="" className={`${frame} top-1 left-12 z-10`} />
      </div>
    </VisualFrame>
  );
}

/** 상세페이지 예시 — 템플릿 미리보기 3장을 나란히 세운다 */
function DetailVisual() {
  const frame =
    'h-[152px] w-[60px] rounded-[8px] border-2 border-canvas object-cover object-top shadow-[0_8px_18px_rgba(24,35,51,0.14)]';
  return (
    <VisualFrame>
      <div className="mt-3 flex items-end gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 public 자산, 고정 크기 */}
        <img src="/detail-templates/preview-D1-card.webp" alt="" className={frame} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/detail-templates/preview-D2-card.webp" alt="" className={`${frame} -translate-y-2.5`} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/detail-templates/preview-D6-card.webp" alt="" className={frame} />
      </div>
    </VisualFrame>
  );
}

/**
 * 진단 예시 — 원문의 위험 표현이 일본어 문구로 재설계되는 한 쌍.
 * 문구는 랜딩 히어로 목업(`HERO_VISUAL.diagnose`)과 한 벌이다 — 같은 예시를 두 곳에 따로 적지 않는다.
 */
function ReportVisual() {
  const c = HERO_VISUAL.diagnose;
  return (
    <VisualFrame>
      <div className="mt-4 w-[192px] rounded-[10px] bg-canvas p-3.5 shadow-[0_8px_18px_rgba(24,35,51,0.10)]">
        <p className="text-[11px] font-bold text-danger-text">원문</p>
        <p className="mt-0.5 text-[13.5px] leading-snug font-bold text-ink">
          {c.source.head}
          <span className="text-danger-text">{c.source.risk}</span>
          {c.source.tail}
        </p>
        <p className="my-2 text-center text-[12px] leading-none text-ink-ghost">↓</p>
        <p className="text-[11px] font-bold text-coral-strong">재설계</p>
        <p lang="ja" className="mt-0.5 text-[12.5px] leading-[1.6] font-semibold text-ink">
          {c.alt.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </div>
    </VisualFrame>
  );
}

const VISUALS: Record<NextStepAxis, () => React.ReactNode> = {
  report: ReportVisual,
  thumbnail: ThumbnailVisual,
  detail: DetailVisual,
};

/**
 * 다음 단계 카드 본체.
 * @param kicker 제목 위 칩 — "다음 단계 · 3/4"
 * @param title 다음 단계를 말하는 동사 문장(h2). 강조어 1개는 호출부가 감싸 넘긴다
 * @param primary 화면에서 하나뿐인 채워진 버튼
 * @param axis 다음 단계의 축 — 예시 그림을 고른다
 * @param steps 준비 흐름 4단계(표기 순서 = 진행 순서)
 */
export function HomeNextStep({
  kicker,
  title,
  desc,
  primary,
  secondary,
  axis,
  steps,
}: {
  kicker: string;
  title: React.ReactNode;
  desc: string;
  primary: NextStepCta;
  secondary: NextStepCta | null;
  axis: NextStepAxis;
  steps: PipelineCell[];
}) {
  const Visual = VISUALS[axis];
  return (
    <section aria-labelledby="next-t" className={cardClass('flex h-full flex-col overflow-hidden')}>
      <div className="grid flex-1 gap-x-8 gap-y-6 p-7 sm:grid-cols-[minmax(0,1fr)_212px] max-sm:p-5">
        <div className="flex min-w-0 flex-col">
          <p className="inline-flex h-6 w-fit items-center rounded-full bg-coral-tint px-2.5 text-[12px] font-bold text-coral-strong">
            {kicker}
          </p>
          <h2
            id="next-t"
            className="mt-3.5 text-[24px] leading-[1.36] font-extrabold tracking-[-0.02em] text-ink max-sm:text-[21px]"
          >
            {title}
          </h2>
          <p className="mt-2.5 text-[14px] leading-[1.7] text-ink-body [text-wrap:pretty]">{desc}</p>

          <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-6">
            <Link
              href={primary.href}
              className="inline-flex h-12 items-center rounded-btn bg-coral px-6 text-[15px] font-bold text-white no-underline transition-colors hover:bg-coral-hover active:bg-coral-pressed"
            >
              {primary.label}
            </Link>
            {secondary && (
              <Link
                href={secondary.href}
                className="inline-flex h-12 items-center rounded-btn border border-border-strong bg-canvas px-5 text-[14px] font-semibold text-ink no-underline transition-colors hover:bg-n-150 active:bg-n-200"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </div>

        <div className="max-sm:hidden">
          <Visual />
        </div>
      </div>

      {/* 준비 흐름 스테퍼 — 칸이 곧 링크다. 버튼은 위의 하나뿐이라 여기엔 두지 않는다 */}
      <ol
        aria-label="일본 진출 준비 흐름"
        className="grid list-none grid-cols-4 gap-px border-t border-n-200 bg-n-200 p-0 max-md:grid-cols-2"
      >
        {steps.map((cell, i) => (
          <li key={cell.id} className="flex bg-n-50">
            <Link
              href={cell.href}
              aria-current={cell.state === 'current' ? 'step' : undefined}
              className="group flex w-full items-start gap-2.5 px-5 py-4 no-underline transition-colors hover:bg-canvas max-sm:px-4"
            >
              <StepMarker state={cell.state} index={i} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-ink">
                  {cell.label}
                  <span className="sr-only"> · {STATE_TEXT[cell.state]}</span>
                </span>
                <span
                  className={`mt-0.5 flex items-center gap-1.5 text-[12px] ${
                    cell.state === 'current' ? 'font-bold text-coral-strong' : 'text-ink-mute'
                  }`}
                >
                  {cell.running && (
                    <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-coral animate-soft-pulse" />
                  )}
                  <span className="tnum truncate">{cell.status}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
