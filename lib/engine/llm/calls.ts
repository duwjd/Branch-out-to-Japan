/**
 * LLM 콜①~⑤ — 페이로드 빌더 + 응답 검증 (08 §4.1~4.5 계약 구현).
 * 판정만 LLM이 하고, 문장 분해·항목 선별·집계는 규칙 코드가 한다(결정성 계약).
 * 콜⑤는 파이프라인 밖 — 발행된 리포트에서 온디맨드로 호출된다(스펙 §10).
 */

import type {
  AuditResult,
  BenchmarkData,
  BlocksJson,
  BrandProductInput,
  Category,
  DeckSpec,
  NormalizedContent,
  PersonaResult,
  PreSignals,
  RewriteResult,
  ScoredItem,
  TierInput,
} from '../types';
import { slideKeysFor } from '../types';
import { applicableItems } from '../rubric';
import { buildStableGrounding, validClauseIds } from '../grounding';
import {
  CALL1_OUTPUT_SCHEMA,
  CALL2_OUTPUT_SCHEMA,
  CALL3_OUTPUT_SCHEMA,
  CALL4_OUTPUT_SCHEMA,
  CALL5_OUTPUT_SCHEMA_BRAND,
  CALL5_OUTPUT_SCHEMA_FULL,
} from '../schemas';
import { positioningTagLabels } from '../rules/positioning';
import { runStructuredCall, type LlmCallLogEntry } from './client';
import { mockCall1, mockCall2, mockCall3, mockCall4, mockCall5 } from './fixtures';

export type LogSink = (entry: LlmCallLogEntry) => Promise<void> | void;

/** 콜① 루브릭 채점 — 고객 문장 위에서만 돈다(브랜드+제품 진단 전용) */
export async function runCall1(
  input: BrandProductInput,
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

/** 콜② 약기법 전수 감사 — summary 수치는 코드가 재계산해 덮어쓴다(결정성). 브랜드+제품 진단 전용 */
export async function runCall2(
  input: BrandProductInput,
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

/**
 * 콜③ 페르소나·USP·리뷰 서사 — 두 진단 모드 공통(스펙 §3.3).
 * content=null 이면 브랜드 진단: 브랜드 메타(포지셔닝 포함)와 카테고리 코퍼스 근거만으로 진단한다.
 */
export async function runCall3(
  input: TierInput,
  content: NormalizedContent | null,
  onLog?: LogSink,
): Promise<PersonaResult> {
  const positioningLine =
    ` · 포지셔닝: ${positioningTagLabels(input.positioning.tags).join(', ')}` +
    (input.positioning.note.trim() ? ` — "${input.positioning.note.trim()}"` : '');
  const payload = [
    ...(content
      ? [`[콘텐츠 요약(앞부분)]`, content.plainText.slice(0, 1500)]
      : [
          `[콘텐츠 없음 — 브랜드 진단] 상세페이지 카피가 제출되지 않았다. 아래 브랜드 메타와 카테고리 코퍼스 근거만으로 진단하라. 고객 문장 인용을 지어내지 마라.`,
        ]),
    `[메타] category=${input.category} · 브랜드: ${input.brandName}` +
      positioningLine +
      (input.priceJpy ? ` · 예상 판매가 ${input.priceJpy}엔` : ' · 가격 미제공(가격 감도 추론 제외)') +
      (input.targetMemo ? ` · 타깃 메모: ${input.targetMemo}` : ''),
    `[요청] 페르소나 1인 · 구매여정 3단계 · 구매 반대 이유 2~3개 · USP 재정의 표 3~5행 · 리뷰 인과 서사 2~3행(카테고리 일반형 — 특정 리뷰 창작 금지).`,
  ].join('\n\n');

  return runStructuredCall<PersonaResult>({
    callName: 'call3',
    // call3 프리픽스는 productClass를 쓰지 않는다 — 브랜드 진단은 '미상'을 넘겨도 캐시가 갈리지 않는다
    system: buildStableGrounding('call3', input.category, input.mode === 'brandProduct' ? input.productClass : '미상'),
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

/** 콜④ 총평 + NG/OK 재작성 + 샘플 + 벤치마크 문장화 — 브랜드+제품 진단 전용 */
export async function runCall4(
  input: BrandProductInput,
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

/**
 * 콜⑤ — 보고용 슬라이드 카피 (스펙 §10.5 · 08 §4.5). 파이프라인 밖에서 온디맨드 호출.
 * 페이로드의 수치는 카피 논조를 잡기 위한 참고일 뿐 — 렌더러가 blocksJson에서 다시 인용하므로
 * LLM이 옮겨 적어도 출력에 반영되지 않는다(스펙 §10.3 · AC-10.3).
 */
export function runCall5(
  blocks: BlocksJson,
  input: TierInput,
  onLog?: (entry: LlmCallLogEntry) => Promise<void> | void,
): Promise<DeckSpec> {
  const mode = blocks.meta.mode;
  const keys = slideKeysFor(mode);
  const head = `[브랜드·제품] ${blocks.block0.brandName} · ${blocks.block0.productName} (${blocks.block0.categoryLabel} · ${blocks.block0.productClassLabel})`;
  const funnelLine = `[다음 단계] ${blocks.block9.funnel.map((f) => `${f.step} ${f.price}`).join(' → ')}`;
  const guardrailLine =
    `수치는 절대 쓰지 마라 — 위 숫자는 논조 참고용이며 코드가 원본에서 다시 넣는다. ` +
    `타깃 정보(${input.targetMemo || '미기재'})가 있으면 결재자가 납득할 맥락으로만 활용하라.`;

  let payload: string;
  if (mode === 'brand') {
    // 브랜드 진단 덱(4장) — 점수·감사 블록은 존재하지 않는다. 없는 결과를 페이로드에 올리지 않는다
    const usp = blocks.block2.uspTable
      .map((r) => `${r.krAppeal} → 일본 독해: ${r.jpReading} → 재정의: ${r.redefinedUsp}`)
      .join('\n');
    const corpus = blocks.block4.comparisonRows.map((r) => `${r.device}: ${r.corpusExample}`).join('\n');
    payload = [
      head,
      `[진단 요약 — 카피 논조의 근거]`,
      blocks.block1.summaryText,
      `[포지셔닝·USP 재정의 표]`,
      usp,
      `[일본 상위 제품의 신뢰 장치(코퍼스 실측) — 고객 콘텐츠 대비 아님]`,
      corpus,
      funnelLine,
      `[요청] 위 브랜드 진단 결과를 상사 품의용 슬라이드 4장의 한국어 카피로 옮겨라. 각 장에 heading·lead·bullets(2~3개). ` +
        `제품 콘텐츠가 제출되지 않아 점수·약기법 감사·재작성은 존재하지 않는다 — 언급·암시 금지. ` +
        guardrailLine,
    ].join('\n\n');
  } else {
    // 풀 모드 — 조립 계약상 항상 존재하지만, 타입 유니온을 방어적으로 좁힌다
    if (!blocks.block1.scored || !blocks.block3 || !blocks.block7) {
      return Promise.reject(new Error('브랜드+제품 리포트의 blocksJson이 불완전합니다(점수·감사 블록 누락).'));
    }
    const top3 = blocks.block1.top3.map((t) => `${t.itemId} ${t.title}(${t.score}점)`).join(' · ');
    const gaps = blocks.block4.comparisonRows
      .filter((r) => r.customerStatus !== '관찰됨')
      .map((r) => `${r.device}: ${r.gapNote}`)
      .join('\n') || '(관찰된 갭 없음)';
    const firstRewrite = blocks.block7.rewrites[0];
    const rewriteLine = firstRewrite
      ? `Before "${firstRewrite.beforeKr}" → After(JP) "${firstRewrite.afterJa}" / 역해설 "${firstRewrite.afterKr}" (문제: ${firstRewrite.problem})`
      : '(재작성 없음)';
    payload = [
      head,
      `[진단 총평 — 카피 논조의 근거]`,
      blocks.block1.summaryText,
      `[최우선 재설계 Top3] ${top3}`,
      `[약기법 감사 요약] 불가 ${blocks.block3.summary.ngCount} · 조건부 ${blocks.block3.summary.conditionalCount} · 가능 ${blocks.block3.summary.okCount} · 최고위험 ${blocks.block3.summary.highestRiskId}`,
      `[벤치마크에서 빠진 신뢰 장치]`,
      gaps,
      `[재작성 대표 1건]`,
      rewriteLine,
      funnelLine,
      `[요청] 위 진단 결과를 상사 품의용 슬라이드 7장의 한국어 카피로 옮겨라. 각 장에 heading·lead·bullets(2~3개). ` + guardrailLine,
    ].join('\n\n');
  }

  return runStructuredCall<DeckSpec>({
    callName: 'call5',
    // call5 프리픽스는 productClass 미사용('미상' 폴백 안전). 골격은 모드별 2종 — 각 모드 안에서 캐시 안정
    system: buildStableGrounding('call5', input.category, input.mode === 'brandProduct' ? input.productClass : '미상', mode),
    userPayload: payload,
    schema: mode === 'brand' ? CALL5_OUTPUT_SCHEMA_BRAND : CALL5_OUTPUT_SCHEMA_FULL,
    maxTokens: 4000,
    mockData: mockCall5(mode),
    onLog,
    validate: (data) => {
      const missing = keys.filter((k) => !data[k]);
      if (missing.length) return `슬라이드 키가 빠졌다: ${missing.join(', ')}. ${keys.length}장 전부 채울 것.`;
      const empty = keys.filter((k) => !data[k]?.heading.trim() || !data[k]?.lead.trim());
      if (empty.length) return `heading·lead가 비어 있다: ${empty.join(', ')}.`;
      return null;
    },
  });
}
