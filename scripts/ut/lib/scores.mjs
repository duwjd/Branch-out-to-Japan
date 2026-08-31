/**
 * 페르소나 응답의 ```scores 블록 파싱 + §7-4 타당성 가드.
 *
 * 왜 블록을 따로 받나: 응답은 구어체 산문이라 점수를 문장에서 긁으면 오독이 조용히 숫자가 된다.
 * 페르소나에게 "집계는 이 블록만 읽는다"고 알리고 그 블록만 신뢰한다.
 */

/** 페르소나 가격 상한(원) — `.claude/agents/persona_NN.md` 의 "가격 수용도" */
export const PRICE_CEILING = {
  P01: 500_000,
  P02: 500_000,
  P03: 1_000_000,
  P04: 500_000,
  P05: 500_000,
  P06: 1_000_000,
  P07: 500_000,
  P08: 1_000_000,
  P09: 1_000_000,
  P10: 1_000_000,
  P11: 1_000_000,
  P12: 500_000,
  P13: 1_000_000,
  P14: 1_000_000,
  P15: 1_000_000,
  P16: 1_000_000,
  P17: 1_000_000,
  P18: 1_000_000,
  P19: 0,
  P20: 0,
};

/** 단독 결정이 불가능한 페르소나 — 품의형(§2 교차 렌즈) */
export const APPROVAL_REQUIRED = new Set(['P08', 'P10', 'P14', 'P15', 'P17']);
/** AI 거부감군 — 무저항 수용이면 페르소나 위반 */
export const AI_RESIST = new Set(['P05', 'P13', 'P19', 'P20']);

/** ```scores … ``` 안의 `키=값` 을 모두 뽑는다. 주석(#)과 공백은 버린다 */
export function parseScores(markdown) {
  const m = /```scores\s*\n([\s\S]*?)```/.exec(markdown ?? '');
  if (!m) return null;
  const out = {};
  for (const rawLine of m[1].split('\n')) {
    const line = rawLine.split('#')[0];
    // 한 줄에 `sat_T1=3  sat_T2=4` 처럼 여러 쌍이 올 수 있다
    // 키에 숫자가 들어간다(sat_T1·dropoff_T5) — 숫자를 빼면 그 줄이 통째로 안 잡힌다
    for (const [, k, v] of line.matchAll(
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^=]*?)(?=\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=|$)/g,
    )) {
      out[k] = v.trim();
    }
  }
  return out;
}

const num = (v) => {
  const raw = String(v ?? '').replace(/[^\d.-]/g, '');
  if (raw.trim() === '') return null; // 빈칸은 0 이 아니라 '값 없음'이다
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/**
 * §7-4 타당성 가드. 걸린 플래그를 돌려준다(빈 배열이면 유효).
 * 무효 행은 평균에서 빼고 리포트 §14 에 건수를 적는다 — 지우지 않는다.
 */
export function validityFlags(personaId, s, markdown) {
  const flags = [];
  const ceiling = PRICE_CEILING[personaId];
  const krw = num(s.wtp_krw) ?? 0;
  if (ceiling !== undefined && krw > ceiling) flags.push('price_overrun');
  if (
    APPROVAL_REQUIRED.has(personaId) &&
    String(s.wtp).toUpperCase() === 'Y' &&
    !/품의|결재|사내|위에|대표님/.test(markdown ?? '')
  ) {
    flags.push('approval_bypass');
  }
  if (AI_RESIST.has(personaId)) {
    const axes = [
      'rep_acc',
      'rep_act',
      'rep_dif',
      'rep_tru',
      'thu_acc',
      'thu_act',
      'thu_dif',
      'thu_tru',
      'det_acc',
      'det_act',
      'det_dif',
      'det_tru',
    ]
      .map((k) => num(s[k]))
      .filter((n) => n !== null);
    if (axes.length > 0 && axes.every((n) => n >= 4)) flags.push('ai_no_resist');
  }
  const all = [
    'landing_appeal',
    'landing_interest',
    'landing_intent',
    'sat_T1',
    'sat_T2',
    'sat_T3',
    'sat_T4',
    'sat_T5',
    'sat_T6',
    'sat_T7',
    'rep_acc',
    'rep_act',
    'rep_dif',
    'rep_tru',
    'thu_acc',
    'thu_act',
    'thu_dif',
    'thu_tru',
    'det_acc',
    'det_act',
    'det_dif',
    'det_tru',
  ]
    .map((k) => num(s[k]))
    .filter((n) => n !== null);
  if (all.length >= 10 && all.every((n) => n >= 4)) flags.push('positivity');
  return flags;
}

export { num };
