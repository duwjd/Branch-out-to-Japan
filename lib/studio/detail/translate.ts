/**
 * 입력 언어 변환(KR→JA) 계약의 **결정적 절반** — LLM이 관여하지 않는 부분 전부.
 *
 * 왜 필요한가 — 사용자 입력 18슬롯은 `assembleBlockSlots()` 가 원문 그대로 슬롯에 넣고
 * satori 가 벡터로 그린다. JP 폰트에 한글 글리프가 없어서, 한국어가 들어오면 글자가 깨지는 게
 * 아니라 `safeText()` 가 던지고 **그 블록이 통째로 사라진다**(hero-product 면 필수 블록이 증발).
 * 그래서 렌더 전에 일본어로 바꿔 넣어야 한다.
 *
 * 이 파일이 LLM을 부르지 않는 이유 — 필드 추출·되쓰기·숫자 검사·区分 매핑·용어집 치환은
 * 전부 결정적으로 할 수 있고, 결정적으로 할 수 있는 것을 모델에 맡기면 검증할 수 없어진다.
 * 모델이 하는 일은 「자연어를 일본어로 바꾸는 것」 하나뿐이다(콜⑧ — translateCall.ts).
 *
 * ⚠ node:fs 를 쓰지 않는 클라이언트 안전 잎 노드다(output.ts 관례). 확인 패널이 그대로 import 한다.
 */

import type { BrandKit, DetailInput } from '../../db/store';
import { digitSignature, hasHangul } from '../../engine/lang';

/**
 * 필드 성격 — 취급이 갈린다.
 * - `free`         자유 텍스트. 일본 관례어로 자연스럽게.
 * - `numeric`      숫자를 동반한다. 숫자 검사 필수.
 * - `regulated`    표시 의무 영역(전성분·区分). 사람이 반드시 확인한다.
 * - `artDirection` 이미지 생성 지시. **일본어가 아니라 영어**로 간다(프롬프트 나머지가 전부 영어).
 */
export type TranslateKind = 'free' | 'numeric' | 'regulated' | 'artDirection';

export interface TranslatableField {
  /** `spec.volume` · `ingredients[0].name` · `cautions[2]` 형태 */
  path: string;
  /** 확인 패널에 보여줄 한국어 라벨 */
  label: string;
  /** 사용자가 입력한 원문 */
  kr: string;
  kind: TranslateKind;
}

/** 변환 1건의 결과 — 실패해도 버리지 않고 사유와 함께 남긴다(사용자가 직접 고칠 수 있게). */
export interface TranslatedField extends TranslatableField {
  ja: string;
  /** false 면 ja 를 채택하지 않는다 — 원문이 그대로 남는다 */
  ok: boolean;
  /** 실패 사유(사용자에게 그대로 노출) */
  problem?: string;
  /** 어떻게 얻었는가 — 감사·비용 추적용 */
  via: 'kubun' | 'glossary' | 'llm';
}

/** 「추가 요청」(note)의 경로 — DetailInput 밖이라 상수로 고정한다. */
export const NOTE_PATH = 'note';

// ── 한글 판정 ────────────────────────────────────────────────────────────────

/**
 * 한글이 섞여 있는가.
 * 완성형(가-힣)만 보면 안 된다 — 자모 단독(ㄱ·ㅏ)은 JP 폰트 cmap 에 **들어 있어서**
 * `uncoveredGlyphs()` 를 통과해 버린다. 렌더는 되지만 일본 상세페이지에 한글 자모가 남는다.
 *
 * 정의는 `lib/engine/lang.ts` 가 소유한다 — ① 리포트의 언어 계약 검사도 같은 판정을 쓰므로
 * 정규식이 두 벌로 갈리면 두 축의 기준이 조용히 어긋난다. 여기서는 재수출만 한다.
 */
export { hasHangul };

// ── 숫자 보존 검사 ───────────────────────────────────────────────────────────

/** 정의는 `lib/engine/lang.ts` 가 소유한다(① 리포트도 같은 판정을 쓴다). 여기서는 재수출만 한다 */
export { digitSignature };

/**
 * 변환 후에도 수치가 그대로인가. 가격·수량·SPF·시험 인원이 조용히 바뀌면 景表法 리스크다.
 * @param kr 원문
 * @param ja 변환문
 */
export function numbersPreserved(kr: string, ja: string): boolean {
  return digitSignature(kr) === digitSignature(ja);
}

// ── 区分 결정적 매핑 ─────────────────────────────────────────────────────────

/**
 * 区分은 LLM에게 맡기지 않는다.
 * `assembleBlockSlots()` 가 `input.spec.category === '医薬部外品'` 문자열 비교로 히어로 블록의
 * 기능 라벨을 켜기 때문에, 표기가 한 글자만 달라도 라벨이 조용히 사라진다.
 *
 * ⚠ `기능성화장품` 은 `化粧品` 으로 접는다. 일본 医薬部外品 은 일본 후생노동성 승인 사항이라
 *   한국의 기능성 인정으로 추정할 수 없다 — 승인 없이 붙이면 허위 표시가 된다.
 */
const KUBUN_MAP: Record<string, string> = {
  화장품: '化粧品',
  기능성화장품: '化粧品',
  의약외품: '医薬部外品',
  의약부외품: '医薬部外品',
  건강식품: '健康食品',
  잡화: '雑貨',
  공산품: '雑貨',
};

/**
 * 区分 문자열을 일본 표기로 접는다. 아는 값이 아니면 null(콜⑧으로 넘긴다).
 * @param text 사용자가 입력한 구분
 */
export function normalizeKubun(text: string): string | null {
  const key = text.replace(/[\s·・]/g, '');
  return KUBUN_MAP[key] ?? null;
}

// ── 브랜드 용어집 선치환 ─────────────────────────────────────────────────────

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 브랜드가 등록한 KR→JA 표기를 결정적으로 치환한다(brandKit.productNamesJa).
 * 긴 것부터 바꾼다 — 「세라마이드 크림」이 등록돼 있는데 「세라마이드」를 먼저 바꾸면
 * 등록한 제품명 표기가 깨진다.
 *
 * @param text  원문
 * @param pairs brandKit.productNamesJa
 */
export function applyGlossary(text: string, pairs: BrandKit['productNamesJa']): string {
  const usable = pairs.filter((p) => p.kr.trim() && p.ja.trim()).sort((a, b) => b.kr.length - a.kr.length);
  let out = text;
  for (const p of usable) out = out.replace(new RegExp(escapeRe(p.kr.trim()), 'g'), p.ja.trim());
  return out;
}

// ── 경로 접근 ────────────────────────────────────────────────────────────────

type Segment = string | number;

/** `ingredients[0].name` → ['ingredients', 0, 'name'] */
function parsePath(path: string): Segment[] {
  const out: Segment[] = [];
  for (const seg of path.split('.')) {
    const m = /^([A-Za-z_]\w*)((?:\[\d+\])*)$/.exec(seg);
    if (!m) throw new Error(`잘못된 경로: ${path}`);
    out.push(m[1]);
    for (const idx of m[2].matchAll(/\[(\d+)\]/g)) out.push(Number(idx[1]));
  }
  return out;
}

/** 경로의 문자열 값을 읽는다. 중간이 null/undefined 면 undefined. */
export function getAt(root: unknown, path: string): string | undefined {
  let cur: unknown = root;
  for (const seg of parsePath(path)) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<Segment, unknown>)[seg];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * 경로에 문자열을 쓴다. 중간 경로가 없으면 **만들지 않고 조용히 건너뛴다** —
 * proof·sales·test·promo 는 null 일 수 있고, 없는 그룹을 되살리면 근거 없는 블록이 생긴다.
 */
function setAt(root: unknown, path: string, value: string): void {
  const segs = parsePath(path);
  let cur: unknown = root;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') return;
    cur = (cur as Record<Segment, unknown>)[segs[i]];
  }
  if (cur == null || typeof cur !== 'object') return;
  const last = segs[segs.length - 1];
  if (typeof (cur as Record<Segment, unknown>)[last] !== 'string') return;
  (cur as Record<Segment, unknown>)[last] = value;
}

// ── 변환 대상 선언 ───────────────────────────────────────────────────────────

interface ScalarSpec {
  path: string;
  label: string;
  kind: TranslateKind;
}
interface ListSpec {
  path: string;
  label: string;
  kind: TranslateKind;
}
interface RowSpec {
  path: string;
  label: string;
  fields: { key: string; label: string; kind: TranslateKind }[];
}

/**
 * 변환 대상 정본 — `assembleBlockSlots()` 가 원문 그대로 슬롯에 넣는 필드 전부.
 * 여기 없는 필드는 렌더에 안 쓰이거나(swatchHex·sku·rating) 코드가 조립한다.
 *
 * ⚠ 새 입력 필드를 추가할 때 여기 등록하지 않으면, 한국어로 입력됐을 때 **그 블록만 조용히 사라진다**.
 */
const SCALARS: ScalarSpec[] = [
  { path: 'spec.volume', label: '내용량', kind: 'numeric' },
  { path: 'spec.category', label: '구분(区分)', kind: 'regulated' },
  { path: 'spec.manufacturer', label: '판매원', kind: 'free' },
  { path: 'spec.origin', label: '원산지', kind: 'free' },
  { path: 'spec.fullIngredients', label: '전성분(全成分)', kind: 'regulated' },
  { path: 'proof.rankTitle', label: '실적명', kind: 'numeric' },
  { path: 'proof.genre', label: '실적 장르', kind: 'free' },
  { path: 'proof.aggregationDate', label: '집계일', kind: 'numeric' },
  { path: 'sales.count', label: '누적 판매', kind: 'numeric' },
  { path: 'sales.period', label: '집계 기간', kind: 'numeric' },
  { path: 'sales.reviewCount', label: '리뷰 수', kind: 'numeric' },
  { path: 'sales.rating', label: '평점', kind: 'numeric' },
  { path: 'test.name', label: '시험명', kind: 'free' },
  { path: 'test.condition', label: '시험 조건', kind: 'numeric' },
  { path: 'test.institution', label: '시험 기관', kind: 'free' },
  { path: 'test.date', label: '시험일', kind: 'numeric' },
  { path: 'test.sampleSize', label: '대상 인원', kind: 'numeric' },
  { path: 'promo.setTitle', label: '세트명', kind: 'numeric' },
  { path: 'promo.gift', label: 'GIFT', kind: 'numeric' },
  { path: 'promo.footnote', label: '프로모 각주', kind: 'numeric' },
];

const LISTS: ListSpec[] = [
  { path: 'freeOf', label: '무첨가', kind: 'free' },
  { path: 'howToSteps', label: '사용법 STEP', kind: 'free' },
  { path: 'cautions', label: '주의사항', kind: 'free' },
  { path: 'promo.qualifierChips', label: '한정 조건', kind: 'numeric' },
];

const ROWS: RowSpec[] = [
  {
    path: 'ingredients',
    label: '성분',
    fields: [
      { key: 'name', label: '성분명', kind: 'free' },
      { key: 'purpose', label: '배합 목적', kind: 'free' },
    ],
  },
  {
    path: 'specs',
    label: '스펙',
    fields: [
      { key: 'label', label: '항목', kind: 'free' },
      { key: 'value', label: '값', kind: 'numeric' },
    ],
  },
  { path: 'options', label: '옵션', fields: [{ key: 'name', label: '이름', kind: 'free' }] },
  {
    path: 'reviews',
    label: '리뷰',
    fields: [
      { key: 'text', label: '본문', kind: 'free' },
      { key: 'age', label: '연령대', kind: 'numeric' },
    ],
  },
];

/**
 * 한글이 섞인 입력 필드를 전부 모은다. **한글이 없으면 빈 배열** — 일본어로 입력한 사용자는
 * 콜⑧이 아예 만들어지지 않아 비용·지연이 0이다.
 *
 * @param input 폼 파싱 결과
 * @param note  「추가 요청」(DetailInput 밖이라 따로 받는다)
 */
export function collectTranslatable(input: DetailInput, note = ''): TranslatableField[] {
  const out: TranslatableField[] = [];
  const push = (path: string, label: string, kind: TranslateKind) => {
    const kr = getAt(input, path);
    if (kr && hasHangul(kr)) out.push({ path, label, kr, kind });
  };

  for (const s of SCALARS) push(s.path, s.label, s.kind);

  for (const l of LISTS) {
    const arr = getAt2Array(input, l.path);
    arr.forEach((_, i) => push(`${l.path}[${i}]`, `${l.label} ${i + 1}`, l.kind));
  }

  for (const r of ROWS) {
    const arr = getAt2Array(input, r.path);
    arr.forEach((_, i) => {
      for (const f of r.fields) push(`${r.path}[${i}].${f.key}`, `${r.label} ${i + 1} ${f.label}`, f.kind);
    });
  }

  if (note.trim() && hasHangul(note)) {
    out.push({ path: NOTE_PATH, label: '추가 요청', kr: note.trim(), kind: 'artDirection' });
  }
  return out;
}

/** 배열 경로를 읽는다(없으면 빈 배열). getAt 은 문자열 전용이라 별도로 둔다. */
function getAt2Array(root: unknown, path: string): unknown[] {
  let cur: unknown = root;
  for (const seg of parsePath(path)) {
    if (cur == null || typeof cur !== 'object') return [];
    cur = (cur as Record<Segment, unknown>)[seg];
  }
  return Array.isArray(cur) ? cur : [];
}

// ── 결정적 선처리 ────────────────────────────────────────────────────────────

/**
 * LLM 앞에서 결정적으로 끝낼 수 있는 것을 먼저 끝낸다.
 * 1) 区分 — 매핑표에 있으면 확정(문자열 비교로 라벨이 켜지므로 모델에 맡기면 안 된다)
 * 2) 브랜드 용어집 — 치환 후 한글이 남지 않으면 확정
 * 나머지는 콜⑧으로 넘긴다. 용어집은 페이로드에도 함께 실어 모델이 같은 표기를 쓰게 한다.
 *
 * @param fields   collectTranslatable 산출
 * @param brandKit 활성 브랜드의 브랜드킷(없으면 용어집 단계는 건너뛴다)
 */
export function preTranslate(
  fields: TranslatableField[],
  brandKit?: BrandKit | null,
): { resolved: TranslatedField[]; remaining: TranslatableField[] } {
  const resolved: TranslatedField[] = [];
  const remaining: TranslatableField[] = [];
  const pairs = brandKit?.productNamesJa ?? [];

  for (const f of fields) {
    if (f.path === 'spec.category') {
      const kubun = normalizeKubun(f.kr);
      if (kubun) {
        resolved.push({ ...f, ja: kubun, ok: true, via: 'kubun' });
        continue;
      }
    }
    if (pairs.length > 0 && f.kind !== 'artDirection') {
      const swapped = applyGlossary(f.kr, pairs);
      if (swapped !== f.kr && !hasHangul(swapped)) {
        resolved.push({ ...f, ja: swapped, ok: true, via: 'glossary' });
        continue;
      }
    }
    remaining.push(f);
  }
  return { resolved, remaining };
}

// ── 사후 검사 ────────────────────────────────────────────────────────────────

/**
 * 모델 산출 1건을 검사한다. 문제가 있으면 **채택하지 않는다**(원문이 남고 사용자가 고친다).
 * `validate` 콜백이 아니라 사후 검사인 이유: client.ts 는 검증 실패 시 교정 1회 후 throw 라,
 * 모델이 두 번 고집하면 콜 전체가 죽는다 — 필드 하나 때문에 생성이 무너지면 안 된다.
 *
 * @param field  원본 필드
 * @param jaRaw  모델이 낸 값
 */
export function verifyTranslation(field: TranslatableField, jaRaw: string): TranslatedField {
  const ja = jaRaw.trim();
  const base = { ...field, ja, via: 'llm' as const };

  if (!ja) return { ...base, ja: field.kr, ok: false, problem: '변환 결과가 비어 있습니다.' };

  if (field.kind === 'artDirection') {
    // 이미지 지시는 영어여야 한다 — 프롬프트 나머지가 전부 영어라 언어를 섞으면 지시가 흐려진다
    if (hasHangul(ja)) return { ...base, ok: false, problem: '한글이 남아 있습니다.' };
    return { ...base, ok: true };
  }

  if (hasHangul(ja)) return { ...base, ok: false, problem: '한글이 남아 있습니다 — 직접 일본어로 입력해 주세요.' };
  if (!numbersPreserved(field.kr, ja)) {
    return { ...base, ok: false, problem: `숫자가 원문과 다릅니다(원문 ${field.kr}). 값이 바뀌면 표시 위반이 됩니다.` };
  }
  return { ...base, ok: true };
}

/**
 * 금지 표현 위반 수집 — 게이트 기록용이고, 여기서 변환을 되돌리지는 않는다.
 * (brandKit 은 브랜드 규칙이지 법적 게이트가 아니다 — degradedBlocks 와 같은 등급)
 */
export function collectForbidden(
  fields: TranslatedField[],
  brandKit?: BrandKit | null,
): { path: string; term: string; reason: string }[] {
  const terms = (brandKit?.forbiddenTerms ?? []).filter((t) => t.term.trim());
  if (terms.length === 0) return [];
  const out: { path: string; term: string; reason: string }[] = [];
  for (const f of fields) {
    if (!f.ok) continue;
    for (const t of terms) {
      if (f.ja.includes(t.term.trim())) out.push({ path: f.path, term: t.term.trim(), reason: t.reason });
    }
  }
  return out;
}

// ── 적용 ─────────────────────────────────────────────────────────────────────

/**
 * 변환 결과를 입력에 되쓴다. **원본은 건드리지 않고 사본을 돌려준다** —
 * 원문(sourceKo)을 함께 스냅샷해야 하므로 호출부가 둘 다 들고 있어야 한다.
 *
 * @param input  원본 입력
 * @param fields 변환 결과(ok:false 는 건너뛴다 — 원문이 그대로 남는다)
 */
export function applyTranslations(input: DetailInput, fields: TranslatedField[]): DetailInput {
  const next = structuredClone(input);
  for (const f of fields) {
    if (!f.ok || f.path === NOTE_PATH) continue;
    setAt(next, f.path, f.ja);
  }
  return next;
}

/**
 * `applyTranslations` 의 **역방향** — 스냅샷된 한국어 원문을 되돌린다.
 *
 * 저장된 `DetailInput` 의 필드들은 이미 **일본어**다. 그것을 한국어 입력 폼에 그대로 채우면
 * 사용자가 자기가 쓴 적 없는 일본어를 다시 검토하게 되고, 재제출하면 콜⑧이 일본어를 또
 * 일본어로 옮긴다. `sourceKo` 는 바로 이 되돌리기를 위해 남겨 둔 것이다(08 §4.8).
 *
 * 스냅샷이 없는 필드(변환 대상이 아니었거나 이 기능 이전에 만든 자산)는 **그대로 둔다** —
 * 지우면 프리필이 입력을 되살리는 게 아니라 없애는 일이 된다.
 */
export function restoreKoreanInput(input: DetailInput): DetailInput {
  const next = structuredClone(input);
  for (const { path, kr } of input.sourceKo ?? []) {
    if (kr.trim()) setAt(next, path, kr);
  }
  return next;
}

/** 원문 보존용 스냅샷 — `detail_input.sourceKo` 에 들어간다(감사·되돌리기). */
export function sourceSnapshot(fields: TranslatedField[]): { path: string; kr: string }[] {
  return fields.filter((f) => f.ok && f.path !== NOTE_PATH).map((f) => ({ path: f.path, kr: f.kr }));
}

/**
 * 확인 화면이 돌려보낸 변환값을 **서버 기준으로 다시 검증**한다.
 *
 * 대상 목록과 원문은 서버가 파싱한 입력에서 다시 뽑고, 클라이언트에서는 `ja` 만 채택한다.
 * 사용자가 패널에서 직접 고친 값도 같은 검사를 통과해야 반영된다 —
 * 사람이 고쳤다고 숫자 변조가 안전해지지는 않는다.
 *
 * ⚠ `kr` 대조가 핵심이다. 확인 화면에서 블록을 껐다 켜면 이 함수가 다시 불리는데,
 *   그 사이 사용자가 입력을 바꿨다면 캐시된 `ja` 는 **다른 값의 번역**이다. 숫자가 없는 필드라면
 *   검사를 전부 통과해 엉뚱한 일본어가 조용히 들어간다. 그래서 원문이 한 글자라도 다르면 버린다.
 *
 * @param input   서버가 파싱한 입력
 * @param note    「추가 요청」 원문
 * @param entries 클라이언트가 보낸 { path, kr, ja } 목록
 * @returns complete=false 면 캐시가 현재 입력을 못 덮는다 → 호출부가 콜⑧을 다시 태워야 한다
 */
export function verifyClientTranslation(
  input: DetailInput,
  note: string,
  entries: { path: string; kr?: string; ja: string }[],
): { fields: TranslatedField[]; artDirectionEn: string; complete: boolean } {
  const byPath = new Map(entries.map((e) => [e.path, e]));
  let complete = true;
  const fields = collectTranslatable(input, note).map((f) => {
    const hit = byPath.get(f.path);
    if (!hit || (hit.kr != null && hit.kr !== f.kr)) {
      complete = false;
      return { ...f, ja: f.kr, ok: false, problem: '변환값이 없습니다 — 다시 확인해 주세요.', via: 'llm' as const };
    }
    return verifyTranslation(f, hit.ja);
  });
  const noteField = fields.find((f) => f.path === NOTE_PATH);
  return { fields, artDirectionEn: noteField?.ok ? noteField.ja : '', complete };
}
