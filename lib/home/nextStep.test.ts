/**
 * 홈 "다음 단계" 판정 단위 테스트 — 파이프라인 순서·진행 중/실패 분기·건너뛴 단계.
 * 러너: node:test. 실행: npm run test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pipelineDoneCount, pipelineStates, resolveHomeStep, type HomeStepInput } from './nextStep';

/** 브랜드만 등록한 첫 방문 상태 — 각 테스트가 필요한 필드만 덮어쓴다 */
const fresh: HomeStepInput = {
  publishedReports: 0,
  runningReportId: null,
  failedReportId: null,
  doneThumbnails: 0,
  runningThumbnailId: null,
  doneDetails: 0,
  runningDetailId: null,
  seasonInLeadWindow: false,
};

describe('resolveHomeStep', () => {
  it('자산이 없으면 진단부터다', () => {
    assert.deepEqual(resolveHomeStep(fresh), { key: 'diagnose', mode: 'ready', targetId: null });
  });

  it('첫 진단이 도는 중이면 시작이 아니라 진행 보기다', () => {
    assert.deepEqual(resolveHomeStep({ ...fresh, runningReportId: 'r1' }), {
      key: 'diagnose',
      mode: 'running',
      targetId: 'r1',
    });
  });

  it('진행 중 진단이 실패 이력보다 앞선다', () => {
    const step = resolveHomeStep({ ...fresh, runningReportId: 'r2', failedReportId: 'r1' });
    assert.equal(step.mode, 'running');
    assert.equal(step.targetId, 'r2');
  });

  it('발행 리포트 없이 실패만 있으면 원인 확인이 다음 할 일이다', () => {
    assert.deepEqual(resolveHomeStep({ ...fresh, failedReportId: 'r1' }), {
      key: 'diagnose',
      mode: 'failed',
      targetId: 'r1',
    });
  });

  it('리포트가 발행되면 지난 실패는 다음 단계를 막지 않는다', () => {
    const step = resolveHomeStep({ ...fresh, publishedReports: 1, failedReportId: 'r0' });
    assert.deepEqual(step, { key: 'thumbnail', mode: 'ready', targetId: null });
  });

  it('썸네일 생성 중이면 썸네일 단계의 진행 보기다', () => {
    const step = resolveHomeStep({ ...fresh, publishedReports: 1, runningThumbnailId: 't1' });
    assert.deepEqual(step, { key: 'thumbnail', mode: 'running', targetId: 't1' });
  });

  it('썸네일까지 있으면 상세페이지 차례다', () => {
    const step = resolveHomeStep({ ...fresh, publishedReports: 1, doneThumbnails: 2 });
    assert.deepEqual(step, { key: 'detail', mode: 'ready', targetId: null });
  });

  it('세 가지를 다 만들었으면 시즌 착수 여부로 갈린다', () => {
    const all = { ...fresh, publishedReports: 1, doneThumbnails: 1, doneDetails: 1 };
    assert.equal(resolveHomeStep(all).key, 'steady');
    assert.equal(resolveHomeStep({ ...all, seasonInLeadWindow: true }).key, 'season');
  });

  it('흐름이 남아 있으면 시즌이 임박해도 흐름의 다음 단계가 먼저다', () => {
    const step = resolveHomeStep({ ...fresh, publishedReports: 1, seasonInLeadWindow: true });
    assert.equal(step.key, 'thumbnail');
  });
});

describe('pipelineStates', () => {
  it('브랜드는 항상 완료, 아직 없는 첫 단계 하나만 current', () => {
    assert.deepEqual(pipelineStates(fresh), {
      brand: 'done',
      report: 'current',
      thumbnail: 'todo',
      detail: 'todo',
    });
    assert.equal(pipelineDoneCount(fresh), 1);
  });

  it('건너뛴 단계가 current 가 되고 이미 만든 뒤 단계는 done 으로 남는다', () => {
    const skipped = { ...fresh, publishedReports: 1, doneDetails: 1 };
    assert.deepEqual(pipelineStates(skipped), {
      brand: 'done',
      report: 'done',
      thumbnail: 'current',
      detail: 'done',
    });
    assert.equal(pipelineDoneCount(skipped), 3);
  });

  it('다 만들면 current 가 없다', () => {
    const all = { ...fresh, publishedReports: 2, doneThumbnails: 3, doneDetails: 1 };
    assert.ok(Object.values(pipelineStates(all)).every((s) => s === 'done'));
    assert.equal(pipelineDoneCount(all), 4);
  });
});
