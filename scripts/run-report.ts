/**
 * 엔진 CLI 러너 — 화면 없이 파이프라인을 실행해 blocksJson을 확인한다(09 §3).
 * 기본 입력: cica 샘플 카피 K1~K11 (docs/specs/01-report-sample-cica-ampoule.md — 골든 픽스처).
 *
 * 사용:
 *   npm run report:cli                # .env에 키 없으면 목 모드
 *   LLM_MODE=mock npm run report:cli  # 강제 목 모드
 *   npm run report:cli -- --out out.json
 */

import { writeFile } from 'node:fs/promises';
import { runReportPipeline } from '../lib/engine/pipeline';
import type { TierInput } from '../lib/engine/types';
import { currentLlmMode } from '../lib/engine/llm/client';
import { logger } from '../lib/logger';

/** cica 샘플 원문 K1~K11 (골든 픽스처 — 스펙 샘플과 점수 방향 대조용) */
const CICA_COPY = [
  '예민해진 피부, 병원 안 가도 되는 진정의 답.',
  '피부 속 깊은 곳까지 파고드는 시카(CICA) 앰플.',
  '트러블 싹, 붉은기 싹 — 바르는 순간 즉각 진정.',
  '손상된 피부 장벽을 재생시켜 근본부터 치료합니다.',
  '72시간 지속되는 강력한 진정력.',
  '출시 3개월 만에 10만 병 완판, 다들 리뷰가 미쳤다고 난리 났어요.',
  '센텔라(병풀) 성분 99% 고농축.',
  '민감성·트러블 피부를 위한 병원 처방급 케어.',
  '피부과 시술 후에도 안심하고 쓰는 재생 앰플.',
  '바르고 자면 아침에 트러블이 사라집니다.',
  '지금 구매하고 피부 고민 끝내세요.',
].join('\n');

const FIXTURE_INPUT: TierInput = {
  category: 'skincare',
  productClass: '화장품',
  sourceType: 'text',
  sourceText: CICA_COPY,
  brandName: 'HARUON',
  productName: 'CICA 진정 앰플',
  keyIngredients: ['센텔라아시아티카(CICA)'],
  priceJpy: 2800,
  targetMemo: '민감성 피부, 20~30대',
};

async function main(): Promise<void> {
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : null;

  logger.info('리포트 파이프라인 시작', { mode: currentLlmMode(), category: FIXTURE_INPUT.category });
  const startedAt = Date.now();

  const result = await runReportPipeline(FIXTURE_INPUT, {
    onStage: (stage) => logger.info('단계', { stage }),
    onLog: (entry) =>
      logger.info('LLM 로그', {
        call: entry.callName,
        mode: entry.mode,
        status: entry.status,
        durationMs: entry.durationMs,
      }),
  });

  const b = result.blocksJson;
  logger.info('파이프라인 완료', {
    durationMs: Date.now() - startedAt,
    overallScore: result.overallScore,
    groupScores: result.groupScores,
    top3: result.top3.map((t) => `${t.itemId}(${t.score})`),
    auditSummary: b.block3.summary,
    rewriteCount: b.block7.rewrites.length,
    blocks: Object.keys(b).filter((k) => k.startsWith('block')).length,
  });

  if (outPath) {
    await writeFile(outPath, JSON.stringify(b, null, 2), 'utf8');
    logger.info('blocksJson 저장', { outPath });
  } else {
    // 요약만 출력(전체는 --out으로)
    process.stdout.write('\n[블록1 총평]\n' + b.block1.summaryText + '\n');
    process.stdout.write('\n[블록3 감사 요약] ' + JSON.stringify(b.block3.summary) + '\n');
    process.stdout.write(
      '\n[블록7 재작성 1건 예시]\n' + JSON.stringify(b.block7.rewrites[0] ?? null, null, 2) + '\n',
    );
  }
}

main().catch((err) => {
  logger.error('CLI 실패', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
