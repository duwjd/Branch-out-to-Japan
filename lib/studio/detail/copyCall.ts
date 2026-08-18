/**
 * 콜⑦ detailCopy — 블록 시퀀스 전체의 일본어 카피를 Claude 비전 1콜로 채운다.
 *
 * 썸네일 콜⑥과의 차이:
 *  - 슬롯이 블록별로 나뉘어 있어 한 번에 여러 블록을 채운다(블록당 1콜이면 비용·시간이 폭발한다).
 *  - **문자는 코드가 벡터로 렌더**하므로 배치·서체·색은 요청하지 않는다. "무엇을 쓸지"만 받는다.
 *  - 가격·실적·시험·전성분 슬롯은 아예 요청하지 않는다 — 코드 소유라 산출돼도 폐기된다.
 */

import { runStructuredCall, type LlmCallLogEntry } from '../../engine/llm/client';
import { buildStableGrounding } from '../../engine/grounding';
import type { DetailInput, ExplanationJson } from '../../db/store';
import type { Category } from '../../engine/types';
import { PLATFORM_LABELS, type Platform } from '../platform';
import { getBlock, getTemplate, type BlockPlan, type TemplateId } from './blockPack';
import { mockLlmSlots } from './fixtures';

export interface DetailCopyResult {
  /** 입력이 KR 상세 원본(오버레이 카피 있음)인가 — AI 배경컷 프롬프트에 cleanup 프리펜드 판단 */
  isKoreanDetailInput: boolean;
  /** 왜 이 구성인지 1~2문장(화면 해설용, 한국어) */
  narrativeReason: string;
  /** 블록별 슬롯 — blockId 는 계획에 있는 것만 채택한다 */
  blocks: { blockId: string; slots: { key: string; value: string }[] }[];
  copySlots: ExplanationJson['copySlots'];
  krElementMap: ExplanationJson['krElementMap'];
}

const DETAIL_COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isKoreanDetailInput', 'narrativeReason', 'blocks', 'copySlots', 'krElementMap'],
  properties: {
    isKoreanDetailInput: { type: 'boolean' },
    narrativeReason: { type: 'string' },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['blockId', 'slots'],
        properties: {
          blockId: { type: 'string' },
          slots: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['key', 'value'],
              properties: { key: { type: 'string' }, value: { type: 'string' } },
            },
          },
        },
      },
    },
    copySlots: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slotKey', 'ja', 'krSource', 'rationale', 'footnote'],
        properties: {
          slotKey: { type: 'string' },
          ja: { type: 'string' },
          krSource: { type: 'string' },
          rationale: { type: 'string' },
          footnote: { type: 'string' },
        },
      },
    },
    krElementMap: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['element', 'action', 'reason'],
        properties: {
          element: { type: 'string' },
          action: { type: 'string', enum: ['유지·정제', '재설계', '제거'] },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

export interface DetailCopyOptions {
  templateId: TemplateId;
  blocks: BlockPlan[];
  input: DetailInput;
  platform: Platform;
  brandName: string;
  /** 제품컷·KR 상세 원본(위→아래 순서). 1~10장 */
  images: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }[];
  onLog?: (entry: LlmCallLogEntry) => Promise<void> | void;
}

/** 블록별로 LLM이 채울 슬롯(source:'llm')만 추려 페이로드용 명세를 만든다. */
function slotSpec(blocks: BlockPlan[]): { lines: string; required: { blockId: string; keys: string[] }[] } {
  const chunks: string[] = [];
  const required: { blockId: string; keys: string[] }[] = [];

  for (const plan of blocks) {
    const def = getBlock(plan.blockId);
    const entries = Object.entries(def.slots).filter(([, sd]) => sd.source === 'llm');
    if (entries.length === 0) continue;
    const keys = entries.filter(([, sd]) => sd.required).map(([k]) => k);
    if (keys.length) required.push({ blockId: plan.blockId, keys });
    chunks.push(
      [
        `■ ${plan.blockId} (${def.nameKo} / ${def.nameJa}) — ${def.role}`,
        ...entries.map(([key, sd]) => `  - ${key} (${sd.required ? '필수' : '선택'}): ${sd.description}`),
        def.mustInclude.length ? `  · 반드시: ${def.mustInclude.join(' / ')}` : '',
        def.mustNotInclude.length ? `  · 금지: ${def.mustNotInclude.join(' / ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  return { lines: chunks.join('\n\n'), required };
}

/**
 * 상품 카테고리 → grounding 카테고리 매핑.
 * grounding 코퍼스는 4종(skincare·makeup·suncare·cleansing)만 집계돼 있으므로,
 * 코퍼스가 없는 카테고리는 문법이 가장 가까운 skincare 로 접는다.
 */
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

/** 목 모드 응답 — 계획된 블록마다 픽스처 슬롯을 채운다(결정적). */
function mockResult(opts: DetailCopyOptions): DetailCopyResult {
  return {
    isKoreanDetailInput: true,
    narrativeReason: `${getTemplate(opts.templateId).nameKo} 구성으로, 문제 제기부터 근거까지 순서대로 쌓이도록 배치했습니다. (데모 카피)`,
    blocks: opts.blocks.map((b) => ({
      blockId: b.blockId,
      slots: Object.entries(mockLlmSlots(b.blockId, opts.input.productCategory, opts.brandName)).map(([key, value]) => ({
        key,
        value,
      })),
    })),
    copySlots: [],
    krElementMap: [],
  };
}

/** 콜⑦ 실행 — 목 모드는 결정적 픽스처(runStructuredCall이 판단). */
export async function runDetailCopy(opts: DetailCopyOptions): Promise<DetailCopyResult> {
  const template = getTemplate(opts.templateId);
  const { lines, required } = slotSpec(opts.blocks);
  const i = opts.input;

  const facts = [
    `카테고리: ${i.productCategory}`,
    i.ingredients.length ? `성분(입력됨): ${i.ingredients.map((x) => `${x.name} ${x.percent}`).join(', ')}` : '성분: 미입력',
    i.freeOf.length ? `무첨가: ${i.freeOf.join(', ')}` : '',
    i.specs.length ? `스펙: ${i.specs.map((x) => `${x.label} ${x.value}`).join(', ')}` : '',
    i.options.length ? `옵션: ${i.options.length}개(${i.options[0].axis})` : '',
    i.howToSteps.length ? `사용법 STEP ${i.howToSteps.length}개(원문은 코드가 넣음)` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const payload = [
    `[작업] 첨부 이미지(제품컷·한국 상세 원본)를 보고, 아래 블록 시퀀스의 일본어 카피 슬롯을 채운다.`,
    `[템플릿] ${template.nameKo}(${template.nameJa}) — ${template.description}`,
    `[블록 시퀀스(코드가 확정 — 순서·구성 변경 금지)]\n${opts.blocks.map((b, n) => `${n + 1}. ${b.blockId} (${b.nameKo})`).join('\n')}`,
    `[채울 슬롯 — 아래 blockId·key 조합만 산출한다. 없는 키를 만들지 말 것]\n${lines}`,
    `[입력된 사실]\n${facts}`,
    `[메타] 타깃 플랫폼: ${PLATFORM_LABELS[opts.platform]} · 브랜드명: ${opts.brandName}`,
    `[요청]`,
    `1. isKoreanDetailInput — 첨부가 한국어 오버레이가 있는 상세페이지인지 판정.`,
    `2. krElementMap — 첨부 속 KR 요소를 유지·정제/재설계/제거로 분류하고 근거를 한 줄씩.`,
    `3. blocks — 위 슬롯 명세대로. 여러 항목이 들어가는 슬롯은 줄바꿈(\\n)으로 구분하고, "제목|본문" 형식이 명시된 슬롯은 세로줄(|)로 나눈다.`,
    `4. copySlots — 주요 일본어 카피 슬롯에 대해 ja(재설계한 일본어 카피) / krSource(그 카피가 대체하는 한국어 원문 그대로. 대응 문구가 없으면 원본 의도를 한 줄로) / rationale(재설계 근거) / footnote(없으면 빈 문자열).`,
    `5. narrativeReason — 왜 이 구성이 이 제품·플랫폼에 맞는지 1~2문장(한국어, 화면 해설용).`,
    `[주의] 일본어 카피에 한글·이모지·간체자를 절대 섞지 마라 — 렌더 폰트가 그리지 못해 생성이 실패한다.`,
  ].join('\n\n');

  return runStructuredCall<DetailCopyResult>({
    callName: 'detailCopy',
    system: buildStableGrounding('detailCopy', groundingCategory(i.productCategory), '화장품'),
    userPayload: payload,
    schema: DETAIL_COPY_SCHEMA as unknown as object,
    // 블록 10~15개 × 슬롯 3~6개라 썸네일(4000)보다 크게 잡는다
    maxTokens: 12000,
    images: opts.images,
    mockData: mockResult(opts),
    onLog: opts.onLog,
    validate: (data) => {
      const bySlot = new Map(data.blocks.map((b) => [b.blockId, new Map(b.slots.map((s) => [s.key, s.value]))]));
      const missing: string[] = [];
      for (const { blockId, keys } of required) {
        const got = bySlot.get(blockId);
        for (const k of keys) {
          if (!got?.get(k)?.trim()) missing.push(`${blockId}.${k}`);
        }
      }
      if (missing.length) return `필수 슬롯 누락/공란: [${missing.join(', ')}] — 슬롯 명세대로 전부 채워라.`;
      return null;
    },
  });
}
