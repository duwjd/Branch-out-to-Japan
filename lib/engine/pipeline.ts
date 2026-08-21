/**
 * ① 진단 리포트 파이프라인 — 08 §3.2 계약의 구현.
 * 순서: 정규화 → 사전신호 → [콜①·②·③ 병렬] → 집계(결정적) → 벤치마크(규칙) → 콜④ → 9블록 조립 → 윤문.
 * 폴백(08 §3.2): 콜① 실패=블록5 축소(0점) · 콜③ 실패=카테고리 일반형 · 콜④ 실패=블록7·8 축소 · 콜② 실패만 잡 실패.
 *
 * 마지막 윤문(콜⑩)은 **조립 뒤**에 돈다 — 콜③·④가 쓴 한국어 서술이 한자리에 모인 시점이라
 * 한 콜로 리포트 전체를 훑을 수 있다. 실패해도 잡을 죽이지 않는다(원문 유지).
 *
 * ## 시간 예산(`deps.deadlineAt`)
 *
 * 이 파이프라인은 Vercel 함수 상한 300초 안에서 돈다. 위의 폴백들은 **콜이 실패로 끝나야** 발동하는데,
 * SDK 기본 타임아웃(10분)이 함수 상한보다 길어 실제로는 폴백에 닿기 전에 함수가 통째로 죽었다
 * (docs/research/ut-agent/results/P0-리포트-파이프라인-예산초과.md — 리포트가 발행되지 않은 원인).
 * 그래서 각 LLM 단계에 남은 시간 기반 상한을 걸어 **폴백에 도달할 길을 연다.**
 * 상한 규칙은 `lib/engine/reportBudget.ts` 가 단독 소유한다 — 여기서 숫자를 다시 쓰지 않는다.
 * `deadlineAt` 이 없으면(CLI·테스트) 상한 없이 현행대로 돈다.
 */

import type { BlocksJson, BrandOnlyInput, BrandProductInput, RewriteResult, RubricGroup, RubricItemId, TierInput } from './types';
import { normalizeContent } from './rules/normalize';
import { extractPreSignals } from './rules/presignals';
import { aggregateScores } from './rules/aggregate';
import { buildBenchmark } from './rules/benchmark';
import { assembleBlocks, assembleBrandBlocks } from './rules/assemble';
import { checkEvidence, type EvidenceIssue } from './rules/evidenceGate';
import { runCall1, runCall2, runCall3, runCall4, type LogSink } from './llm/calls';
import { runReportHumanize, type KoHumanizeResult, type KoHumanizeVerdict } from '../report/humanizeReport';
import { callTimeout, canHumanize, type ReportBudgetStage } from './reportBudget';
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
  /** 콜⑩ 윤문 판정 — 채택·반려 내역. 콜이 안 돌았으면 빈 배열 */
  humanizeVerdicts: KoHumanizeVerdict[];
  /** 윤문이 아예 돌지 않은 사유(목 모드·콜 실패). 정상이면 null */
  humanizeSkipped: string | null;
  /**
   * 증거 원칙 위반 후보 — **비차단 경고**다. 발행을 막지 않는다.
   * 정규식은 맥락을 모르므로 오탐이 나오고, 오탐으로 발행을 막으면 아무도 게이트를 켜두지 않는다.
   * 잡을 죽이는 판단은 사람이 이 목록을 보고 한다(AC-2.5 수동 QA의 입력).
   */
  evidenceIssues: EvidenceIssue[];
}

/** 윤문까지 끝난 blocksJson 에 증거 원칙 검사를 걸고 경고를 남긴다 */
function auditEvidence(blocksJson: BlocksJson): EvidenceIssue[] {
  const issues = checkEvidence(blocksJson);
  for (const i of issues) logger.warn('증거 원칙 위반 후보', { path: i.path, match: i.match, kind: i.kind });
  return issues;
}

export interface PipelineDeps {
  onStage?: (stage: string) => Promise<void> | void;
  onLog?: LogSink;
  /**
   * 잡 마감 시각(`Date.now()` 기준 ms). 잡 계층이 `REPORT_BUDGET_MS` 로 만들어 넘긴다.
   * 생략하면 시간 상한을 걸지 않는다 — CLI·테스트처럼 함수 상한이 없는 실행 환경용이다.
   */
  deadlineAt?: number;
}

/** 이 단계의 콜에 줄 상한. `deadlineAt` 이 없으면 undefined(상한 없음) */
function stageTimeout(stage: ReportBudgetStage, deadlineAt: number | undefined): number | undefined {
  return deadlineAt === undefined ? undefined : callTimeout(stage, deadlineAt - Date.now());
}

/**
 * 윤문(콜⑩)을 예산 안에서 돌린다.
 *
 * 남은 시간이 한 번의 콜조차 성립하지 않으면 **콜을 걸지 않고** 원문을 그대로 쓴다. 걸어 두면
 * 타임아웃까지 기다리다 저장 몫까지 먹어 리포트가 통째로 날아간다 — 문체를 지키려다 리포트를
 * 잃는 거래다. `skippedReason` 은 이미 1급 개념이라(`reports.humanize_skipped`) 새 상태를
 * 만들지 않고 그 자리에 사유를 남긴다.
 */
async function humanizeWithinBudget(
  blocksJson: BlocksJson,
  deadlineAt: number | undefined,
  onLog?: LogSink,
): Promise<KoHumanizeResult> {
  if (deadlineAt === undefined) return runReportHumanize({ blocksJson, onLog });

  const left = deadlineAt - Date.now();
  if (!canHumanize(left)) {
    const seconds = Math.max(0, Math.round(left / 1000));
    logger.warn('윤문 건너뜀 — 예산 부족', { leftMs: left });
    return {
      blocksJson,
      verdicts: [],
      skippedReason: `남은 생성 시간이 부족해 문체 다듬기를 건너뛰고 원문을 그대로 씁니다(잔여 ${seconds}초).`,
    };
  }
  return runReportHumanize({ blocksJson, onLog, timeoutMs: callTimeout('humanize', left) });
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
  const { onStage, onLog, deadlineAt } = deps;

  await onStage?.('persona');
  let persona;
  try {
    persona = await runCall3(tierInput, null, onLog, stageTimeout('persona', deadlineAt));
  } catch (err) {
    throw new PersonaFailedError(
      `페르소나·USP 진단(콜③) 실패 — 브랜드 진단의 핵심 산출이라 발행할 수 없습니다: ${String((err as Error)?.message ?? err)}`,
    );
  }

  await onStage?.('benchmark');
  const benchmark = buildBenchmark(tierInput.category, null); // signals=null → "내 콘텐츠" 칸 전부 '미확인'

  await onStage?.('assemble');
  const assembled = assembleBrandBlocks({ tierInput, persona, benchmark });

  await onStage?.('humanize');
  const humanized = await humanizeWithinBudget(assembled, deadlineAt, onLog);

  return {
    blocksJson: humanized.blocksJson,
    overallScore: null, // 점수 없음 — 대체 수치를 만들지 않는다(증거 원칙)
    groupScores: {},
    top3: [],
    precisionLimited: false,
    humanizeVerdicts: humanized.verdicts,
    humanizeSkipped: humanized.skippedReason,
    evidenceIssues: auditEvidence(humanized.blocksJson),
  };
}

/** 브랜드+제품 진단 — 기존 5단계·LLM 4콜 파이프라인 */
async function runFullPipeline(tierInput: BrandProductInput, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const { onStage, onLog, deadlineAt } = deps;

  // 이미지 모드 — 콜⓪ 비전 추출 후 그 텍스트를 정규화에 넘긴다(v7). 추출 실패는 SourceContentError로 잡 실패
  let extractedText: string | undefined;
  if (tierInput.sourceType === 'image') {
    await onStage?.('extract');
    const extraction = await runCall0(
      tierInput.sourceImages ?? [],
      tierInput.productClass,
      onLog,
      stageTimeout('extract', deadlineAt),
    );
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
  // 셋이 동시에 도니까 같은 상한을 준다 — 병렬 구간 전체가 이 시간 안에 끝난다는 뜻이다
  const callsTimeout = stageTimeout('llmCalls', deadlineAt);
  const [call1Result, call2Result, call3Result] = await Promise.allSettled([
    runCall1(tierInput, content, signals, onLog, callsTimeout),
    runCall2(tierInput, content, onLog, callsTimeout),
    runCall3(tierInput, content, onLog, callsTimeout),
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
    rewrite = await runCall4(
      tierInput,
      content,
      aggregate.top3,
      audit,
      persona,
      benchmark,
      onLog,
      stageTimeout('call4', deadlineAt),
    );
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
  const assembled = assembleBlocks({
    tierInput,
    content,
    scored,
    aggregate,
    audit,
    persona,
    benchmark,
    rewrite,
  });

  await onStage?.('humanize');
  const humanized = await humanizeWithinBudget(assembled, deadlineAt, onLog);

  return {
    blocksJson: humanized.blocksJson,
    overallScore: aggregate.overallScore,
    groupScores: aggregate.groupScores,
    top3: aggregate.top3,
    precisionLimited: content.precisionLimited,
    humanizeVerdicts: humanized.verdicts,
    humanizeSkipped: humanized.skippedReason,
    evidenceIssues: auditEvidence(humanized.blocksJson),
  };
}
