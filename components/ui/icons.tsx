/**
 * 공용 스트로크 아이콘 — 디자인 정본(docs/specs) 인라인 SVG 추출.
 * 전부 stroke 1.75 · round cap/join, 색은 currentColor(부모 텍스트색 상속).
 */

interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** 픽셀 크기(정방형). 기본 18 */
  size?: number;
}

/** 공통 래퍼 — viewBox 24 스트로크 아이콘 */
function baseProps(size: number | undefined, rest: React.SVGProps<SVGSVGElement>) {
  return {
    'aria-hidden': true as const,
    width: size ?? 18,
    height: size ?? 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };
}

/** 대시보드(집) */
export function IconHome({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

/** 진단 리포트(문서) */
export function IconDoc({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

/** 마케팅 스튜디오(이미지) */
export function IconImage({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

/** 운영(박스) */
export function IconBox({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
    </svg>
  );
}

/** 문서 다운로드(품의용 PDF) */
export function IconDocDown({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 12v6" />
      <path d="M9 15l3 3 3-3" />
    </svg>
  );
}

/** 다운로드(트레이) */
export function IconDownload({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

/** 셰브론 ↓ */
export function IconChevronDown({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size ?? 12, rest)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** 셰브론 ↑ */
export function IconChevronUp({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size ?? 12, rest)}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

/** 업로드(구름 화살표 없이 — 드롭존 픽토그램) */
export function IconUpload({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

/** 결제 수단(카드) */
export function IconCard({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

/** 이메일(봉투) — 로그인 "이메일로 계속하기" 등 */
export function IconMail({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

/** 스피너 — animate-spin과 함께 사용 */
export function IconSpinner({ size, ...rest }: IconProps) {
  return (
    <svg {...baseProps(size ?? 14, rest)}>
      <path d="M21 12a9 9 0 1 1-9-9" />
    </svg>
  );
}
