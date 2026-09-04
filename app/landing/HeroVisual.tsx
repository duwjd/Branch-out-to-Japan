/**
 * Hero_Visual (Figma 1:1726) — 입력 → 진단 리포트 → 마케팅 스튜디오 3패널 목업.
 *
 * 왜 이미지가 아니라 마크업인가: Figma의 세 패널은 그림이 아니라 실제 화면을 축소한 UI다.
 * 마크업으로 두면 문구가 content.ts 한곳에서 관리되고, 확대·번역·다크 대응이 깨지지 않는다.
 * 양옆 일러스트(ILL_Hero_Input·ILL_Hero_Output)만 원격 SVG 자산이라
 * `<Illustration>`가 파일이 있을 때만 끼워 넣는다(없으면 자리도 차지하지 않는다).
 *
 * 반응형: lg 미만에서는 화살표를 감추고 세로로 쌓는다(가로 1200px 고정 배치가 목적이 아니라
 * "왼쪽에서 오른쪽으로 이어진다"는 순서가 목적이라, 좁은 화면에서는 위→아래가 같은 뜻이다).
 */

import { HERO_VISUAL } from './content';
import { Illustration } from '@/components/landing/Illustration';
import { Reveal } from '@/components/landing/Reveal';

/** 패널 껍데기 — 흰 카드 + soft 보더 + 12px 라운드(Figma UI_Input/Diagnose/Output 공통) */
function Panel({
  width,
  children,
  className = '',
}: {
  /** 데스크톱 고정 폭(px) — 좁은 화면에서는 무시하고 전체 폭을 쓴다 */
  width: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      style={{ width }}
      className={`flex flex-none flex-col rounded-[12px] border border-lp-line bg-white max-lg:!w-full max-lg:max-w-[340px] ${className}`}
    >
      {children}
    </div>
  );
}

/** 패널 제목 — 7px 코랄 점 + 14px SemiBold */
function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[7px]">
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full bg-lp-coral" />
      <span className="text-[14px] leading-[1.5] font-semibold text-lp-ink">{children}</span>
    </div>
  );
}

/** 상태 배지 — Figma StatusBadge의 conditional(주황) 변형만 목업에 쓰인다 */
function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-lp-conditional-tint py-[7px] pr-3.5 pl-3">
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full bg-lp-conditional" />
      <span className="text-[14px] leading-[1.5] font-semibold whitespace-nowrap text-lp-conditional">{children}</span>
    </span>
  );
}

/** 패널 사이 연결 화살표 — 순서만 전달하는 장식이라 스크린리더에서 뺀다 */
function Connector() {
  return (
    <svg
      aria-hidden
      width="26"
      height="12"
      viewBox="0 0 26 12"
      fill="none"
      className="flex-none text-lp-line-strong max-lg:hidden"
    >
      <path
        d="M0 6h22M18 1.5 23 6l-5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 입력 패널 — 제품 칩·한국어 카피·보유 근거 목록 */
function InputPanel() {
  const c = HERO_VISUAL.input;
  return (
    <Panel width={224} className="gap-2.5 p-4">
      <PanelTitle>{c.label}</PanelTitle>
      <div className="flex flex-wrap gap-1.5">
        {c.chips.map((chip) => (
          <span key={chip} className="rounded-[6px] bg-lp-panel px-2 py-1 text-[13px] leading-[1.5] text-lp-muted">
            {chip}
          </span>
        ))}
      </div>
      <div className="rounded-[8px] bg-lp-panel px-3 py-2.5">
        <p className="text-[13px] leading-[1.5] text-lp-faint">{c.copyLabel}</p>
        <p className="mt-1.5 text-[17px] leading-[1.75] font-semibold tracking-[-0.005em] text-lp-ink">{c.copyValue}</p>
      </div>
      <p className="text-[13px] leading-[1.5] font-medium text-lp-coral">{c.evidenceLabel}</p>
      <ul className="flex list-none flex-col gap-2.5">
        {c.evidence.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[13px] leading-[1.5] text-lp-body">
            <span aria-hidden className="h-3.5 w-3 flex-none rounded-[2px] bg-lp-line" />
            {item}
          </li>
        ))}
      </ul>
      <p className="rounded-[6px] border border-dashed border-lp-line-strong py-2 text-center text-[13px] leading-[1.5] text-lp-faint">
        {c.addLabel}
      </p>
    </Panel>
  );
}

/** 진단 패널 — 위험 표현 하이라이트, 확인 항목 체크리스트, 대체 표현, 변경 이유 */
function DiagnosePanel() {
  const c = HERO_VISUAL.diagnose;
  return (
    <Panel width={300} className="gap-3 px-[18px] py-4 shadow-[0px_6px_20px_0px_rgba(23,36,51,0.07)]">
      <div className="flex items-center justify-between gap-2">
        <PanelTitle>{c.label}</PanelTitle>
        <StatusBadge>{c.status}</StatusBadge>
      </div>

      <div className="rounded-[8px] bg-lp-risk-tint px-3 py-2.5">
        <p className="text-[13px] leading-[1.5] font-medium text-lp-risk">{c.sourceLabel}</p>
        <p className="mt-1.5 text-[17px] leading-[1.75] font-semibold tracking-[-0.005em] text-lp-ink">
          {c.source.head}
          <span className="text-lp-risk">{c.source.risk}</span>
          {c.source.tail}
        </p>
      </div>

      <p className="text-[13px] leading-[1.5] font-medium text-lp-coral">{c.checkLabel}</p>
      <ul className="flex list-none flex-col gap-3">
        {c.checks.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[13px] leading-[1.5] text-lp-body">
            <span
              aria-hidden
              className="h-[11px] w-[11px] flex-none rounded-[3px] border border-lp-line-strong bg-white"
            />
            <span className="[text-wrap:pretty]">{item}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-[8px] bg-lp-panel px-3 py-2.5">
        <p className="text-[13px] leading-[1.5] font-medium text-lp-faint">{c.altLabel}</p>
        <p lang="ja" className="mt-1.5 text-[15px] leading-[1.8] text-lp-ink">
          {c.alt.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </div>

      <p className="text-[13px] leading-[1.5] font-medium text-lp-coral">{c.reasonLabel}</p>
      <p className="text-[13px] leading-[1.5] font-medium text-lp-muted [text-wrap:pretty]">{c.reason}</p>
    </Panel>
  );
}

/** 제작 패널 — 채널 칩, 썸네일 두 장, 상세페이지 상단 카피 */
function OutputPanel() {
  const c = HERO_VISUAL.output;
  return (
    <Panel width={300} className="gap-2.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <PanelTitle>{c.label}</PanelTitle>
        <StatusBadge>{c.status}</StatusBadge>
      </div>

      <ul className="flex list-none flex-wrap gap-2 pt-1.5">
        {c.channels.map((channel, i) => (
          <li
            key={channel}
            className={`rounded-full border px-4 py-[9px] text-[15px] leading-[1.5] font-semibold ${
              i === 0 ? 'border-lp-coral bg-lp-coral text-white' : 'border-lp-line bg-white text-lp-body'
            }`}
          >
            {channel}
          </li>
        ))}
      </ul>

      {/* 썸네일 미리보기 2장 — 첫 장이 선택 상태(코랄 보더). 내용 없는 자리표시라 aria-hidden */}
      <div aria-hidden className="flex gap-2">
        {[true, false].map((selected, i) => (
          <div
            key={i}
            className={`flex flex-1 flex-col gap-[5px] rounded-[6px] border bg-white p-[7px] ${
              selected ? 'border-lp-coral' : 'border-lp-line'
            }`}
          >
            <span className={`h-[34px] rounded-[4px] ${selected ? 'bg-lp-coral' : 'bg-lp-coral-tint'}`} />
            <span className="h-1 rounded-[2px] bg-lp-line" />
            <span className="h-1 w-7 rounded-[2px] bg-lp-line" />
          </div>
        ))}
      </div>

      <div className="rounded-[6px] bg-lp-panel p-2">
        <p className="text-[13px] leading-[1.5] font-medium text-lp-faint">{c.detailLabel}</p>
        <p lang="ja" className="mt-[5px] text-[15px] leading-[1.8] text-lp-ink">
          {c.detail.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </div>

      <p className="text-[13px] leading-[1.5] font-medium text-lp-muted [text-wrap:pretty]">{c.note}</p>
    </Panel>
  );
}

export function HeroVisual() {
  return (
    <div className="mt-12 w-full max-lg:mt-10">
      {/* 목업은 이미지가 아니라 마크업이라 각 패널 문구가 그대로 읽힌다.
          다만 순서만으로는 흐름이 전달되지 않아 요약 한 줄을 앞에 둔다. */}
      <p className="sr-only">{HERO_VISUAL.summary}</p>
      <div className="flex items-center justify-center gap-[5px] max-lg:flex-col max-lg:gap-4">
        <Illustration name="hero-input" width={160} height={159} className="flex-none max-lg:hidden" />
        <Reveal delay={0} className="max-lg:w-full max-lg:max-w-[340px]">
          <InputPanel />
        </Reveal>
        <Connector />
        <Reveal delay={90} className="max-lg:w-full max-lg:max-w-[340px]">
          <DiagnosePanel />
        </Reveal>
        <Connector />
        <Reveal delay={180} className="max-lg:w-full max-lg:max-w-[340px]">
          <OutputPanel />
        </Reveal>
        <Illustration name="hero-output" width={133} height={159} className="flex-none max-lg:hidden" />
      </div>
    </div>
  );
}
