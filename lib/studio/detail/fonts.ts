/**
 * 상세페이지 렌더용 일본어 폰트 로더 + 글리프 커버리지 검사.
 *
 * 왜 커버리지 검사가 필요한가 — satori(@vercel/og 번들)는 폰트에 없는 글자를 만나면
 * `fonts.googleapis.com` 을 **런타임에 fetch** 한다(캐시 키가 텍스트별이라 세그먼트마다 왕복).
 * 서버리스에서 이 요청이 실패하면 그 자리가 두부(tofu)가 되고, 성공해도 지연·비결정성이 남는다.
 * 그래서 "폰트를 넘겼으니 괜찮다"가 아니라, **생성 전에 커버리지 밖 글자를 걸러내야** 한다.
 *
 * ⚠ satori는 woff2를 거부한다(실측: `Unsupported OpenType signature wOF2`).
 *   그래서 Pretendard(woff2)는 재사용 불가 — 출력물에 한국어가 등장하지 않으므로 문제없다.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface LoadedFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: 'normal';
}

const FONT_DIR = path.join(process.cwd(), 'app/fonts/jp');

/** satori에 넘기는 폰트 패밀리명 — 렌더 트리의 fontFamily와 일치해야 한다. */
export const JP_FONT_FAMILY = 'NotoSansJP';

let cachedFonts: LoadedFont[] | null = null;
let cachedRanges: [number, number][] | null = null;

/**
 * 일본어 폰트 Buffer 로드(프로세스 캐시 — 콜드스타트당 1회, 약 9MB).
 * next.config.ts 의 outputFileTracingIncludes 에 `./app/fonts/jp/**` 가 없으면
 * 배포본에서 파일이 사라진다(fs 동적 경로라 트레이싱이 못 잡는다).
 */
export function jpFonts(): LoadedFont[] {
  if (!cachedFonts) {
    cachedFonts = [
      {
        name: JP_FONT_FAMILY,
        data: readFileSync(path.join(FONT_DIR, 'NotoSansJP-Regular.otf')),
        weight: 400,
        style: 'normal',
      },
      {
        name: JP_FONT_FAMILY,
        data: readFileSync(path.join(FONT_DIR, 'NotoSansJP-Bold.otf')),
        weight: 700,
        style: 'normal',
      },
    ];
  }
  return cachedFonts;
}

/** 빅엔디안 리더 — 폰트 테이블은 전부 BE다. */
const u16 = (b: Buffer, o: number) => b.readUInt16BE(o);
const u32 = (b: Buffer, o: number) => b.readUInt32BE(o);

/** sfnt 테이블 디렉터리에서 태그의 오프셋을 찾는다. */
function findTable(buf: Buffer, tag: string): number | null {
  const numTables = u16(buf, 4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('ascii', rec, rec + 4) === tag) return u32(buf, rec + 8);
  }
  return null;
}

/** cmap format 4(BMP) → 코드포인트 구간 목록. */
function ranges4(buf: Buffer, sub: number): [number, number][] {
  const segCount = u16(buf, sub + 6) / 2;
  const endBase = sub + 14;
  const startBase = endBase + segCount * 2 + 2;
  const out: [number, number][] = [];
  for (let i = 0; i < segCount; i++) {
    const end = u16(buf, endBase + i * 2);
    const start = u16(buf, startBase + i * 2);
    if (start > end || start === 0xffff) continue;
    out.push([start, end]);
  }
  return out;
}

/** cmap format 12(전 평면) → 코드포인트 구간 목록. */
function ranges12(buf: Buffer, sub: number): [number, number][] {
  const nGroups = u32(buf, sub + 12);
  const out: [number, number][] = [];
  for (let i = 0; i < nGroups; i++) {
    const g = sub + 16 + i * 12;
    out.push([u32(buf, g), u32(buf, g + 4)]);
  }
  return out;
}

/** 폰트의 cmap을 파싱해 커버 구간을 얻는다. format 12 우선, 없으면 4. */
function coverageRanges(buf: Buffer): [number, number][] {
  const cmap = findTable(buf, 'cmap');
  if (cmap == null) return [];
  const n = u16(buf, cmap + 2);
  let best4: number | null = null;
  let best12: number | null = null;
  for (let i = 0; i < n; i++) {
    const rec = cmap + 4 + i * 8;
    const sub = cmap + u32(buf, rec + 4);
    const format = u16(buf, sub);
    if (format === 12 && best12 == null) best12 = sub;
    else if (format === 4 && best4 == null) best4 = sub;
  }
  if (best12 != null) return ranges12(buf, best12);
  if (best4 != null) return ranges4(buf, best4);
  return [];
}

/** 로드된 폰트 전체의 합집합 커버 구간(프로세스 캐시). */
function allRanges(): [number, number][] {
  if (!cachedRanges) {
    const merged: [number, number][] = [];
    for (const f of jpFonts()) merged.push(...coverageRanges(f.data));
    merged.sort((a, b) => a[0] - b[0]);
    // 인접·중첩 구간 병합 — 조회 비용을 줄인다
    const out: [number, number][] = [];
    for (const r of merged) {
      const last = out[out.length - 1];
      if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
      else out.push([r[0], r[1]]);
    }
    cachedRanges = out;
  }
  return cachedRanges;
}

function covers(cp: number): boolean {
  const ranges = allRanges();
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = ranges[mid];
    if (cp < s) hi = mid - 1;
    else if (cp > e) lo = mid + 1;
    else return true;
  }
  return false;
}

/**
 * 폰트가 못 그리는 글자를 돌려준다(중복 제거).
 * 비어있지 않으면 렌더 전에 실패시키거나 normalizeForFont()로 정규화해야 한다 —
 * 그대로 두면 satori가 Google Fonts를 fetch한다.
 */
export function uncoveredGlyphs(text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    // 개행·탭은 렌더 대상이 아니다
    if (cp === 0x0a || cp === 0x0d || cp === 0x09) continue;
    if (!covers(cp)) out.add(ch);
  }
  return [...out];
}

/**
 * 커버리지 밖 글자를 안전한 대체 표기로 정규화한다.
 * 일본 상세페이지에서 실제로 자주 나오면서 서브셋 폰트가 놓치기 쉬운 것들만 다룬다.
 * 여기서 못 고치는 글자는 호출부가 uncoveredGlyphs()로 걸러 실패시킨다.
 */
export function normalizeForFont(text: string): string {
  let out = text.replace(/㈱/g, '(株)').replace(/㈲/g, '(有)').replace(/℡/g, 'TEL').replace(/～/g, '〜');
  // 원문자 ①~⑳ → "1." 형태(각주·STEP 번호에서 흔하다)
  out = out.replace(/[①-⑳]/g, (c) => `${c.codePointAt(0)! - 0x245f}.`);
  // 로마숫자 Ⅰ~Ⅹ
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  out = out.replace(/[Ⅰ-Ⅹ]/g, (c) => ROMAN[c.codePointAt(0)! - 0x2160]);
  // 이모지·변이 선택자는 제거(폰트에 없고 상세페이지 관례상 쓰지 않는다)
  out = out.replace(/[\u{1F000}-\u{1FAFF}\u{FE0E}\u{FE0F}\u{2190}-\u{21FF}]/gu, '');
  return out;
}
