/**
 * 홈 히어로 오른쪽 카드에 올릴 "리포트가 실제로 내놓은 것" 한 쌍을 고른다(MAIN-03 · 2026-11-24).
 *
 * 왜 점수 요약이 아니라 문구 한 쌍인가: 진단을 마친 사람이 다음 단계(썸네일·상세페이지)를 만들 때
 * 곁에 두고 볼 것은 "7/100"이 아니라 **원문이 어떻게 바뀌었는가**다. 그게 이 서비스의 본체이고
 * (번역이 아니라 재설계), 첫 진단 전 예시 카드와 같은 모양(원문 → 재설계 → 이유)으로 이어진다.
 *
 * ⚠ 이 카드는 참고 자료다 — 스튜디오가 이 문구를 자동으로 받아 쓰지 않는다(폐루프 배선은
 * 04-roadmap §0-4 미해결). 그래서 화면 문구도 "재료가 된다"가 아니라 "기준으로 삼는다"고 쓴다.
 */

import type { BlocksJson } from '../engine/types';

export interface ReportMaterial {
  /** 'rewrite' = 문장 재설계(블록7) · 'usp' = USP 재정의(블록2 — 브랜드 진단은 이것만 있다) */
  kind: 'rewrite' | 'usp';
  /** 바뀌기 전 — 고객 원문(한국어) 또는 한국식 소구 */
  before: string;
  /** 바뀐 뒤 — 재설계 문구(일본어) 또는 재정의한 USP(한국어) */
  after: string;
  /** after 의 언어 — 화면이 lang 속성과 글꼴 처리를 고른다 */
  afterLang: 'ja' | 'ko';
  /** 왜 바꿨는가 한 줄 */
  reason: string;
  /** 리포트에 같은 종류가 모두 몇 건 있는가 — "외 2건" 표기용 */
  total: number;
}

/**
 * 리포트 본문에서 홈에 올릴 한 쌍을 고른다. 없는 값을 만들지 않는다 — 고를 것이 없으면 null.
 * 우선순위: ① 문장 재설계 중 일본어 문구가 실제로 채워진 첫 건 ② USP 재정의 첫 건.
 * `rewrites: []` 는 풀 모드의 콜④ 실패 폴백이라 ②로 내려간다(블록7 주석 참조).
 * @param blocks 리포트 9블록 본문
 */
export function pickReportMaterial(blocks: BlocksJson): ReportMaterial | null {
  const rewrites = (blocks.block7?.rewrites ?? []).filter((r) => r.beforeKr.trim() && r.afterJa.trim());
  if (rewrites.length > 0) {
    const r = rewrites[0];
    return {
      kind: 'rewrite',
      before: r.beforeKr.trim(),
      after: r.afterJa.trim(),
      afterLang: 'ja',
      reason: (r.problem || r.reason).trim(),
      total: rewrites.length,
    };
  }

  const usps = blocks.block2.uspTable.filter((u) => u.krAppeal.trim() && u.redefinedUsp.trim());
  if (usps.length > 0) {
    const u = usps[0];
    return {
      kind: 'usp',
      before: u.krAppeal.trim(),
      after: u.redefinedUsp.trim(),
      afterLang: 'ko',
      reason: u.jpReading.trim(),
      total: usps.length,
    };
  }

  return null;
}

/** 표현 감사(블록3) 판정 분포 — 브랜드 진단은 감사 대상 문장이 없어 null */
export interface AuditCounts {
  ng: number;
  conditional: number;
  ok: number;
}

/**
 * 약기법 표현 감사의 판정 분포를 꺼낸다. 감사 대상이 없었으면(브랜드 진단) null —
 * 0·0·0 으로 그리면 "감사했는데 문제없음"으로 읽힌다(증거 원칙).
 * @param blocks 리포트 9블록 본문
 */
export function auditCounts(blocks: BlocksJson): AuditCounts | null {
  const s = blocks.block3?.summary;
  if (!s) return null;
  if (s.ngCount + s.conditionalCount + s.okCount === 0) return null;
  return { ng: s.ngCount, conditional: s.conditionalCount, ok: s.okCount };
}
