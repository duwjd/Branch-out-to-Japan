/**
 * 리포트 비동기 잡 — 상태 머신(08 §3.3)을 따라 파이프라인을 실행하고 저장한다.
 * MVP 실행 모델: Route Handler에서 after()로 킥오프(08 §6.2 — 지연 길어지면 큐 도입).
 */

import { runReportPipeline, AuditFailedError, PersonaFailedError } from '../engine/pipeline';
import { SourceContentError } from '../engine/rules/normalize';
import { getStore } from '../db/store';
import { logger } from '../logger';
import type { TierInput } from '../engine/types';

/** 요청 생성(submitted) — 폼 POST가 호출 */
export async function createDiagnosisRequest(input: TierInput) {
  const store = await getStore();
  return store.createRequest(input);
}

/** 파이프라인 실행(processing → published | failed) — 응답 후 백그라운드로 실행 */
export async function runDiagnosisJob(requestId: string): Promise<void> {
  const store = await getStore();
  const request = await store.getRequest(requestId);
  if (!request) {
    logger.error('잡 시작 실패 — 요청 없음', { requestId });
    return;
  }

  await store.updateRequest(requestId, { status: 'processing', stage: 'normalize', error: null });

  try {
    const result = await runReportPipeline(request.tierInput, {
      onStage: (stage) => store.updateRequest(requestId, { stage }),
      onLog: (entry) => store.saveLlmLog(requestId, entry),
    });

    const now = new Date().toISOString();
    await store.saveReport({
      requestId,
      blocksJson: result.blocksJson,
      overallScore: result.overallScore,
      groupScores: result.groupScores,
      top3: result.top3,
      publishedAt: now,
      createdAt: now,
    });
    await store.updateRequest(requestId, {
      status: 'published',
      stage: null,
      precisionLimited: result.precisionLimited,
    });
    logger.info('잡 완료 — 발행', { requestId, mode: result.blocksJson.meta.mode, overallScore: result.overallScore });
  } catch (err) {
    // 치명 실패 3종(콜② 없는 풀 발행 금지 · 브랜드 진단 콜③ 실패 · 입력 오류) — 사유를 남기고 failed
    const reason =
      err instanceof AuditFailedError || err instanceof PersonaFailedError || err instanceof SourceContentError
        ? err.message
        : `파이프라인 오류: ${String((err as Error)?.message ?? err)}`;
    logger.error('잡 실패', { requestId, reason });
    await store.updateRequest(requestId, { status: 'failed', stage: null, error: reason });
  }
}
