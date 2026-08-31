/**
 * 시즌 메모 입력 검증(SEASON-03) — API 라우트 2개가 같은 규칙을 쓴다.
 * 저장 대상은 사용자가 적은 메모뿐이다. 시즌 이벤트는 lib/season.ts 상수라 여기서 다루지 않는다.
 */

/** 메모 본문 상한 — 캘린더 셀에 얹히는 짧은 준비 메모다 */
export const MEMO_MAX_LENGTH = 300;

/** 'YYYY-MM-DD' 형식이고 실재하는 날짜인가 */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export interface ParsedMemo {
  startDate: string;
  endDate: string | null;
  body: string;
}

/**
 * 메모 payload 를 검증해 저장 형태로 돌려준다. 사용자에게 보여줄 오류는 { error } 로 돌려준다.
 * @param payload JSON 본문(신뢰하지 않는 입력)
 */
export function parseSeasonMemo(payload: unknown): ParsedMemo | { error: string } {
  const raw = (payload ?? {}) as Record<string, unknown>;

  const startDate = String(raw.startDate ?? '').trim();
  if (!isIsoDate(startDate)) return { error: '시작 날짜를 YYYY-MM-DD 형식으로 선택해 주세요.' };

  const endRaw = String(raw.endDate ?? '').trim();
  const endDate = endRaw ? endRaw : null;
  if (endDate && !isIsoDate(endDate)) return { error: '종료 날짜를 YYYY-MM-DD 형식으로 선택해 주세요.' };
  // 문자열 비교로 충분하다 — 고정폭 ISO 날짜는 사전순 = 시간순이고 타임존 해석이 끼지 않는다
  if (endDate && endDate < startDate) return { error: '종료 날짜가 시작 날짜보다 앞설 수 없습니다.' };

  const body = String(raw.body ?? '')
    .trim()
    .slice(0, MEMO_MAX_LENGTH);
  if (!body) return { error: '메모 내용을 입력해 주세요.' };

  return { startDate, endDate, body };
}
