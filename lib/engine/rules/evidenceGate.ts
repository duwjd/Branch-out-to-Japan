/**
 * 증거 원칙 자동 검사 — 조립된 blocksJson 을 결정적으로 훑는다(LLM 없음).
 *
 * 왜 필요한가: 스펙 §0가 "증거 원칙(가상 스탯·익명 사례 금지)"을 **재논의 금지 확정 전제**로
 * 두고, 성공 지표(§6)가 "증거 원칙 위반 0건"이다. 그런데 집행은 AC-2.5의 **수동 QA**뿐이었다.
 * 프롬프트 가드레일(`EVIDENCE_GUARDRAIL`)은 모델에게 부탁하는 것이지 검사하는 것이 아니다.
 *
 * 이 검사는 **비차단**이다. 리포트를 막지 않고 경고만 남긴다 — 정규식은 맥락을 모르므로
 * 오탐이 나오고, 오탐으로 발행을 막으면 아무도 이 게이트를 켜두지 않는다.
 * 잡을 죽이는 판단은 사람이 경고를 보고 한다.
 *
 * ⚠ **LLM이 쓴 자리만 본다.** 블록0·9의 고지·한계·퍼널 문구는 사람이 쓴 템플릿이고
 *   "보장하지 않습니다" 같은 부정문을 정당하게 포함한다 — 검사 대상에 넣으면 전부 오탐이 된다.
 */

import type { BlocksJson } from '../types';

export type EvidenceIssueKind = 'guarantee' | 'anonymousCase' | 'unsourcedStat';

export interface EvidenceIssue {
  kind: EvidenceIssueKind;
  /** 위반이 난 blocksJson 경로 */
  path: string;
  /** 걸린 표현 */
  match: string;
  /** 왜 문제인가(한국어) */
  note: string;
}

interface Pattern {
  kind: EvidenceIssueKind;
  re: RegExp;
  note: string;
}

/**
 * 금지 패턴.
 *
 * 「」 안 일본어 인용은 검사 전에 걷어낸다 — 코퍼스 실측 표현에는 「売上No.1」처럼 성과 문구가
 * 정당하게 들어 있다. 그건 **일본 상위 제품이 그렇게 쓴다는 관찰**이지 우리의 주장이 아니다.
 */
const PATTERNS: Pattern[] = [
  {
    kind: 'guarantee',
    re: /(보장(합니다|해\s?드립니다|됩니다|한다)|반드시\s*(오릅|상승|성공|증가)|틀림없이|확실히\s*(매출|판매|성과|전환))/g,
    note: '성과 보장·단정 표현입니다. 유통 입점·광고 성과·판매 실적은 보장하지 않습니다(포지셔닝 확정 사항).',
  },
  {
    kind: 'anonymousCase',
    re: /((어느|한|모)\s*(브랜드|업체|고객사)(는|의|가)|익명의?\s*(브랜드|사례|고객)|某\s*ブランド)/g,
    note: '익명 사례는 검증할 수 없습니다. 코퍼스·규정 실측 밖의 사례를 쓰지 않습니다(AC-2.5).',
  },
  {
    kind: 'unsourcedStat',
    re: /\d+(\.\d+)?\s*(%|퍼센트|배)\s*(이상\s*)?(상승|증가|향상|개선|성장|급증)/g,
    note: '출처 없는 성과 수치입니다. 코퍼스·규정 근거 밖의 수치는 창작 금지입니다(증거 원칙).',
  },
];

/** 「」·『』 인용 제거 — 코퍼스 실측 인용은 우리의 주장이 아니다 */
function stripJapaneseQuotes(text: string): string {
  return text.replace(/「[^」]*」|『[^』]*』/g, ' ');
}

/** LLM이 쓴 한국어 서술만 모은다 — 템플릿 문구·원문 인용은 제외(파일 헤더 참조) */
function llmAuthoredText(blocks: BlocksJson): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const push = (path: string, text: string | undefined) => {
    if (typeof text === 'string' && text.trim()) out.push({ path, text });
  };

  push('block1.summaryText', blocks.block1.summaryText);
  push('block2.persona.buyingMotive', blocks.block2.persona.buyingMotive);
  push('block2.persona.priceSensitivity', blocks.block2.persona.priceSensitivity);
  blocks.block2.journey.stages.forEach((s, i) => push(`block2.journey.stages[${i}]`, s));
  push('block2.journey.finalConfidencePoint', blocks.block2.journey.finalConfidencePoint);
  blocks.block2.objections.forEach((o, i) => push(`block2.objections[${i}].why`, o.why));
  blocks.block2.uspTable.forEach((u, i) => {
    push(`block2.uspTable[${i}].jpReading`, u.jpReading);
    push(`block2.uspTable[${i}].redefinedUsp`, u.redefinedUsp);
  });
  blocks.block3?.sentences.forEach((s, i) => push(`block3.sentences[${i}].reason`, s.reason));
  push('block4.narrative', blocks.block4.narrative);
  blocks.block6.narrative.forEach((r, i) => {
    push(`block6.narrative[${i}].infoGap`, r.infoGap);
    push(`block6.narrative[${i}].distrustSignal`, r.distrustSignal);
    push(`block6.narrative[${i}].dropOff`, r.dropOff);
  });
  blocks.block7?.rewrites.forEach((r, i) => {
    push(`block7.rewrites[${i}].problem`, r.problem);
    push(`block7.rewrites[${i}].reason`, r.reason);
    push(`block7.rewrites[${i}].afterKr`, r.afterKr);
    r.whatAdded.forEach((w, j) => push(`block7.rewrites[${i}].whatAdded[${j}]`, w));
  });
  push('block8.afterKrBlock', blocks.block8?.afterKrBlock);

  return out;
}

/**
 * 증거 원칙 위반 후보를 찾는다. **비차단** — 호출자는 경고로만 다룬다.
 * @param blocks 조립된 blocksJson
 */
export function checkEvidence(blocks: BlocksJson): EvidenceIssue[] {
  const issues: EvidenceIssue[] = [];
  for (const { path, text } of llmAuthoredText(blocks)) {
    const body = stripJapaneseQuotes(text);
    for (const p of PATTERNS) {
      // 전역 정규식은 lastIndex 를 들고 다닌다 — 경로마다 새로 만든다
      const re = new RegExp(p.re.source, 'g');
      for (const m of body.matchAll(re)) {
        issues.push({ kind: p.kind, path, match: m[0].trim(), note: p.note });
      }
    }
  }
  return issues;
}
