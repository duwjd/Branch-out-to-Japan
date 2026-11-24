/**
 * 홈 리포트 발췌 단위 테스트 — 재설계 문구 우선·USP 폴백·없는 값을 만들지 않는 규칙.
 * 러너: node:test. 실행: npm run test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BlocksJson } from '../engine/types';
import { auditCounts, pickReportMaterial } from './reportMaterial';

type Rewrite = NonNullable<BlocksJson['block7']>['rewrites'][number];

/** 재설계 1건 — 필요한 필드만 덮어쓴다 */
function rewrite(over: Partial<Rewrite>): Rewrite {
  return {
    sourceRef: 'K1',
    beforeKr: '48시간 촉촉함이 유지되는 크림',
    problem: '수치 단정에는 시험 근거가 필요',
    afterJa: '乾燥に負けない、なめらかうるおい肌へ',
    afterKr: '건조에 지지 않는 매끄러운 피부로',
    reason: '근거 없는 수치를 제외',
    whatAdded: [],
    uspRowIndex: 0,
    ...over,
  };
}

/**
 * 이 모듈이 읽는 블록(2·3·7)만 채운 리포트 본문. 나머지 블록은 읽지 않으므로 비워 둔다 —
 * BlocksJson 전체를 손으로 채우면 테스트가 리포트 스키마 변경마다 깨진다.
 */
function blocks(parts: {
  rewrites?: Rewrite[] | null;
  usps?: BlocksJson['block2']['uspTable'];
  audit?: { ngCount: number; conditionalCount: number; okCount: number } | null;
}): BlocksJson {
  return {
    block2: { uspTable: parts.usps ?? [] },
    block3: parts.audit ? { summary: { ...parts.audit, highestRiskId: '' } } : null,
    block7: parts.rewrites === null ? null : { rewrites: parts.rewrites ?? [] },
  } as unknown as BlocksJson;
}

const usp = {
  krAppeal: '즉각 효과 강조',
  jpReading: '근거 없는 단정은 과장으로 읽힌다',
  redefinedUsp: '검증된 안심을 판다',
};

describe('pickReportMaterial', () => {
  it('문장 재설계가 있으면 첫 건을 일본어 문구로 돌려준다', () => {
    const m = pickReportMaterial(blocks({ rewrites: [rewrite({}), rewrite({ sourceRef: 'K2' })], usps: [usp] }));
    assert.equal(m?.kind, 'rewrite');
    assert.equal(m?.afterLang, 'ja');
    assert.equal(m?.before, '48시간 촉촉함이 유지되는 크림');
    assert.equal(m?.after, '乾燥に負けない、なめらかうるおい肌へ');
    assert.equal(m?.reason, '수치 단정에는 시험 근거가 필요');
    assert.equal(m?.total, 2);
  });

  it('일본어 문구가 비어 있는 재설계는 건너뛴다', () => {
    const m = pickReportMaterial(
      blocks({ rewrites: [rewrite({ afterJa: '  ' }), rewrite({ beforeKr: '둘째 원문' })] }),
    );
    assert.equal(m?.before, '둘째 원문');
    assert.equal(m?.total, 1);
  });

  it('problem 이 비면 reason 으로 이유를 채운다', () => {
    const m = pickReportMaterial(blocks({ rewrites: [rewrite({ problem: '' })] }));
    assert.equal(m?.reason, '근거 없는 수치를 제외');
  });

  it('브랜드 진단(block7 null)은 USP 재정의로 내려간다', () => {
    const m = pickReportMaterial(blocks({ rewrites: null, usps: [usp] }));
    assert.equal(m?.kind, 'usp');
    assert.equal(m?.afterLang, 'ko');
    assert.equal(m?.before, '즉각 효과 강조');
    assert.equal(m?.after, '검증된 안심을 판다');
  });

  it('콜④ 실패 폴백(rewrites: [])도 USP 재정의로 내려간다', () => {
    assert.equal(pickReportMaterial(blocks({ rewrites: [], usps: [usp] }))?.kind, 'usp');
  });

  it('고를 것이 없으면 null — 값을 만들어 내지 않는다', () => {
    assert.equal(pickReportMaterial(blocks({ rewrites: null, usps: [] })), null);
  });
});

describe('auditCounts', () => {
  it('판정 분포를 그대로 돌려준다', () => {
    const c = auditCounts(blocks({ audit: { ngCount: 2, conditionalCount: 1, okCount: 1 } }));
    assert.deepEqual(c, { ng: 2, conditional: 1, ok: 1 });
  });

  it('감사 대상이 없던 리포트는 null — 0·0·0 을 "문제없음"으로 보이지 않는다', () => {
    assert.equal(auditCounts(blocks({ audit: null })), null);
    assert.equal(auditCounts(blocks({ audit: { ngCount: 0, conditionalCount: 0, okCount: 0 } })), null);
  });
});
