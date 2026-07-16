/**
 * 벤치마크 대비표 단위 테스트 — "미확인" 3분기(스펙 §3.3 v4 · AC-1.5).
 * 핵심 불변식: 콘텐츠를 스캔한 적 없으면(signals=null) "미관찰"이라고 주장하지 않는다.
 * "미관찰"은 *찾아봤는데 없었다*는 판정 — 근거 없이 쓰면 증거 원칙 위반.
 * 러너: node:test(프로젝트 루트에서 실행 — 사전집계 파일을 cwd 기준으로 읽는다).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildBenchmark } from './benchmark';
import type { PreSignals } from '../types';

function signals(overrides: Partial<PreSignals> = {}): PreSignals {
  return {
    hasNumericClaim: false,
    hasSpfPa: false,
    hasFootnoteMark: false,
    hasFreeLabel: false,
    hasThirdPartyProof: false,
    hasIngredientPercent: false,
    notes: [],
    ...overrides,
  };
}

describe('buildBenchmark — customerStatus 3분기', () => {
  it("signals=null(브랜드 진단) → 전 행 '미확인' — '미관찰'을 지어내지 않는다", () => {
    const result = buildBenchmark('skincare', null);
    assert.ok(result.comparisonRows.length > 0, '사전집계가 있으면 대비행이 나와야 한다');
    for (const row of result.comparisonRows) {
      assert.equal(row.customerStatus, '미확인', `${row.device}: 스캔한 적 없는 콘텐츠는 미확인이어야 한다`);
      assert.match(row.gapNote, /카피를 넣으면/, '갭 노트는 판정이 아니라 안내여야 한다');
    }
  });

  it("signals 있음(풀 모드) → '관찰됨'/'미관찰' 유지 (회귀)", () => {
    const result = buildBenchmark('skincare', signals({ hasFreeLabel: true }));
    const free = result.comparisonRows.find((r) => r.device.includes('프리 처방'));
    const footnote = result.comparisonRows.find((r) => r.device.includes('각주'));
    assert.equal(free?.customerStatus, '관찰됨');
    assert.equal(footnote?.customerStatus, '미관찰');
    assert.ok(result.comparisonRows.every((r) => r.customerStatus !== '미확인'), '풀 모드에 미확인이 나오면 안 된다');
  });

  it('코퍼스 측 산출은 모드와 무관하게 동일하다 — 잠기는 건 대비뿐', () => {
    const brand = buildBenchmark('skincare', null);
    const full = buildBenchmark('skincare', signals());
    assert.equal(brand.sampleCount, full.sampleCount);
    assert.deepEqual(brand.corpusQuotes, full.corpusQuotes);
    assert.deepEqual(brand.searchTermRows, full.searchTermRows);
  });
});
