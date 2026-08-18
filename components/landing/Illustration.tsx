import fs from 'node:fs';
import path from 'node:path';

/**
 * 랜딩 이미지 자산 슬롯 — `public/landing/<name>.<ext>`가 있을 때만 렌더한다.
 *
 * 왜 존재 여부를 보나: Figma 자산 호스트가 이 환경의 이그레스 정책에 막혀 원본 자산을 아직
 * 넣지 못했다(public/landing/README.md 참조). 깨진 이미지 아이콘이나 빈 회색 상자를 남기는
 * 대신 자리를 접어 두고, 파일을 넣는 순간 코드 수정 없이 붙게 한다.
 *
 * 존재 확인은 모듈 로드 시 1회(디렉터리 스냅샷)만 한다 — 렌더마다 fs를 두드리지 않는다.
 */

/** 우선순위 순 확장자 — 일러스트는 svg, 화면 캡처는 png/webp/jpg로 들어온다 */
const EXTENSIONS = ['svg', 'png', 'webp', 'jpg', 'jpeg'] as const;

/** public/landing 에 실제로 들어 있는 파일 목록(서버 시작 시 1회 스냅샷) */
const AVAILABLE: ReadonlySet<string> = (() => {
  try {
    return new Set(fs.readdirSync(path.join(process.cwd(), 'public', 'landing')));
  } catch {
    return new Set<string>();
  }
})();

/**
 * 확장자 없는 이름 → 실제 파일명. 없으면 null.
 * @param name public/landing/README.md 표의 이름
 */
function resolveFile(name: string): string | null {
  for (const ext of EXTENSIONS) {
    const file = `${name}.${ext}`;
    if (AVAILABLE.has(file)) return file;
  }
  return null;
}

/** 스팟 일러스트 — Figma에서 지정한 고정 크기로 놓는다 */
export function Illustration({
  name,
  width,
  height,
  className = '',
}: {
  /** 확장자 없는 파일명 — public/landing/README.md 의 표를 따른다 */
  name: string;
  width: number;
  height: number;
  className?: string;
}) {
  const file = resolveFile(name);
  if (!file) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/landing/${file}`}
      alt=""
      aria-hidden
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
    />
  );
}

/**
 * 예시 화면 캡처 — 폭은 컨테이너가 정하고 비율만 고정한다(썸네일 정사각, 상세페이지 가로형).
 * 일러스트와 달리 내용이 있는 이미지라 대체 텍스트를 받는다.
 */
export function LandingShot({
  name,
  alt,
  ratio = 'square',
  className = '',
}: {
  name: string;
  alt: string;
  ratio?: 'square' | 'wide';
  className?: string;
}) {
  const file = resolveFile(name);
  if (!file) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/landing/${file}`}
      alt={alt}
      className={`w-full object-cover ${ratio === 'square' ? 'aspect-square' : 'aspect-[180/116]'} ${className}`}
    />
  );
}
