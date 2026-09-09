/**
 * 공용 프리미티브 — 배지·칩·버튼·카드·스켈레톤·빈 상태.
 * 서버/클라이언트 겸용(상태 없음). 상태색은 색+글자+기호(○/△/✕) 3중 표기 원칙 —
 * 라벨 문자열에 기호를 포함해 넘긴다.
 */

/** 성숙도·판정 배지 톤 */
export type BadgeTone = 'ok' | 'warn' | 'off' | 'danger';

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  ok: 'bg-green-bg text-green-text',
  warn: 'bg-amber-bg text-amber-text',
  off: 'bg-n-150 text-ink-faint',
  danger: 'bg-danger-bg text-danger-text',
};

/** 성숙도 배지 — "이용 가능 ○" 처럼 기호 포함 라벨을 넘긴다 */
export function StatusBadge({
  tone,
  children,
  className = '',
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-[19px] items-center whitespace-nowrap rounded-full px-[7px] text-[10px] font-bold ${BADGE_TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** 축 구분 칩 — ① 리포트(코랄) / ② 스튜디오(앰버) */
export function AxisChip({ axis, className = '' }: { axis: 'report' | 'studio'; className?: string }) {
  const cls = axis === 'report' ? 'bg-coral-tint text-coral-strong' : 'bg-amber-bg text-amber-text';
  return (
    <span
      className={`inline-flex h-[19px] items-center whitespace-nowrap rounded-full px-[7px] text-[10px] font-bold ${cls} ${className}`}
    >
      {axis === 'report' ? '① 리포트' : '② 스튜디오'}
    </span>
  );
}

/** 선택 칩(포지셔닝·카테고리·플랫폼·채널 공용) 클래스 — on/off */
export function chipClass(on: boolean): string {
  return [
    'inline-flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
    on ? 'border-coral bg-coral-tint text-coral-strong' : 'border-input-border bg-canvas text-ink-body hover:bg-n-100',
  ].join(' ');
}

/** 버튼 변형 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** 시트 Button — Primary는 코랄 면, Secondary는 border-strong(#c9cdd4) + 잉크 글자 */
const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-coral text-white hover:bg-coral-hover active:bg-coral-pressed disabled:hover:bg-coral',
  secondary: 'border border-border-strong bg-canvas text-ink hover:bg-n-150 active:bg-n-200',
  ghost: 'bg-transparent text-ink-body hover:bg-n-150',
  danger: 'bg-danger text-white hover:bg-danger-text',
};

/**
 * 버튼 클래스 헬퍼 — <button>·<Link> 공용.
 * size: sm=34px(헤더 보조) · md=44px(일반) · lg=54px(폼 제출)
 */
export function buttonClass(variant: ButtonVariant, size: 'sm' | 'md' | 'lg' = 'md', extra = ''): string {
  const sizeCls =
    size === 'sm' ? 'h-[34px] px-3.5 text-[13px]' : size === 'lg' ? 'h-[54px] px-6 text-[15px]' : 'h-11 px-5 text-sm';
  return [
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-btn font-bold transition-colors',
    'disabled:cursor-default disabled:opacity-40',
    sizeCls,
    BUTTON_VARIANT_CLASS[variant],
    extra,
  ].join(' ');
}

/** 카드 표면 클래스 — radius 14(시트 ServiceCard) · card-border · card-shadow */
export function cardClass(extra = ''): string {
  return `rounded-card border border-card-border bg-canvas shadow-card ${extra}`;
}

/**
 * 섹션 카드 — 폼 화면의 스텝 번호 + 제목 + 필수/선택 pill 패턴.
 *
 * `collapsible` 을 주면 헤더가 토글 버튼이 된다(DETAIL-01d). 접혀도 **children 은 그대로 마운트**되고
 * `hidden` 으로 가릴 뿐이다 — 언마운트하면 `new FormData(form)` 이 그 칸을 통째로 빠뜨린다.
 * 열림 상태를 부모가 쥐는 이유는 블록 보드가 특정 섹션을 밖에서 열어야 하기 때문이다(DETAIL-01e 1e-7).
 */
export function SectionCard({
  step,
  title,
  pill,
  pillTone = 'required',
  desc,
  summary,
  collapsible = false,
  open = true,
  onToggle,
  id,
  children,
  className = '',
}: {
  /** 진행 순서 번호(스튜디오 폼) — 없으면 미표시 */
  step?: number;
  title: string;
  /** "필수 · 1장" 같은 라벨 */
  pill?: string;
  pillTone?: 'required' | 'optional';
  desc?: React.ReactNode;
  /** 접혔을 때 헤더에 남는 한 줄 — "무엇을 넣으면 무엇이 늘어나는가"(DETAIL-01d 1d-7) */
  summary?: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  /** 밖에서 스크롤·포커스를 걸기 위한 앵커 */
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const bodyId = id ? `${id}-body` : undefined;
  const header = (
    <>
      {step !== undefined && (
        <span
          aria-hidden
          className="inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-coral/35 bg-coral-tint text-[11.5px] font-extrabold text-coral-strong"
        >
          {step}
        </span>
      )}
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      {pill && (
        <span
          className={`inline-flex h-[19px] items-center rounded-full px-[7px] text-[10px] font-bold ${
            pillTone === 'required' ? 'bg-coral-tint text-coral-strong' : 'bg-n-150 text-ink-mute'
          }`}
        >
          {pill}
        </span>
      )}
    </>
  );

  return (
    <section id={id} className={cardClass(`p-6 sm:p-8 ${className}`)}>
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex w-full items-center gap-2.5 text-left"
        >
          {header}
          {summary && <span className="ml-auto text-[12px] text-ink-mute">{summary}</span>}
          <span aria-hidden className={`flex-none text-ink-faint ${summary ? '' : 'ml-auto'}`}>
            {open ? '▾' : '▸'}
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">{header}</div>
      )}
      {desc && (!collapsible || open) && <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">{desc}</p>}
      {/* 접혀도 언마운트하지 않는다 — 폼이 통째로 제출되므로 값이 사라지면 안 된다 */}
      <div id={bodyId} hidden={collapsible && !open} className="mt-5">
        {children}
      </div>
    </section>
  );
}

/** 로딩 스켈레톤 — 치수는 className으로 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skel ${className}`} />;
}

/** 빈 상태 — 인터페이스를 가르치는 안내 + 액션 슬롯 */
export function EmptyState({
  icon,
  title,
  desc,
  action,
  className = '',
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cardClass(`flex flex-col items-center px-6 py-14 text-center ${className}`)}>
      {icon && <div className="mb-4 text-ink-faint">{icon}</div>}
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      {desc && <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-mute">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * 공용 폼 컨트롤 클래스 — 포커스는 코랄 보더 + 글로우(LP_Components 시트 FormField).
 * 전환 전엔 포커스가 회색(#70737c)이었다: 시트가 코랄 링으로 통일해 규칙이 바뀌었다.
 */
const FIELD_FOCUS = 'focus:border-coral focus:shadow-[0_0_0_3px_var(--color-coral-glow)] focus:outline-none';

export const inputClass = `h-10 w-full rounded-field border border-input-border bg-canvas px-3 text-[13.5px] text-ink placeholder:text-ink-faint ${FIELD_FOCUS}`;

export const textareaClass = `w-full resize-y rounded-field border border-input-border bg-canvas px-3 py-2.5 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-faint ${FIELD_FOCUS}`;

export const selectClass = `h-10 rounded-field border border-input-border bg-canvas px-3 text-[13.5px] font-semibold text-ink ${FIELD_FOCUS}`;

export const fieldLabelClass = 'mb-1.5 block text-[12.5px] font-bold text-ink';
