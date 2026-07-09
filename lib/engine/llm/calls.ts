/**
 * LLM 콜①~④ — 페이로드 빌더 + 응답 검증 (08 §4.1~4.4 계약 구현).
 * 판정만 LLM이 하고, 문장 분해·항목 선별·집계는 규칙 코드가 한다(결정성 계약).
 */

import type {
  AuditResult,
  BenchmarkData,
  Category,
  NormalizedContent,
  PersonaResult,
  PreSignals,
  RewriteResult,
  ScoredItem,
  TierInput,
} from '../types';
import { applicableItems } from '../rubric';
import { buildStableGrounding, validClauseIds } from '../grounding';
import { CALL1_OUTPUT_SCHEMA, CALL2_OUTPUT_SCHEMA, CALL3_OUTPUT_SCHEMA, CALL4_OUTPUT_SCHEMA } from '../schemas';
import { runStructuredCall, type LlmCallLogEntry } from './client';
import { mockCall1, mockCall2, mockCall3, mockCall4 } from './fixtures';

export type LogSink = (entry: LlmCallLogEntry) => Promise<void> | void;

/** 콜① 루브릭 채점 */
export async function runCall1(
  input: TierInput,
  content: NormalizedContent,
  signals: PreSignals,
  onLog?: LogSink,
): Promise<{ items: ScoredItem[] }> {
  const items = applicableItems(input.category);
  const requestedIds = items.map((i) => i.id);

  const payload = [
    `[진단 대상 콘텐츠 — 정규화 평문]`,
    content.plainText,
    `[사전 신호(정규식 관찰)] ${signals.notes.join(' / ')}`,
    `[메타] category=${input.category} · productClass=${input.productClass}` +
      (input.keyIngredients?.length ? ` · 핵심 성분(고객 제공): ${input.keyIngredients.join(', ')}` : ''),
    `[요청] 위 루브릭의 ${requestedIds.join(', ')} 각각에 대해 정확히 1개씩 판정하라(누락·추가 금지).`,
  ].join('\n\n');

  return runStructuredCall<{ items: ScoredItem[] }>({
    callName: 'call1',
    system: buildStableGrounding('call1', input.category, input.productClass),
    userPayload: payload,
    schema: CALL1_OUTPUT_SCHEMA,
    maxTokens: 8000,
    mockData: mockCall1(items, signals, content.sentences),
    onLog,
    validate: (data) => {
      const got = new Set(data.items.map((i) => i.itemId));
      const missing = requestedIds.filter((id) => !got.has(id));
      const extra = data.items.filter((i) => !requestedIds.includes(i.itemId)).map((i) => i.itemId);
      if (missing.length || extra.length) {
        return `요청 항목과 1:1이 아님 — 누락: [${missing.join(',')}], 초과: [${extra.join(',')}]. 정확히 요청 항목만 다시 판정하라.`;
      }
      return null;
    },
  });
}

/** 콜② 약기법 전수 감사 — summary 수치는 코드가 재계산해 덮어쓴다(결정성) */
export async function runCall2(
  input: TierInput,
  content: NormalizedContent,
  onLog?: LogSink,
): Promise<AuditResult> {
  const sentenceLines = content.sentences.map((s) => `${s.id}: ${s.text}`).join('\n');
  const payload = [
    `[감사 대상 문장 — ID는 유지할 것]`,
    sentenceLines,
    `[요청] 모든 문장(${content.sentences.map((s) => s.id).join(', ')})에 대해 하나씩 판정하라. clauseRefs는 제공된 조항 id만.`,
  ].join('\n\n');

  const raw = await runStructuredCall<AuditResult>({
    callName: 'call2',
    system: buildStableGrounding('call2', input.category, input.productClass),
    userPayload: payload,
    schema: CALL2_OUTPUT_SCHEMA,
    maxTokens: 8000,
    mockData: mockCall2(content.sentences),
    onLog,
    validate: (data) => {
      const requested = content.sentences.map((s) => s.id);
      const got = new Set(data.sentences.map((s) => s.sentenceId));
      const missing = requested.filter((id) => !got.has(id));
      if (missing.length) return `문장 누락: [${missing.join(',')}] — 모든 문장을 판정하라.`;
      const valid = validClauseIds();
      const badRefs = data.sentences.flatMap((s) => s.clauseRefs.filter((r) => !valid.has(r)));
      if (badRefs.length) return `유효하지 않은 조항 id: [${[...new Set(badRefs)].join(',')}] — 제공된 조항 id만 사용하라.`;
      return null;
    },
  });

  // summary는 코드가 재계산(결정성 — 08 §4.2)
  const ngCount = raw.sentences.filter((s) => s.verdict === '불가').length;
  const conditionalCount = raw.sentences.filter((s) => s.verdict === '조건부').length;
  const okCount = raw.sentences.length - ngCount - conditionalCount;
  const highestRiskId =
    raw.sentences.find((s) => s.verdict === '불가')?.sentenceId ??
    raw.sentences.find((s) => s.verdict === '조건부')?.sentenceId ??
    raw.summary.highestRiskId;
  return { sentences: raw.sentences, summary: { ngCount, conditionalCount, okCount, highestRiskId } };
}

/** 콜③ 페르소나·USP·리뷰 서사 */
export async function runCall3(
  input: TierInput,
  content: NormalizedContent,
  onLog?: LogSink,
): Promise<PersonaResult> {
  const summaryText = content.plainText.slice(0, 1500);
  const payload = [
    `[콘텐츠 요약(앞부분)]`,
    summaryText,
    `[메타] category=${input.category}` +
      (input.priceJpy ? ` · 예상 판매가 ${input.priceJpy}엔` : ' · 가격 미제공(가격 감도 추론 제외)') +
      (input.targetMemo ? ` · 타깃 메모: ${input.targetMemo}` : '') +
      (input.brandName ? ` · 브랜드: ${input.brandName}` : ''),
    `[요청] 페르소나 1인 · 구매여정 3단계 · 구매 반대 이유 2~3개 · USP 재정의 표 3~5행 · 리뷰 인과 서사 2~3행(카테고리 일반형 — 특정 리뷰 창작 금지).`,
  ].join('\n\n');

  return runStructuredCall<PersonaResult>({
    callName: 'call3',
    system: buildStableGrounding('call3', input.category, input.productClass),
    userPayload: payload,
    schema: CALL3_OUTPUT_SCHEMA,
    maxTokens: 6000,
    mockData: mockCall3(input.category),
    onLog,
    validate: (data) => {
      if (data.uspTable.length < 3) return 'USP 표는 3행 이상이어야 한다.';
      if (data.objections.length < 2) return '구매 반대 이유는 2개 이상이어야 한다.';
      return null;
    },
  });
}

/** 콜④ 총평 + NG/OK 재작성 + 샘플 + 벤치마크 문장화 */
export async function runCall4(
  input: TierInput,
  content: NormalizedContent,
  lowItems: { itemId: string; title: string; score: number }[],
  audit: AuditResult,
  persona: PersonaResult,
  benchmark: BenchmarkData,
  onLog?: LogSink,
): Promise<RewriteResult> {
  const textById = new Map(content.sentences.map((s) => [s.id, s.text]));
  const problemSentences = audit.sentences
    .filter((s) => s.verdict !== '가능')
    .map((s) => `${s.sentenceId}(${s.verdict}): ${textById.get(s.sentenceId) ?? ''} — ${s.reason}`)
    .join('\n');
  const uspRows = persona.uspTable.map((row, i) => `${i}: ${row.krAppeal} → ${row.redefinedUsp}`).join('\n');
  const benchRows = benchmark.comparisonRows
    .map((r) => `${r.device}: 코퍼스=${r.corpusExample} / 고객=${r.customerStatus}`)
    .join('\n');

  const payload = [
    `[저점 루브릭 항목(집계 결과)] ${lowItems.map((i) => `${i.itemId} ${i.title}(${i.score}점)`).join(' · ')}`,
    `[약기법 불가/조건부 문장]`,
    problemSentences || '(없음)',
    `[USP 재정의 표 — rewrites의 uspRowIndex로 참조]`,
    uspRows,
    `[벤치마크 대비(규칙 산출) — benchmarkNarrative의 근거]`,
    benchRows,
    `[원문 전체]`,
    content.plainText,
    `[요청] NG/OK 재작성 3~5쌍(각 쌍에 afterKr 한국어 역문 필수) + 총평 3~4줄 + 가장 저점인 섹션의 비포&애프터 샘플 1종 + 벤치마크 요지 문장화. 콘텐츠가 빈약해 데모로 대체하면 sample.isDemo=true.`,
  ].join('\n\n');

  return runStructuredCall<RewriteResult>({
    callName: 'call4',
    system: buildStableGrounding('call4', input.category, input.productClass),
    userPayload: payload,
    schema: CALL4_OUTPUT_SCHEMA,
    maxTokens: 12000,
    mockData: mockCall4(audit, content.sentences),
    onLog,
    validate: (data) => {
      if (data.rewrites.length < 3) return '재작성은 3쌍 이상이어야 한다(AC-3.1).';
      const noKr = data.rewrites.filter((r) => !r.afterKr.trim());
      if (noKr.length) return '모든 After에 한국어 역문(afterKr)이 필요하다(AC-3.2).';
      return null;
    },
  });
}
