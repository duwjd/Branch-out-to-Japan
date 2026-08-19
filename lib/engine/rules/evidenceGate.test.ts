/**
 * 증거 원칙 게이트 단위 테스트.
 * 러너: node:test. 실행: npm run test.
 *
 * 이 게이트는 비차단이라 오탐이 곧 무시로 이어진다 — "경고가 늘 떠 있는 게이트"는 꺼진 게이트다.
 * 그래서 검출만큼 **오탐 방지**를 같은 무게로 고정한다. 특히 두 가지가 중요하다.
 *  · 「」 안 코퍼스 인용의 성과 문구(일본 상위 제품이 그렇게 쓴다는 **관찰**)
 *  · 템플릿 문구의 부정문("보장하지 않습니다")
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkEvidence } from './evidenceGate';
import { runReportPipeline } from '../pipeline';
import type { BlocksJson, BrandProductInput } from '../types';

const INPUT: BrandProductInput = {
  mode: 'brandProduct',
  brandName: '테스트브랜드',
  positioning: { tags: [], note: '' },
  category: 'skincare',
  productName: '시카 앰플',
  productClass: '화장품',
  sourceType: 'text',
  sourceText: '피부 진정에 탁월한 시카 앰플입니다. 즉각적인 효과를 느낄 수 있습니다. 민감한 피부도 안심하세요. '.repeat(4),
};

async function mockBlocks(): Promise<BlocksJson> {
  process.env.LLM_MODE = 'mock';
  return (await runReportPipeline(INPUT)).blocksJson;
}

/** 특정 경로의 값을 갈아끼운 사본 — 위반 문구를 심어 검출을 확인한다 */
function withSummary(blocks: BlocksJson, text: string): BlocksJson {
  const next = structuredClone(blocks);
  next.block1.summaryText = text;
  return next;
}

describe('checkEvidence — 검출', () => {
  it('성과 보장 문구를 잡는다', async () => {
    const blocks = await mockBlocks();
    const issues = checkEvidence(withSummary(blocks, '이대로 고치면 일본 매출 상승을 보장합니다.'));
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'guarantee');
    assert.equal(issues[0].path, 'block1.summaryText');
  });

  it('익명 사례를 잡는다', async () => {
    const blocks = await mockBlocks();
    const issues = checkEvidence(withSummary(blocks, '어느 브랜드는 같은 방식으로 성과를 냈습니다.'));
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'anonymousCase');
  });

  it('출처 없는 성과 수치를 잡는다', async () => {
    const blocks = await mockBlocks();
    const issues = checkEvidence(withSummary(blocks, '전환율이 30% 상승합니다.'));
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'unsourcedStat');
    assert.equal(issues[0].match, '30% 상승');
  });

  it('"확실히 매출" 같은 단정도 잡는다', async () => {
    const blocks = await mockBlocks();
    const issues = checkEvidence(withSummary(blocks, '이 구조로 바꾸면 확실히 매출이 따라옵니다.'));
    assert.equal(issues[0].kind, 'guarantee');
  });
});

describe('checkEvidence — 오탐 방지', () => {
  it('목 모드 리포트(정상 산출)는 위반 0건', async () => {
    const issues = checkEvidence(await mockBlocks());
    assert.deepEqual(issues, [], JSON.stringify(issues, null, 2));
  });

  it('「」 안 코퍼스 인용의 성과 문구는 우리 주장이 아니다 — 잡지 않는다', async () => {
    const blocks = await mockBlocks();
    const issues = checkEvidence(
      withSummary(blocks, '일본 상위 제품은 「楽天ランキング1位」처럼 집계일과 함께 실적을 적습니다.'),
    );
    assert.deepEqual(issues, []);
  });

  it('정상적인 진단 서술은 잡지 않는다', async () => {
    const blocks = await mockBlocks();
    const issues = checkEvidence(
      withSummary(blocks, '근거 라벨과 조건 각주가 없어 일본 고객이 주장을 검증할 수 없습니다.'),
    );
    assert.deepEqual(issues, []);
  });

  it('템플릿 문구(블록0·9)는 애초에 검사 대상이 아니다', async () => {
    const blocks = await mockBlocks();
    const next = structuredClone(blocks);
    // 실제 고지 문구에 가까운 부정문을 심어도 검사 대상이 아니라 잡히지 않아야 한다
    next.block0.limitSummary = '유통 입점·광고 성과·판매 실적을 보장합니다라고 쓰지 않습니다.';
    next.block9.limits = ['성과를 보장합니다 같은 표현은 쓰지 않습니다.'];
    assert.deepEqual(checkEvidence(next), []);
  });

  it('일본어 산출물(afterJa)은 검사 대상이 아니다 — 한국어 패턴이 무의미하다', async () => {
    const blocks = await mockBlocks();
    const next = structuredClone(blocks);
    if (next.block7?.rewrites[0]) next.block7.rewrites[0].afterJa = '売上No.1を保証します';
    assert.deepEqual(checkEvidence(next), []);
  });
});
