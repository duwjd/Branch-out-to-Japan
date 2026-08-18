/**
 * LP(비회원 메인) 컴포넌트 — 정본: design/references/LP_Components.svg
 * 실측 스펙: design/lp-components-spec.md · 토큰: app/globals.css @theme
 *
 * 원칙 — 면(버튼·도트·보더·아이콘)은 시트 원색(coral), 글자는 AA 파생색(coral-text).
 * 포커스는 전 컴포넌트 공통으로 코랄 3px 링(outline)이다.
 */
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

/** 공통 포커스 링 — 시트의 3px 아웃셋 코랄 */
const FOCUS_RING = 'focus-visible:outline-3 focus-visible:outline-coral focus-visible:outline-offset-1';

/* ────────────────────────────── TextLink ────────────────────────────── */

/**
 * 본문 링크 — 1px 언더라인. hover/pressed에서 언더라인도 코랄로 물든다.
 * 글자는 coral-text(AA), 언더라인만 시트 원색 coral.
 */
export function TextLink({
  href,
  children,
  disabled = false,
  className = '',
}: {
  href: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`inline-block cursor-default border-b border-card-border pb-0.5 text-sm text-ink-faint ${className}`}
      >
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      className={`inline-block rounded-[5px] border-b border-card-border pb-0.5 text-sm font-bold text-ink transition-colors hover:border-coral hover:text-coral-text active:text-coral-pressed ${FOCUS_RING} ${className}`}
    >
      {children}
    </a>
  );
}

/* ─────────────────────────── StatusBadge ──────────────────────────── */

export type LpStatusTone = 'ok' | 'conditional' | 'risk';

const LP_STATUS: Record<LpStatusTone, { wrap: string; dot: string }> = {
  ok: { wrap: 'bg-green-bg text-green-text', dot: 'bg-green' },
  conditional: { wrap: 'bg-amber-bg text-amber-text', dot: 'bg-amber' },
  risk: { wrap: 'bg-danger-bg text-danger-text', dot: 'bg-danger' },
};

/**
 * 판정 배지 — 검토 가능 / 조건부 / 고위험.
 * 색만으로 구분하지 않도록 라벨 문자열을 반드시 함께 넘긴다(CVD).
 */
export function LpStatusBadge({ tone, children, className = '' }: { tone: LpStatusTone; children: ReactNode; className?: string }) {
  const t = LP_STATUS[tone];
  return (
    <span className={`inline-flex h-[35px] items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold ${t.wrap} ${className}`}>
      <span aria-hidden className={`size-[7px] shrink-0 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

/* ─────────────────────────── ChannelChip ──────────────────────────── */

/** 채널 선택 칩 — 선택 시 코랄 면 + 흰 글자 */
export function ChannelChip({
  selected = false,
  disabled = false,
  onClick,
  children,
  className = '',
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const tone = disabled
    ? 'border-card-border bg-n-150 text-ink-faint cursor-default'
    : selected
      ? 'border-coral bg-coral text-white'
      : 'border-card-border bg-canvas text-ink-body hover:bg-n-150';
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-bold transition-colors ${tone} ${FOCUS_RING} ${className}`}
    >
      {children}
    </button>
  );
}

/* ──────────────────────────── FormField ───────────────────────────── */

const FIELD_BASE =
  'h-[52px] w-full rounded-field border bg-canvas px-3.5 text-[15px] text-ink placeholder:text-ink-faint transition-colors';
const FIELD_FOCUS =
  'focus:border-coral focus:shadow-[0_0_0_3px_var(--color-coral-glow)] focus:outline-none';

/** 라벨 + 인풋 + 에러 메시지 묶음. error가 있으면 aria-invalid·aria-describedby를 자동 연결한다. */
export function FormField({
  id,
  label,
  error,
  className = '',
  ...input
}: { id: string; label: string; error?: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className={`mb-2 block text-sm font-bold ${input.disabled ? 'text-ink-faint' : 'text-ink'}`}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`${FIELD_BASE} ${FIELD_FOCUS} ${
          error ? 'border-danger' : 'border-card-border'
        } disabled:bg-n-150 disabled:text-ink-faint`}
        {...input}
      />
      {error && (
        <p id={errorId} className="mt-2 text-[13px] text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

/** 라벨 + 셀렉트 + 에러 메시지 묶음 */
export function SelectField({
  id,
  label,
  error,
  children,
  className = '',
  ...select
}: { id: string; label: string; error?: string; children: ReactNode; className?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className={`mb-2 block text-sm font-bold ${select.disabled ? 'text-ink-faint' : 'text-ink'}`}>
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`${FIELD_BASE} ${FIELD_FOCUS} appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath fill='%236E7686' d='M0 0h10L5 6z'/%3E%3C/svg%3E")] bg-[length:10px_6px] bg-[right_1rem_center] bg-no-repeat pr-10 ${
          error ? 'border-danger' : 'border-card-border'
        } disabled:bg-n-150 disabled:text-ink-faint`}
        {...select}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="mt-2 text-[13px] text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────── Checkbox ───────────────────────────── */

/** 동의 체크박스 — 20×20, 체크 시 코랄 면 + 흰 체크 */
export function LpCheckbox({
  id,
  label,
  error = false,
  className = '',
  ...input
}: { id: string; label: ReactNode; error?: boolean; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <input
        id={id}
        type="checkbox"
        aria-invalid={error || undefined}
        className={`size-5 shrink-0 cursor-pointer appearance-none rounded-check border-[1.5px] bg-canvas transition-colors checked:border-coral checked:bg-coral disabled:cursor-default disabled:border-border-strong disabled:bg-n-150 ${
          error ? 'border-danger' : 'border-border-strong'
        } checked:bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 10l4 4 8-9'/%3E%3C/svg%3E")] checked:bg-center checked:bg-no-repeat ${FOCUS_RING}`}
        {...input}
      />
      <label htmlFor={id} className={`cursor-pointer text-sm ${input.disabled ? 'text-ink-faint' : 'text-ink-body'}`}>
        {label}
      </label>
    </div>
  );
}

/* ──────────────────────── ServiceCard / WorkflowStep ──────────────── */

/** 서비스 카드 — coming이면 점선 + 회색 톤으로 "예정" 표시 */
export function ServiceCard({
  eyebrow,
  title,
  body,
  footnote,
  coming = false,
  className = '',
}: {
  eyebrow: string;
  title: string;
  body: string;
  footnote?: string;
  coming?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`rounded-card border p-7 ${
        coming ? 'border-dashed border-card-border bg-n-100' : 'border-card-border bg-canvas'
      } ${className}`}
    >
      <p className={`text-[13px] font-bold tracking-[0.08em] ${coming ? 'text-ink-faint' : 'text-coral-text'}`}>{eyebrow}</p>
      <h3 className={`mt-3 text-xl font-bold ${coming ? 'text-ink-mute' : 'text-ink'}`}>{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink-body">{body}</p>
      {footnote && <p className="mt-4 text-[13px] text-ink-faint">{footnote}</p>}
    </article>
  );
}

/** 워크플로 스텝 카드 — 스텝 번호가 코랄(coming은 회색) */
export function WorkflowStep({
  step,
  title,
  body,
  coming = false,
  className = '',
}: {
  step: string;
  title: string;
  body: string;
  coming?: boolean;
  className?: string;
}) {
  return (
    <article
      className={`rounded-card border p-7 ${
        coming ? 'border-dashed border-card-border bg-n-100' : 'border-card-border bg-canvas'
      } ${className}`}
    >
      <p className={`text-2xl font-bold tnum ${coming ? 'text-ink-faint' : 'text-coral-text'}`}>{step}</p>
      <h3 className="mt-3 text-[15px] font-bold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink-body">{body}</p>
    </article>
  );
}

/* ──────────────────────────── FAQAccordion ────────────────────────── */

/**
 * FAQ 항목 — <details>/<summary> 기반이라 JS 없이 동작하고 키보드 접근도 기본 지원된다.
 * 펼침 시 보더가 코랄로 바뀌고 +가 −로 바뀐다.
 */
export function FAQItem({ question, children, className = '' }: { question: string; children: ReactNode; className?: string }) {
  return (
    <details
      className={`group rounded-panel border border-card-border bg-canvas transition-colors open:border-coral ${className}`}
    >
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-6 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}
      >
        {question}
        <span aria-hidden className="relative size-[18px] shrink-0 text-coral">
          <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 rounded-full bg-current" />
          <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rounded-full bg-current transition-transform group-open:scale-y-0" />
        </span>
      </summary>
      <div className="px-6 pb-6 text-sm leading-relaxed text-ink-body">{children}</div>
    </details>
  );
}

/* ─────────────────────────── SuccessMessage ───────────────────────── */

/** 제출 완료 안내 — role="status"로 스크린리더에 알린다 */
export function SuccessMessage({ title, body, className = '' }: { title: string; body: string; className?: string }) {
  return (
    <div role="status" className={`flex gap-3 rounded-panel border border-green bg-green-bg p-5 ${className}`}>
      <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0">
        <circle cx="12" cy="12" r="12" className="fill-green" />
        <path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-1 text-[13px] text-ink-body">{body}</p>
      </div>
    </div>
  );
}
