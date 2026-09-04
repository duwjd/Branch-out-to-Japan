/**
 * 콜⑨ copyHumanize — 콜⑦이 낸 일본어 카피의 **문체만** 다듬는다.
 *
 * 왜 별도 콜인가: `/humanize` 스킬(`.claude/skills/humanize-korean/`)은 Agent 툴·`_workspace/`
 * 파일트리·Python 게이트에 의존하는 Claude Code 저작 시점 하네스이고 **한국어 전용**이라
 * Next.js 런타임에서 부를 수 없다. 원리만 이식했다 — 루브릭은 grounding 의 `JP_NATURALNESS_RUBRIC`,
 * 실행은 이 콜이다.
 *
 * 왜 콜⑦ 프롬프트만으로 끝내지 않는가: 콜⑦은 12,000토큰 한 콜로 블록 10~15개의 슬롯을
 * 채우면서 서사·약기법·근거 게이트를 동시에 진다. 거기에 문체까지 얹으면 품질 편차가 크다.
 * 이 콜은 이미지도 없고 텍스트만이라 페이로드가 작다.
 *
 * **설계 원칙: 절대 잡을 죽이지 않는다.**
 *  - `runStructuredCall` 의 `validate` 에 문체 규칙을 넣지 않는다 — client.ts 는 교정 재시도 1회 후
 *    throw 라, 모델이 두 번 고집하면 상세페이지 생성 전체가 죽는다(스펙 §2-9 안전규칙 4의 선례).
 *  - 사후 검사 5종을 통과한 항목만 채택하고, 나머지는 **원문을 그대로 남긴다.**
 *  - 콜 자체가 실패하면 전부 원문으로 진행하고 게이트에 비차단 등급으로 기록한다.
 */

import { runStructuredCall, type LlmCallLogEntry } from '../../engine/llm/client';
import { buildStableGrounding } from '../../engine/grounding';
import type { BrandKit, DetailInput } from '../../db/store';
import type { Category } from '../../engine/types';
import { logger } from '../../logger';
import { getBlock, type BlockPlan } from './blockPack';
import { uncoveredGlyphs } from './fonts';
import { digitSignature, hasHangul } from './translate';

/** 슬롯 하나의 좌표 — 블록과 키. */
export interface CopySlotRef {
  blockId: string;
  key: string;
  ja: string;
}

/** 항목별 판정. 화면·게이트가 그대로 읽는다. */
export interface HumanizeVerdict {
  blockId: string;
  key: string;
  before: string;
  after: string;
  adopted: boolean;
  /** 채택하지 않았다면 그 이유(한국어) */
  rejectedReason?: string;
}

export interface HumanizeResult {
  /** 채택된 결과가 반영된 슬롯 맵(blockId → key → 값). 실패분은 원문이 그대로 들어 있다 */
  slotsByBlock: Record<string, Record<string, string>>;
  verdicts: HumanizeVerdict[];
  /** 콜이 아예 돌지 않았다면 그 사유(목 모드·예외). 게이트에 기록한다 */
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
        required: ['blockId', 'key', 'ja'],
        properties: {
          blockId: { type: 'string' },
          key: { type: 'string' },
          ja: { type: 'string' },
        },
      },
    },
  },
} as const;

interface HumanizeResponse {
  items: CopySlotRef[];
}

/** 본문의 ※n 마커 집합. 하나라도 사라지면 고아 각주가 되어 打消し表示가 증발한다. */
function markerSet(text: string): string {
  return [...(text.match(/※\d+/g) ?? [])].sort().join(',');
}

/**
 * 윤문 결과를 채택할 수 있는가 — 사후 검사 5종.
 * 실패는 조용히 넘어가지 않고 사유가 그대로 화면·게이트로 간다.
 *
 * **검사 순서가 곧 사유의 정확도다.** 구조(빈값 → 항목 수 → 각주) 를 먼저 보고 값(숫자)을 나중에 본다.
 * 예를 들어 `※1` 이 사라지면 숫자 서명도 함께 달라지는데, 그때 "숫자가 바뀌었습니다"라고
 * 말하면 사용자는 가격을 의심하게 된다 — 실제 문제는 각주 누락이다.
 */
export function verifyHumanized(
  before: string,
  after: string,
  forbidden: BrandKit['forbiddenTerms'],
): { ok: true } | { ok: false; reason: string } {
  if (!after.trim()) return { ok: false, reason: '윤문 결과가 비어 있습니다.' };

  // ① 항목 수(줄) 보존 — 슬롯 형식이 깨지면 렌더 트리가 다른 모양이 된다
  const countLines = (t: string) => t.split('\n').filter((l) => l.trim()).length;
  if (countLines(before) !== countLines(after)) return { ok: false, reason: '항목 수가 달라졌습니다.' };

  // ② 각주 마커 보존 — 고아 각주는 조건 한정 표기가 증발한 것이라 打消し表示 누락이 된다
  if (markerSet(before) !== markerSet(after)) {
    return { ok: false, reason: '※각주 마커가 달라졌습니다.' };
  }

  // ③ 숫자 보존 — 가격·수량·SPF·시험 인원이 조용히 바뀌면 景表法 리스크다.
  //    ※n 의 n 은 각주 번호이지 값이 아니므로 서명에서 걷어낸다(②가 이미 지킨다).
  const stripMarkers = (t: string) => t.replace(/※\d+/g, '');
  if (digitSignature(stripMarkers(before)) !== digitSignature(stripMarkers(after))) {
    return { ok: false, reason: '숫자가 바뀌었습니다.' };
  }

  // ④ 렌더 가능 글자만 — 한글 자모는 JP 폰트 cmap 에 들어 있어 커버리지 검사를 통과한다. 따로 본다
  if (hasHangul(after)) return { ok: false, reason: '한글이 남아 있습니다.' };
  const missing = uncoveredGlyphs(after);
  if (missing.length > 0) return { ok: false, reason: `폰트가 그릴 수 없는 문자: ${missing.join('')}` };

  // ⑤ 브랜드 금지 표현
  const hit = forbidden.find((f) => f.term.trim() && after.includes(f.term.trim()));
  if (hit) return { ok: false, reason: `브랜드 금지 표현 "${hit.term}"이 들어갔습니다.` };

  return { ok: true };
}

/** LLM이 채운 슬롯만 추린다 — 코드 소유 값(가격·실적·시험·전성분)은 애초에 닿지 않는다. */
function collectLlmSlots(blocks: BlockPlan[], slotsBySeq: Record<string, string>[]): CopySlotRef[] {
  const out: CopySlotRef[] = [];
  blocks.forEach((plan, i) => {
    const def = getBlock(plan.blockId);
    for (const [key, sd] of Object.entries(def.slots)) {
      if (sd.source !== 'llm') continue;
      const ja = slotsBySeq[i]?.[key];
      // 좌/우 같은 배치 힌트는 문장이 아니다 — 윤문 대상에서 뺀다
      if (!ja || !ja.trim() || /^(left|right)$/i.test(ja.trim())) continue;
      out.push({ blockId: plan.blockId, key, ja });
    }
  });
  return out;
}

export interface HumanizeOptions {
  blocks: BlockPlan[];
  /** 콜⑦ 산출을 assembleBlockSlots **이전에** 넘긴다(코드 소유 값이 섞이기 전) */
  slotsBySeq: Record<string, string>[];
  input: DetailInput;
  brandKit?: BrandKit;
  /**
   * 이 콜의 벽시계 상한(재시도 포함). 생략하면 상한 없음 — SDK 기본(10분)이 함수 상한
   * 300초보다 길어 콜 하나가 함수를 통째로 먹을 수 있다. 값은 `budget.callTimeout()` 이 준다.
   */
  timeoutMs?: number;
  onLog?: (entry: LlmCallLogEntry) => Promise<void> | void;
}

/** grounding 코퍼스는 4종만 집계돼 있으므로 없는 카테고리는 문법이 가장 가까운 skincare 로 접는다. */
function groundingCategory(c: DetailInput['productCategory']): Category {
  switch (c) {
    case 'skincare':
    case 'makeup':
    case 'suncare':
    case 'cleansing':
      return c;
    default:
      return 'skincare';
  }
}

/**
 * 상세페이지의 **모든 일본어 카피**에 JP 자연성 루브릭을 적용한다.
 * 절대 throw 하지 않는다 — 실패는 원문 유지 + 사유 기록으로 흡수한다.
 */
export async function runCopyHumanize(opts: HumanizeOptions): Promise<HumanizeResult> {
  const targets = collectLlmSlots(opts.blocks, opts.slotsBySeq);
  const base: Record<string, Record<string, string>> = {};
  for (const t of targets) {
    base[t.blockId] ??= {};
    base[t.blockId][t.key] = t.ja;
  }
  if (targets.length === 0) {
    return { slotsByBlock: base, verdicts: [], skippedReason: '윤문할 일본어 슬롯이 없습니다.' };
  }

  const forbidden = opts.brandKit?.forbiddenTerms ?? [];
  const tone = opts.brandKit?.toneGuide?.trim();

  const payload = [
    '[작업] 아래 일본어 카피의 문체만 다듬는다. 내용·수치·각주 마커는 그대로 둔다.',
    tone ? `[브랜드 톤 가이드]\n${tone}` : '',
    forbidden.length
      ? `[브랜드 금지 표현 — 결과에 절대 넣지 마라]\n${forbidden.map((f) => `- ${f.term} (${f.reason})`).join('\n')}`
      : '',
    `[대상 — blockId·key 조합을 그대로 돌려준다. 항목을 추가하거나 빼지 마라]\n${targets
      .map((t) => `■ ${t.blockId}.${t.key}\n${t.ja}`)
      .join('\n\n')}`,
    '[출력] items 배열. 고칠 것이 없는 항목도 원문 그대로 포함해 개수를 맞춘다.',
  ]
    .filter(Boolean)
    .join('\n\n');

  let res: HumanizeResponse;
  try {
    res = await runStructuredCall<HumanizeResponse>({
      callName: 'copyHumanize',
      system: buildStableGrounding('copyHumanize', groundingCategory(opts.input.productCategory), '화장품'),
      userPayload: payload,
      schema: HUMANIZE_SCHEMA as unknown as object,
      // 슬롯 텍스트만 왕복한다 — 콜⑦(12000)의 절반이면 충분하다
      maxTokens: 6000,
      // 목 모드에서는 원문을 그대로 돌려준다(픽스처 카피를 흔들지 않는다)
      mockData: { items: [] },
      onLog: opts.onLog,
      timeoutMs: opts.timeoutMs,
      // ⚠ validate 를 두지 않는다 — 문체 규칙으로 잡 전체를 죽이지 않기 위해서다(파일 헤더 참조)
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn('카피 윤문 실패 — 원문 유지', { reason });
    return { slotsByBlock: base, verdicts: [], skippedReason: `윤문 콜이 실패해 원문을 그대로 씁니다: ${reason}` };
  }

  if (res.items.length === 0) {
    return { slotsByBlock: base, verdicts: [], skippedReason: '윤문 결과가 비어 있어 원문을 그대로 씁니다.' };
  }

  const byRef = new Map(res.items.map((it) => [`${it.blockId}\u0000${it.key}`, it.ja]));
  const verdicts: HumanizeVerdict[] = [];

  for (const t of targets) {
    const after = byRef.get(`${t.blockId}\u0000${t.key}`);
    if (after === undefined || after.trim() === t.ja.trim()) continue; // 변경 없음은 판정에 남기지 않는다
    const check = verifyHumanized(t.ja, after, forbidden);
    if (check.ok) {
      base[t.blockId][t.key] = after;
      verdicts.push({ blockId: t.blockId, key: t.key, before: t.ja, after, adopted: true });
    } else {
      verdicts.push({
        blockId: t.blockId,
        key: t.key,
        before: t.ja,
        after,
        adopted: false,
        rejectedReason: check.reason,
      });
    }
  }

  const adopted = verdicts.filter((v) => v.adopted).length;
  logger.info('카피 윤문 완료', { targets: targets.length, changed: verdicts.length, adopted });
  return { slotsByBlock: base, verdicts, skippedReason: null };
}
