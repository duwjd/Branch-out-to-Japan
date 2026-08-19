/**
 * 콜⑩ reportHumanize — 발행 직전 리포트의 **한국어 서술 문체만** 다듬는다.
 *
 * 왜 별도 콜인가: 콜③·④는 판정·근거·재설계를 동시에 지면서 스키마까지 맞춘다. 거기에 문체까지
 * 얹으면 품질 편차가 커진다. ② 축이 같은 이유로 콜⑦에서 콜⑨(copyHumanize)를 떼어낸 선례가 있다
 * (`lib/studio/detail/humanizeCall.ts` 헤더 참조). 이 파일은 그 한국어 대응물이고, 안전 계약도 같다.
 *
 * **설계 원칙: 절대 잡을 죽이지 않는다.**
 *  - `runStructuredCall` 의 `validate`·`repair` 에 문체 규칙을 넣지 않는다 — 문체는 계약이 아니다.
 *  - 사후 검사 7종을 통과한 항목만 채택하고, 나머지는 **원문을 그대로 남긴다.**
 *  - 콜 자체가 실패하면 전부 원문으로 진행하고 사유를 기록한다.
 *
 * **대상은 LLM이 쓴 한국어 서술뿐이다.** `assemble.ts` 가 만든 템플릿 문구(블록0 고지·블록9 액션)는
 * 사람이 쓴 문장이라 윤문 대상이 아니다 — 건드리면 법적 고지 문구가 흔들린다.
 */

import { runStructuredCall, REPORT_MODEL, type LlmCallLogEntry } from '../engine/llm/client';
import { buildStableGrounding } from '../engine/grounding';
import { digitSignature, isKoreanDominant } from '../engine/lang';
import type { BlocksJson } from '../engine/types';
import { logger } from '../logger';

/** 윤문 대상 슬롯 하나 — blocksJson 안의 좌표와 원문 */
export interface KoSlotRef {
  path: string;
  text: string;
}

/** 항목별 판정. 화면·로그가 그대로 읽는다 */
export interface KoHumanizeVerdict {
  path: string;
  before: string;
  after: string;
  adopted: boolean;
  /** 채택하지 않았다면 그 이유(한국어) */
  rejectedReason?: string;
}

export interface KoHumanizeResult {
  /** 채택분이 반영된 blocksJson. 실패분은 원문이 그대로 들어 있다 */
  blocksJson: BlocksJson;
  verdicts: KoHumanizeVerdict[];
  /** 콜이 아예 돌지 않았다면 그 사유(목 모드·예외·대상 없음) */
  skippedReason: string | null;
}

const HUMANIZE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'ko'],
        properties: {
          path: { type: 'string', description: '입력으로 준 경로를 그대로 돌려준다' },
          ko: { type: 'string', description: '(한국어) 문체만 다듬은 결과. 고칠 게 없으면 원문 그대로' },
        },
      },
    },
  },
} as const;

/** 응답 항목 — 스키마와 1:1(`ko`). 입력 슬롯(`KoSlotRef.text`)과 필드명이 다르니 섞지 말 것 */
interface HumanizedItem {
  path: string;
  ko: string;
}

interface HumanizeResponse {
  items: HumanizedItem[];
}

/**
 * 윤문 대상 최소 길이.
 * 이보다 짧으면 라벨·구 조각(`'근거 라벨·각주 부재'`)이라 다듬을 여지가 없고, 오히려 모델이
 * 라벨을 문장으로 "개선"해 표 칸을 망가뜨린다. 반대로 너무 높이면 USP 재정의 칸
 * (`'근거 없는 단정 = 과장으로 읽혀 감점'`, 21자)처럼 실제 서술이 통째로 빠진다.
 */
const MIN_CHARS = 16;

/** 과윤문 가드 — 길이가 이 비율 밖으로 벗어나면 문체가 아니라 내용을 바꾼 것이다 */
const LENGTH_TOLERANCE = 0.4;

/**
 * 윤문 대상 수집 — **LLM이 쓴 한국어 서술 경로만.**
 *
 * 여기 없는 것들과 그 이유:
 *  · `block0`·`block9`  — 템플릿 문구(고지·한계·퍼널). 사람이 쓴 문장이다
 *  · `block3.sentences[].originalText` — 고객 원문. 손대면 감사 대상이 바뀐다
 *  · `block5.items[].evidenceQuote`·`corpusRef` — 인용값
 *  · `block7.rewrites[].afterJa`·`block8.afterJaBlock` — 일본어 산출물(콜⑨의 영역)
 *  · `block2.persona.name`·`skinConcerns`·`trustTriggers` — 일본어 어휘가 값 자체다
 *  · `block2.objections[].question` — 일본 고객 의문 원문(일본어)
 */
export function collectKoreanNarrative(blocks: BlocksJson): KoSlotRef[] {
  const out: KoSlotRef[] = [];
  const push = (path: string, text: string | undefined) => {
    if (typeof text === 'string' && text.trim().length >= MIN_CHARS) out.push({ path, text });
  };

  push('block1.summaryText', blocks.block1.summaryText);

  const p = blocks.block2.persona;
  push('block2.persona.buyingMotive', p.buyingMotive);
  push('block2.persona.priceSensitivity', p.priceSensitivity);
  blocks.block2.journey.stages.forEach((s, i) => push(`block2.journey.stages[${i}]`, s));
  push('block2.journey.finalConfidencePoint', blocks.block2.journey.finalConfidencePoint);
  blocks.block2.objections.forEach((o, i) => push(`block2.objections[${i}].why`, o.why));
  blocks.block2.uspTable.forEach((u, i) => {
    push(`block2.uspTable[${i}].jpReading`, u.jpReading);
    push(`block2.uspTable[${i}].redefinedUsp`, u.redefinedUsp);
  });

  blocks.block3?.sentences.forEach((s, i) => push(`block3.sentences[${i}].reason`, s.reason));

  push('block4.narrative', blocks.block4.narrative);

  blocks.block6.narrative.forEach((r, i) => {
    push(`block6.narrative[${i}].infoGap`, r.infoGap);
    push(`block6.narrative[${i}].distrustSignal`, r.distrustSignal);
    push(`block6.narrative[${i}].dropOff`, r.dropOff);
  });

  blocks.block7?.rewrites.forEach((r, i) => {
    push(`block7.rewrites[${i}].problem`, r.problem);
    push(`block7.rewrites[${i}].reason`, r.reason);
    push(`block7.rewrites[${i}].afterKr`, r.afterKr);
  });

  push('block8.afterKrBlock', blocks.block8?.afterKrBlock);

  return out;
}

/** 각주·조항 각주 마커 집합 — `[1]` `[JP-01]` 형태를 전부 모은다 */
function footnoteSet(text: string): string {
  return [...(text.match(/\[[A-Za-z0-9가-힣_-]+\]/g) ?? [])].sort().join(',');
}

/** 「」·『』 인용 스팬 — 코퍼스 실측값이거나 고객 의문 원문이라 한 글자도 바뀌면 안 된다 */
function quoteSet(text: string): string {
  return [...(text.match(/「[^」]*」|『[^』]*』/g) ?? [])].join('|');
}

/**
 * 윤문 결과를 채택할 수 있는가 — 사후 검사 7종.
 *
 * **검사 순서가 곧 사유의 정확도다.** 구조(빈값 → 줄 수 → 각주 → 인용)를 먼저 보고 값(숫자)을
 * 나중에 본다. 각주가 사라지면 숫자 서명도 함께 달라지는데, 그때 "숫자가 바뀌었다"고 말하면
 * 사용자는 점수를 의심하게 된다 — 실제 문제는 근거 링크가 끊어진 것이다.
 *
 * @param before 원문
 * @param after 윤문 결과
 */
export function verifyHumanizedKo(before: string, after: string): { ok: true } | { ok: false; reason: string } {
  if (!after.trim()) return { ok: false, reason: '윤문 결과가 비어 있습니다.' };

  // ① 줄 수 보존 — 렌더 트리가 다른 모양이 되는 것을 막는다
  const countLines = (t: string) => t.split('\n').filter((l) => l.trim()).length;
  if (countLines(before) !== countLines(after)) return { ok: false, reason: '줄 수가 달라졌습니다.' };

  // ② 각주·조항 마커 보존 — 하나라도 사라지면 규정 근거 링크가 끊어진다
  if (footnoteSet(before) !== footnoteSet(after)) return { ok: false, reason: '각주·조항 마커가 달라졌습니다.' };

  // ③ 「」 인용 보존 — 코퍼스 실측값·고객 의문 원문이다. 다듬는 대상이 아니다
  if (quoteSet(before) !== quoteSet(after)) return { ok: false, reason: '「」 인용이 달라졌습니다.' };

  // ④ 숫자 보존 — 점수·건수·가격이 조용히 바뀌면 리포트가 거짓말을 한다.
  //    각주의 [n] 은 번호이지 값이 아니므로 서명에서 걷어낸다(②가 이미 지킨다).
  const stripMarkers = (t: string) => t.replace(/\[[A-Za-z0-9가-힣_-]+\]/g, '');
  if (digitSignature(stripMarkers(before)) !== digitSignature(stripMarkers(after))) {
    return { ok: false, reason: '숫자가 바뀌었습니다.' };
  }

  // ⑤ 한국어 우세 유지 — 윤문이 일본어를 끌어들이면 고치려던 문제를 되살리는 셈이다
  if (!isKoreanDominant(after)) return { ok: false, reason: '결과가 한국어 서술이 아닙니다.' };

  // ⑥ 과윤문 가드 — 길이가 크게 변했다면 문체가 아니라 내용을 바꾼 것이다
  const ratio = after.length / before.length;
  if (ratio < 1 - LENGTH_TOLERANCE || ratio > 1 + LENGTH_TOLERANCE) {
    return { ok: false, reason: '분량이 크게 달라졌습니다(문체가 아니라 내용이 바뀐 것으로 판단).' };
  }

  // ⑦ 약기법 판정어 보존 — 판정을 바꾸는 윤문은 있을 수 없다.
  //
  //    「가능」은 검사하지 않는다. 실측에서 "시술 직후 사용 가능 여부", "시험을 실시한 경우에만
  //    사용 가능하므로" 같은 **일상어 용법**이 전부 오탐으로 잡혔다. 비차단 게이트에서 오탐은
  //    곧 무시로 이어지므로, 판정을 실제로 뒤집는 두 단어만 남긴다.
  //    「불가」는 "불가능"의 접두라 그대로 세면 같은 오탐이 난다 — 뒤에 「능」이 오면 제외한다.
  for (const [label, re] of [
    ['불가', /불가(?!능)/g],
    ['조건부', /조건부/g],
  ] as const) {
    const count = (t: string) => (t.match(new RegExp(re.source, 'g')) ?? []).length;
    if (count(before) !== count(after)) return { ok: false, reason: `판정어 "${label}" 사용이 달라졌습니다.` };
  }

  return { ok: true };
}

/** 경로 문자열로 blocksJson 안의 값을 덮어쓴다(사본 위에서만 호출한다) */
function setByPath(root: unknown, path: string, value: string): void {
  const segs = path.split('.').flatMap((s) => {
    const m = s.match(/^([^[]+)((\[\d+\])*)$/);
    if (!m) return [s];
    const idx = [...m[2].matchAll(/\[(\d+)\]/g)].map((x) => x[1]);
    return [m[1], ...idx];
  });
  let node = root as Record<string, unknown>;
  for (const seg of segs.slice(0, -1)) {
    node = node?.[seg] as Record<string, unknown>;
    if (node === null || node === undefined) return;
  }
  const last = segs[segs.length - 1];
  if (node && typeof node === 'object') node[last] = value;
}

export interface KoHumanizeOptions {
  blocksJson: BlocksJson;
  onLog?: (entry: LlmCallLogEntry) => Promise<void> | void;
}

/**
 * 리포트의 한국어 서술 전체에 자연성 루브릭을 적용한다.
 * 절대 throw 하지 않는다 — 실패는 원문 유지 + 사유 기록으로 흡수한다.
 */
export async function runReportHumanize(opts: KoHumanizeOptions): Promise<KoHumanizeResult> {
  const targets = collectKoreanNarrative(opts.blocksJson);
  const next = structuredClone(opts.blocksJson);

  if (targets.length === 0) {
    return { blocksJson: next, verdicts: [], skippedReason: '윤문할 한국어 서술이 없습니다.' };
  }

  const payload = [
    '[작업] 아래 한국어 서술의 문체만 다듬는다. 판정·근거·수치·각주는 그대로 둔다.',
    `[대상 — path 를 그대로 돌려준다. 항목을 추가하거나 빼지 마라(총 ${targets.length}개)]`,
    targets.map((t) => `■ ${t.path}\n${t.text}`).join('\n\n'),
    '[출력] items 배열. 고칠 것이 없는 항목도 원문 그대로 포함해 개수를 맞춘다.',
  ].join('\n\n');

  let res: HumanizeResponse;
  try {
    res = await runStructuredCall<HumanizeResponse>({
      callName: 'reportHumanize',
      // 카테고리·제품분류는 이 콜의 grounding 에서 쓰이지 않는다(문체만 보는 콜이라
      // 코퍼스·렉시콘·규정을 주입하지 않는다) — 캐시 프리픽스를 하나로 고정한다
      system: buildStableGrounding('reportHumanize', opts.blocksJson.meta.category, opts.blocksJson.meta.productClass),
      userPayload: payload,
      schema: HUMANIZE_SCHEMA as unknown as object,
      model: REPORT_MODEL,
      effort: 'medium',
      maxTokens: 12000,
      // 목 모드에서는 원문을 그대로 둔다(픽스처 문장을 흔들지 않는다)
      mockData: { items: [] },
      onLog: opts.onLog,
      // ⚠ validate·repair 를 두지 않는다 — 문체 규칙으로 리포트 전체를 죽이지 않기 위해서다
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn('리포트 윤문 실패 — 원문 유지', { reason });
    return { blocksJson: next, verdicts: [], skippedReason: `윤문 콜이 실패해 원문을 그대로 씁니다: ${reason}` };
  }

  if (res.items.length === 0) {
    return { blocksJson: next, verdicts: [], skippedReason: '윤문 결과가 비어 있어 원문을 그대로 씁니다.' };
  }

  const byPath = new Map(res.items.map((it) => [it.path, it.ko]));
  const verdicts: KoHumanizeVerdict[] = [];

  for (const t of targets) {
    const after = byPath.get(t.path);
    if (after === undefined || after.trim() === t.text.trim()) continue; // 변경 없음은 판정에 남기지 않는다
    const check = verifyHumanizedKo(t.text, after);
    if (check.ok) {
      setByPath(next, t.path, after);
      verdicts.push({ path: t.path, before: t.text, after, adopted: true });
    } else {
      verdicts.push({ path: t.path, before: t.text, after, adopted: false, rejectedReason: check.reason });
    }
  }

  const adopted = verdicts.filter((v) => v.adopted).length;
  logger.info('리포트 윤문 완료', { targets: targets.length, changed: verdicts.length, adopted });
  return { blocksJson: next, verdicts, skippedReason: null };
}
