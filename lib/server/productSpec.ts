/**
 * 제품 스펙(BRAND-03b 3b-6) 폼 파싱 — 생성·편집 라우트가 같은 규칙을 쓰게 한다.
 *
 * 두 라우트가 각자 파싱하면 한쪽만 필드가 늘거나 확인 상태가 빠져, 제품에 저장된 값과
 * 상세 폼이 프리필로 펴는 값이 조용히 갈린다.
 */

import type { ProductSpec } from '../db/store';
import { EXTRACT_FIELDS, REVIEW_REQUIRED_FIELDS } from '../studio/detail/extractCall';

/**
 * `spec` (JSON 문자열)을 읽는다. 없거나 깨졌으면 undefined —
 * **스펙 파싱 실패가 제품 등록을 막지 X.** 스펙은 부속이고 제품이 본체다.
 */
export function parseProductSpec(raw: FormDataEntryValue | null): ProductSpec | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const obj = parsed as { fields?: Record<string, unknown>; reviewed?: unknown[] };
  const fields: Record<string, string> = {};
  // 아는 칸만 받는다 — 폼이 무엇을 보내든 저장되는 키는 추출 계약 안에서만 늘어난다
  for (const name of EXTRACT_FIELDS) {
    const v = obj.fields?.[name];
    if (typeof v === 'string' && v.trim()) fields[name] = v;
  }
  if (Object.keys(fields).length === 0) return undefined;

  const reviewed = REVIEW_REQUIRED_FIELDS.filter(
    (f) => Array.isArray(obj.reviewed) && obj.reviewed.includes(f) && fields[f],
  );
  return { fields, reviewed, extractedAt: new Date().toISOString() };
}
