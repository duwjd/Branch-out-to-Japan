/**
 * ② 마케팅 스튜디오 전용 프리미티브 — Figma 마케팅 스튜디오 프레임(2026-08-18) 실측 스펙.
 *
 * 앱 공용 프리미티브(components/ui/primitives)와 따로 두는 이유: 스튜디오 화면은 몽타주 계열
 * 컴포넌트(세그먼티드 컨트롤·칩 rounded-10·텍스트필드 rounded-12)를 쓰고 카드 규격도 다르다.
 * 공용 SectionCard(단계 번호 + 필수/선택 pill)를 억지로 늘리면 두 시스템이 서로를 끌어당긴다.
 */

/** 페이지 머리 — H1 30px ExtraBold + 한 줄 설명 */
export function StudioPageHeading({
  title,
  desc,
  descTone = 'ink',
  trailing,
}: {
  title: string;
  desc: string;
  /** ink=검정 SemiBold 16(입력 화면) · mute=회색 Regular 14(결과 화면) */
  descTone?: 'ink' | 'mute';
  /** 우측 상단 배지 자리(로컬 저장·목 모드 고지) */
  trailing?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h1 className="pt-2.5 text-[30px] leading-[39px] font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
        <p
          className={`mt-1 ${
            descTone === 'ink' ? 'text-[16px] leading-[1.5] font-semibold text-black' : 'text-[14px] leading-[1.6] text-ink-mute'
          } [text-wrap:pretty]`}
        >
          {desc}
        </p>
      </div>
      {trailing && <div className="flex flex-none gap-1.5 pt-3">{trailing}</div>}
    </header>
  );
}

/** 섹션 카드 — 흰 카드 + 얇은 테두리 + 아주 옅은 그림자. 제목 20px, 설명 14px */
export function StudioSection({
  title,
  badge,
  desc,
  gap = 24,
  children,
  className = '',
}: {
  title: string;
  /** 제목 옆 회색 배지("선택" 등) */
  badge?: string;
  desc?: string;
  /** 제목 블록과 본문 사이 간격 — Figma는 섹션마다 24 또는 20 */
  gap?: 20 | 24;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-[12px] border border-card-border bg-canvas p-[33px] drop-shadow-[0px_1px_1.5px_rgba(16,18,20,0.04)] max-sm:p-5 ${
        gap === 20 ? 'gap-5' : 'gap-6'
      } ${className}`}
    >
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-[20px] leading-[1.4] font-bold text-ink">{title}</h2>
          {badge && <ContentBadge>{badge}</ContentBadge>}
        </div>
        {desc && <p className="pt-1 text-[14px] leading-[1.6] text-ink-mute [text-wrap:pretty]">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

/** 콘텐츠 배지 — 낮은 위계의 분류 표시. tone=violet은 결과 화면 템플릿명 */
export function ContentBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'violet' }) {
  if (tone === 'violet') {
    return (
      <span className="relative inline-flex items-center justify-center rounded-[8px] px-2 py-[5px] text-[13px] leading-[1.385] font-medium text-violet">
        <span aria-hidden className="absolute inset-0 rounded-[8px] bg-violet opacity-[0.08]" />
        <span className="relative">{children}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-[6px] bg-fill-normal px-1.5 py-[3px] text-[11px] leading-[1.273] font-medium text-ink-mute">
      {children}
    </span>
  );
}

/** 세그먼티드 컨트롤 — 선택된 칸만 흰 배경으로 떠오른다 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex h-12 items-center rounded-[12px] bg-fill-normal p-[3px]">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.value)}
            className={`relative flex h-full flex-1 cursor-pointer items-center justify-center rounded-[10px] p-[9px] text-[16px] leading-[1.5] font-semibold transition-colors ${
              on ? 'bg-canvas text-coral-strong shadow-[0px_0px_4px_0px_rgba(0,0,0,0.08)]' : 'text-ink-mute hover:text-ink-body'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** 필터 칩 — 선택 시 코랄 솔리드 */
export function studioChipClass(on: boolean): string {
  return [
    'inline-flex cursor-pointer items-center rounded-[10px] px-3 py-[9px] text-[15px] leading-[1.467] font-medium tracking-[0.01em] transition-colors',
    on ? 'bg-coral text-white' : 'border border-line-neutral text-ink-mute hover:text-ink-body',
  ].join(' ');
}

/** 텍스트 필드 라벨 */
export const studioLabelClass = 'block text-[14px] leading-[1.429] font-semibold tracking-[0.014em] text-label-neutral';

/** 텍스트 필드 입력 — 라운드 12, 얇은 테두리 + 1px 그림자 */
export const studioInputClass =
  'mt-2 w-full rounded-[12px] border border-line-neutral bg-canvas p-3 text-[16px] leading-[1.5] text-ink shadow-[0px_1px_2px_-1px_rgba(23,23,23,0.1)] placeholder:text-label-assistive focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral';

/** 스튜디오 버튼 — Figma Button/Button(코랄 솔리드) · 보조는 코랄 아웃라인 */
export function studioButtonClass(variant: 'primary' | 'outline' = 'primary', extra = ''): string {
  const cls =
    variant === 'primary'
      ? 'bg-coral text-white hover:bg-coral-hover'
      : 'border border-coral bg-canvas text-coral-strong hover:bg-coral-tint';
  return [
    'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[12px] px-7 py-3 text-[16px] leading-[1.5] font-semibold transition-colors',
    'disabled:cursor-default disabled:opacity-40',
    cls,
    extra,
  ].join(' ');
}

/**
 * 하단 액션 바(HOME-06b · DETAIL-08a) — 폼이 길어 CTA가 화면 밖으로 밀리므로 바닥에 고정한다.
 *
 * `fixed` 대신 `sticky`인 이유(2026-08-18 수정):
 * 1) 본문 `<main>`이 `animate-fade-up`을 쓰는데, 애니메이션이 끝나도 계산된 transform 이
 *    `none`이 아니라 항등 행렬로 남는다. transform 이 있는 조상은 fixed 의 컨테이닝 블록이 되어
 *    바가 뷰포트가 아니라 문서 맨 끝에 붙어 버렸다(썸네일 화면에서 실제로 그랬다).
 * 2) `left: 248px` 하드코딩은 사이드바 접기(64px)를 따라가지 못해 바가 오른쪽으로 밀렸다.
 *    sticky 는 본문 칼럼 안에 있으므로 접힘 여부와 무관하게 항상 칼럼 폭에 맞는다.
 * 안쪽 컨테이너는 본문과 **같은 규격**(max-w-1280 + px-8)이라 버튼 좌우가 카드와 정확히 맞는다.
 */
export function StudioActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-40 border-t border-hairline bg-page/92 py-4 backdrop-blur-[6px]">
      <div className="mx-auto max-w-[1280px] px-8 max-sm:px-5">{children}</div>
    </div>
  );
}
