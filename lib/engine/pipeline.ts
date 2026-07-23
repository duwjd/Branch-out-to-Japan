/**
 * ① 진단 리포트 파이프라인 — 08 §3.2 계약의 구현.
 * 순서: 정규화 → 사전신호 → [콜①·②·③ 병렬] → 집계(결정적) → 벤치마크(규칙) → 콜④ → 9블록 조립.
 * 폴백(08 §3.2): 콜① 실패=블록5 축소(0점) · 콜③ 실패=카테고리 일반형 · 콜④ 실패=블록7·8 축소 · 콜② 실패만 잡 실패.
 */

import type { BlocksJson, BrandOnlyInput, BrandProductInput, RewriteResult, RubricGroup, RubricItemId, TierInput } from './types';
import { normalizeContent } from './rules/normalize';
import { extractPreSignals } from './rules/presignals';
import { aggregateScores } from './rules/aggregate';
import { buildBenchmark } from './rules/benchmark';
import { assembleBlocks, assembleBrandBlocks } from './rules/assemble';
import { runCall1, runCall2, runCall3, runCall4, type LogSink } from './llm/calls';
import { runCall0 } from './llm/call0';
import { mockCall3 } from './llm/fixtures';
import { logger } from '../logger';

export class AuditFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditFailedError';
  }
}

/** 브랜드 진단에서 콜③ 실패는 치명 — 유일한 LLM 산출이라, 일반형 템플릿을 진단으로 위장해 발행하지 않는다 */
export class PersonaFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonaFailedError';
  }
}

export interface PipelineResult {
  blocksJson: BlocksJson;
  /** null = 브랜드 진단(점수 없음 — 대체 수치를 만들지 않는다, 스펙 §3.3) */
  overallScore: number | null;
  /** 브랜드 진단은 {} — 0점 기록이 아니라 "채점 안 함" */
  groupScores: Partial<Record<RubricGroup, number>>;
  top3: { itemId: RubricItemId; title: string; score: number }[];
  precisionLimited: boolean;
}

export interface PipelineDeps {
  onStage?: (stage: string) => Promise<void> | void;
  onLog?: LogSink;
}

/** 진단 입력을 받아 blocksJson까지 산출한다(저장·상태 전이는 호출자 책임). 모드 분기 = 스펙 §3.3 */
export async function runReportPipeline(tierInput: TierInput, deps: PipelineDeps = {}): Promise<PipelineResult> {
  if (tierInput.mode === 'brand') return runBrandPipeline(tierInput, deps);
  return runFullPipeline(tierInput, deps);
}

/**
 * 브랜드 진단 — 콜③ 1콜 + 벤치마크(코퍼스 측) + 조립. normalize·콜①②④·집계는 돌지 않는다(스펙 §3.3).
 * 풀 파이프라인의 콜③ 폴백(카테고리 일반형)을 여기서는 쓰지 않는다 — 유일한 LLM 블록이라 실패 = 잡 실패.
 */
async function runBrandPipeline(tierInput: BrandOnlyInput, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const { onStage, onLog } = deps;

  await onStage?.('persona');
  let persona;
  try {
    persona = await runCall3(tierInput, null, onLog);
  } catch (err) {
    throw new PersonaFailedError(
      `페르소나·USP 진단(콜③) 실패 — 브랜드 진단의 핵심 산출이라 발행할 수 없습니다: ${String((err as Error)?.message ?? err)}`,
    );
  }

  await onStage?.('benchmark');
  const benchmark = buildBenchmark(tierInput.category, null); // signals=null → "내 콘텐츠" 칸 전부 '미확인'

  await onStage?.('assemble');
  const blocksJson = assembleBrandBlocks({ tierInput, persona, benchmark });

  return {
    blocksJson,
    overallScore: null, // 점수 없음 — 대체 수치를 만들지 않는다(증거 원칙)
    groupScores: {},
    top3: [],
    precisionLimited: false,
  };
}

/** 브랜드+제품 진단 — 기존 5단계·LLM 4콜 파이프라인 */
async function runFullPipeline(tierInput: BrandProductInput, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const { onStage, onLog } = deps;

  // 이미지 모드 — 콜⓪ 비전 추출 후 그 텍스트를 정규화에 넘긴다(v7). 추출 실패는 SourceContentError로 잡 실패
  let extractedText: string | undefined;
  if (tierInput.sourceType === 'image') {
    await onStage?.('extract');
    const extraction = await runCall0(tierInput.sourceImages ?? [], tierInput.productClass, onLog);
    extractedText = extraction.plainText;
    logger.info('이미지 추출 완료', { images: tierInput.sourceImages?.length ?? 0, chars: extractedText.length });
  }

  await onStage?.('normalize');
  const content = await normalizeContent(tierInput, extractedText);
  logger.info('정규화 완료', { sentences: content.sentences.length, chars: content.charCount });

  await onStage?.('presignals');
  const signals = extractPreSignals(content);

  await onStage?.('llmCalls');
  // 콜①·②·③은 상호 독립 → 병렬(08 §4.7). 콜② 실패만 치명(감사 없는 발행 금지).
  const [call1Result, call2Result, call3Result] = await Promise.allSettled([
    runCall1(tierInput, content, signals, onLog),
    runCall2(tierInput, content, onLog),
    runCall3(tierInput, content, onLog),
  ]);

  if (call2Result.status === 'rejected') {
    throw new AuditFailedError(`약기법 감사(콜②) 실패 — 감사 없는 리포트는 발행할 수 없습니다: ${String(call2Result.reason)}`);
  }
  const audit = call2Result.value;

  // 콜① 실패 폴백: 전 항목 0점 + 정밀도 제한(블록5 축소) — 리포트는 계속
  const scored =
    call1Result.status === 'fulfilled'
      ? call1Result.value.items
      : [];
  if (call1Result.status === 'rejected') {
    logger.warn('콜① 실패 — 블록5 축소(0점 폴백)', { reason: String(call1Result.reason) });
  }

  // 콜③ 실패 폴백: 카테고리 일반형 템플릿(목 픽스처)
  const persona = call3Result.status === 'fulfilled' ? call3Result.value : mockCall3(tierInput.category);
  if (call3Result.status === 'rejected') {
    logger.warn('콜③ 실패 — 카테고리 일반형 폴백', { reason: String(call3Result.reason) });
  }

  await onStage?.('aggregate');
  const aggregate = aggregateScores(tierInput.category, scored);

  await onStage?.('benchmark');
  const benchmark = buildBenchmark(tierInput.category, signals);

  await onStage?.('call4');
  // 콜④ 실패 폴백: 블록1 총평·블록7·8 축소 렌더(가짜 내용으로 채우지 않는다 — 증거 원칙, 08 §3.2)
  let rewrite: RewriteResult;
  try {
    rewrite = await runCall4(tierInput, content, aggregate.top3, audit, persona, benchmark, onLog);
  } catch (err) {
    logger.warn('콜④ 실패 — 블록7·8 축소 폴백', { reason: String((err as Error)?.message ?? err) });
    rewrite = {
      headline: { summary: '총평·재작성 생성에 실패했습니다. 저점 항목(블록 5)과 약기법 감사(블록 3)를 우선 확인하세요 — 재실행 시 이 블록이 채워집니다.' },
      rewrites: [],
      sample: { targetSection: '', afterJaBlock: '', afterKrBlock: '', isDemo: false },
      benchmarkNarrative: '',
    };
  }

  await onStage?.('assemble');
  const blocksJson = assembleBlocks({
    tierInput,
    content,
    scored,
    aggregate,
    audit,
    persona,
    benchmark,
    rewrite,
  });

  return {
    blocksJson,
    overallScore: aggregate.overallScore,
    groupScores: aggregate.groupScores,
    top3: aggregate.top3,
    precisionLimited: content.precisionLimited,
  };
}
