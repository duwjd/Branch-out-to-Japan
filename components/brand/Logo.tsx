import type { SVGProps } from 'react';

/**
 * YOAKE 로고 — 정본 자산은 design/brand/logo/*.svg, 사용 규칙은 design/brand/logo/README.md.
 * 레터마크는 글리프를 패스로 아웃라인한 것이라 폰트 설치에 의존하지 않는다.
 * 2026-08-18 전환 이후 로고 색 = UI 토큰이다 — INK #182333 = --color-ink,
 * SUN_FROM #FF6F61 = --color-coral. **일출 그라디언트만** 로고 심볼 전용이라 UI 면에는 쓰지 않는다.
 * 값을 리터럴로 두는 이유: 이 SVG는 메일·OG 이미지로도 나가 CSS 변수를 못 받는다.
 */

/** 레터마크 잉크 (= --color-ink) */
const INK = '#182333';
/** 일출 그라디언트 — 왼쪽(코랄) → 오른쪽(살구) */
const SUN_FROM = '#FF6F61';
const SUN_TO = '#FF9B70';

/**
 * 일출 심볼의 좌표. 마크(40×40)와 가로형(103×26)은 같은 도형을 비율만 달리 쓴다 —
 * 원 지름 대비 노출 높이 69%, 수평선 3줄의 간격·수축률이 두 자산에서 동일하다.
 */
const MARK_SUN = { cx: 20, cy: 20, r: 13, top: 7, height: 18, left: 7, width: 26 };
const LOGO_SUN = { cx: 10, cy: 13, r: 10, top: 3, height: 13.8462, left: 0, width: 20 };

/** 수평선 3줄 — [x, y, 너비, 높이] */
const MARK_LINES: [number, number, number, number][] = [
  [7, 26.2, 26, 1.1752],
  [9.08, 28.5752, 21.84, 1.196],
  [11.16, 30.9712, 17.68, 1.196],
];
const LOGO_LINES: [number, number, number, number][] = [
  [0, 17.7692, 20, 0.904],
  [1.6, 19.5963, 16.8, 0.92],
  [3.2, 21.4394, 13.6, 0.92],
];

/** 레터마크 Y·O·A·K·E 글리프 아웃라인 (가로형 103×26 좌표계) */
const GLYPHS: { d: string; evenOdd?: boolean }[] = [
  {
    d: 'M36.2764 11.8159L39.1944 6.9917H42.1993L37.5811 14.2183V19.0073H34.9385V14.27H34.9366L30.3194 6.9917H33.4092L36.2764 11.8159Z',
  },
  {
    d: 'M51.2989 6.78564C55.0073 6.78586 57.668 9.55056 57.668 12.9663V13.0005C57.6678 16.4161 54.973 19.2142 51.2647 19.2144C47.5562 19.2144 44.8958 16.4503 44.8955 13.0347L44.8946 13.0005C44.8946 9.5846 47.5902 6.78564 51.2989 6.78564ZM51.2647 9.22314C49.1364 9.22314 47.6592 10.9062 47.6592 12.9663V13.0005C47.6594 15.0604 49.1707 16.7769 51.2989 16.7769C53.4268 16.7766 54.9031 15.0944 54.9034 13.0347V13.0005C54.9034 10.9405 53.3928 9.22334 51.2647 9.22314Z',
    evenOdd: true,
  },
  {
    d: 'M73.5635 19.0083H70.8008L69.7022 16.314H64.6211L63.5235 19.0083H60.8282L65.9756 6.90576H68.4131L73.5635 19.0083ZM65.5635 13.978H68.7569L67.1602 10.0815L65.5635 13.978Z',
    evenOdd: true,
  },
  {
    d: 'M80.6709 12.2437L85.5118 6.9917H88.7559L83.8457 12.0903L88.962 19.0083H85.7862L82.0606 13.8921L80.67 15.3345V19.0073H78.0264V6.9917H80.6709V12.2437Z',
  },
  {
    d: 'M102.233 9.34326H95.7959V11.7808H101.461V14.1323H95.7959V16.6558H102.319V19.0073H93.169V6.9917H102.233V9.34326Z',
  },
];

type Sun = typeof MARK_SUN;
type Line = [number, number, number, number];

/**
 * 일출 심볼(수평선 3줄 + 마스크로 잘라낸 반원 해).
 * 한 페이지에 로고가 여럿일 때 SVG id가 충돌하지 않도록 uid를 접두사로 쓴다.
 */
function Sunrise({ uid, sun, lines }: { uid: string; sun: Sun; lines: Line[] }) {
  return (
    <>
      <defs>
        <linearGradient
          id={`${uid}-grad`}
          x1={sun.left}
          y1={sun.top + sun.height / 2}
          x2={sun.left + sun.width}
          y2={sun.top + sun.height / 2}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={SUN_FROM} />
          <stop offset="1" stopColor={SUN_TO} />
        </linearGradient>
        <clipPath id={`${uid}-sun`}>
          <circle cx={sun.cx} cy={sun.cy} r={sun.r} />
        </clipPath>
      </defs>
      {lines.map(([x, y, width, height]) => (
        <rect key={y} x={x} y={y} width={width} height={height} rx={height / 2} fill={SUN_FROM} />
      ))}
      <g clipPath={`url(#${uid}-sun)`}>
        <rect
          x={sun.left}
          y={sun.top}
          width={sun.width}
          height={sun.height}
          fill={`url(#${uid}-grad)`}
        />
      </g>
    </>
  );
}

type MarkProps = SVGProps<SVGSVGElement> & {
  /** 한 페이지에 로고가 여럿일 때 SVG id 충돌을 막는 접두사 */
  uid?: string;
};

/** 일출 심볼 단독. 파비콘·앱 아이콘·정사각 아바타처럼 가로형이 안 들어가는 자리에만 쓴다. */
export function YoakeMark({ uid = 'yoake-mark', ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" role="img" aria-label="YOAKE" {...props}>
      <Sunrise uid={uid} sun={MARK_SUN} lines={MARK_LINES} />
    </svg>
  );
}

type LogoProps = MarkProps & {
  /** 어두운 배경에서는 레터마크를 흰색으로 반전한다. 해는 항상 코랄. */
  tone?: 'default' | 'onDark';
};

/**
 * YOAKE 기본 가로형 로고(일출 심볼 + YOAKE 레터마크).
 * 헤더·푸터·문서 표지의 기본 선택지. 높이만 지정하면 폭은 뷰박스 비율을 따른다 — 장평을 임의로 늘리지 않는다.
 */
export function YoakeLogo({ uid = 'yoake-logo', tone = 'default', ...props }: LogoProps) {
  const ink = tone === 'onDark' ? '#FFFFFF' : INK;
  return (
    <svg viewBox="0 0 103 26" fill="none" role="img" aria-label="YOAKE" {...props}>
      <Sunrise uid={uid} sun={LOGO_SUN} lines={LOGO_LINES} />
      {GLYPHS.map(({ d, evenOdd }) => (
        <path key={d.slice(0, 12)} d={d} fill={ink} fillRule={evenOdd ? 'evenodd' : undefined} />
      ))}
    </svg>
  );
}
