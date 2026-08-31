/**
 * ② 상세페이지 비동기 잡 — studioJob 패턴 미러.
 * 상태: generating → done | failed.
 * 단계: analyze → plan → copy → blocks → compose → slice → gate
 *       (blocks 단계는 길어서 blockDone/blockTotal 진행률을 함께 노출한다)
 *
 * 하이브리드 계약: AI는 글자 없는 배경컷만 만들고, 모든 문자는 satori 가 벡터로 그린다.
 * 그래서 검수 게이트의 "오탈자 없음"이 프롬프트 부탁이 아니라 **구조적 사실**이 된다.
 */

import sharp from 'sharp';
import {
  getStore,
  type AssetBlockRecord,
  type DetailInput,
  type GateResult,
  type GeneratedAssetRecord,
} from '../db/store';
import { readStoredFile, saveFile } from '../files/storage';
import { persistBlockImage, persistVisual } from '../studio/detail/persist';
import { logger } from '../logger';
import type { Platform } from '../studio/platform';
import {
  assembleBlockSlots,
  buildBlockPrompt,
  checkFootnoteIntegrity,
  createFootnoteRegistry,
  getBlock,
  getTemplate,
  imagePriority,
  planBlocks,
  usesProductSource,
  type BlockPlanResult,
  type TemplateId,
} from '../studio/detail/blockPack';
import { JOB_BUDGET_MS, fitImageBudget } from '../studio/detail/budget';
import { composeDetail } from '../studio/detail/compose';
import { runDetailCopy } from '../studio/detail/copyCall';
import { runCopyHumanize, type HumanizeResult } from '../studio/detail/humanizeCall';
import { BlockVisualError, IMAGE_TIMEOUT_MS, generateBlockVisual } from '../studio/detail/imageGen';
import { limit } from '../studio/detail/limit';
import { IMAGE_CONCURRENCY, outputProfile, type BlockType, type RenderKind } from '../studio/detail/output';
import { renderBlock } from '../studio/detail/render';
import { buildRenderPlan, promptContextOf, renderContextOf, visualHeightOf } from '../studio/detail/renderContext';
import { toneSummary } from '../studio/detail/rhythm';
import { analyzeSafeArea, type CopyPlacement } from '../studio/detail/safeArea';
import { blockContent } from '../studio/detail/templates';
import { hasHangul } from '../studio/detail/translate';
import { runInputTranslate } from '../studio/detail/translateCall';

export interface DetailJobInput {
  brandProfileId: string;
  brandName: string;
  /** 제품컷·KR 상세 원본 fileId(위→아래 순서, 1~10장). 첫 장이 제품 대표컷 */
  sourceImagePaths: string[];
  platform: Platform;
  templateId: TemplateId;
  detailInput: DetailInput;
  /** 확인 화면에서 끈 블록 */
  disabledBlocks: string[];
  /** 추가 요청(자유 입력) — AI 배경컷 프롬프트의 art direction 으로만 쓰인다 */
  note: string;
  /** 퍼스널컬러 블록용 브랜드 보유 모델컷 */
  modelImagePath: string | null;
}

/** 잡 레코드 생성(generating) — 폼 POST가 호출. */
export async function createDetailAsset(input: DetailJobInput): Promise<GeneratedAssetRecord> {
  const store = await getStore();
  return store.createAsset({
    brandProfileId: input.brandProfileId,
    kind: 'detail',
    styleCategory: input.templateId,
    styleName: getTemplate(input.templateId).nameKo,
    platform: input.platform,
    status: 'generating',
    stage: 'analyze',
    error: null,
    // 제품 대표컷을 원본으로 둔다 — 결과 화면의 Before/After 병기가 이걸 쓴다
    originalImagePath: input.sourceImagePaths[0],
    imagePath: null,
    promptUsed: input.note,
    gateResult: null,
    explanationJson: null,
    proof: input.detailInput.proof,
    modelImagePath: input.modelImagePath,
    modelConsent: input.detailInput.modelConsent,
    promoInput: input.detailInput.promo,
    brandNameSnapshot: input.brandName,
    detailInput: { ...input.detailInput, disabledBlocks: input.disabledBlocks },
    blockTotal: 0,
    blockDone: 0,
    slicePaths: [],
  });
}

/**
 * 비전 입력 장변 상한(px) — 이 이상은 모델이 어차피 내부에서 줄인다.
 * 원본(장당 최대 10MB)을 그대로 보내면 base64 로 1.33배가 되어, 10장이면 프롬프트 바디가
 * 100MB를 넘는다. 업로드 대역과 첫 토큰까지의 시간이 거기서 다 나간다.
 */
const VISION_MAX_EDGE = 1568;

/** 첨부 이미지들을 LLM 비전 입력 형태로 읽는다(최대 10장 — client.ts 계약). */
async function loadVisionImages(paths: string[]) {
  // 저장소 왕복 10회를 직렬로 기다리지 않는다 — 순서는 Promise.all 이 보존한다
  const files = await Promise.all(paths.slice(0, 10).map((p) => readStoredFile(p)));
  const out = await Promise.all(
    files
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map(async (f) => {
        // 장변만 줄인다(비율 유지). withoutEnlargement 로 작은 이미지는 그대로 둔다.
        const buf = await sharp(f.buf)
          .resize({ width: VISION_MAX_EDGE, height: VISION_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer();
        return { mediaType: 'image/jpeg' as const, dataBase64: buf.toString('base64') };
      }),
  );
  if (out.length === 0) throw new Error('첨부 이미지를 찾을 수 없습니다.');
  return out;
}

/**
 * 검수 게이트 — 파이프라인이 구조적으로 보장하는 것만 근거와 함께 기록한다.
 * 썸네일과 달리 "오탈자 없음"이 실제 보증이다(문자를 AI가 그리지 않으므로).
 */
function detailGateResult(
  asset: GeneratedAssetRecord,
  plan: BlockPlanResult,
  footnote: { ok: boolean; orphans: string[]; unused: string[] },
  truncated: string | null,
  /** 렌더에 실패해 결합에서 빠진 블록 이름 */
  dropped: string[],
  /** 배경컷 없이 텍스트만으로 나간 블록 이름 */
  degraded: string[],
  /** 각주 마커가 남아 있는데 각주 블록이 빠졌는가 — 표기 의무가 깨진 상태 */
  footnoteBlockMissing: boolean,
): GateResult {
  const input = asset.detailInput;
  const checks = [
    {
      key: 'noTypos',
      label: '오탈자·유령 글자 없음',
      note: '모든 문자를 벡터 폰트로 렌더 — AI 이미지 생성이 글자에 개입하지 않는다',
    },
    {
      // ⚠ 실검증(2026-08-10)에서 확인된 한계를 그대로 적는다 — 과장하지 않는다.
      // images.edit 는 패키지 인쇄 문자를 재생성하므로 제품 라벨의 미세 변형이 일어날 수 있다.
      key: 'labelPreserved',
      label: '제품 형상·라벨 유지',
      note: '제품이 등장하는 블록은 업로드 원본을 편집 모드로 사용하고, 제품이 등장하지 않아야 할 블록은 용기를 아예 그리지 않습니다 — 한 페이지에 서로 다른 제품이 섞이지 않습니다. 다만 패키지 인쇄 문자는 AI가 다시 그리는 영역이라, 라벨이 크게 보이는 컷은 원본과 대조해 확인해 주세요.',
    },
    {
      key: 'noUnprovenBadges',
      label: '무단 배지·수치 없음',
      note:
        plan.excluded.length > 0
          ? `근거 미충족 블록 ${plan.excluded.length}개를 시퀀스에서 제외(코드 게이트)`
          : '입력된 근거만 블록으로 조립(코드 게이트)',
    },
    {
      key: 'footnoteIntegrity',
      label: '각주 정합(고아 각주 0)',
      // 슬롯 단계 검사만으로는 부족하다 — 각주 블록이 렌더에 실패해 빠지면
      // 본문 ※마커가 해소되지 않은 채 출력된다(표기 의무 위반).
      pass: footnote.ok && !footnoteBlockMissing,
      note: footnoteBlockMissing
        ? '⚠ 각주 블록이 렌더에 실패해 빠졌습니다. 본문 ※마커가 해소되지 않았으니 그대로 업로드하지 마시고 각주 블록을 다시 만들어 주세요.'
        : footnote.ok
          ? '본문의 모든 ※마커가 각주 블록에서 해소됨'
          : `해소되지 않은 마커: ${footnote.orphans.join(', ')}`,
    },
  ];

  if (input?.promo) {
    const note =
      input.promo.normalPrice.trim() && !input.promo.normalPriceVerified
        ? '입력한 가격 문자열만 반영 — 통상가 미표기(실적 확인 없음)'
        : '입력한 가격·특전 문자열만 반영(통상가 취소선은 실적 확인 시에만)';
    checks.push({ key: 'promoValues', label: '가격·특전 입력값 그대로', note });
  }
  if (input?.spec) {
    // 입력 언어 변환(콜⑧)이 돌았으면 "원문 그대로"가 더 이상 사실이 아니다 — 문구를 갈라 쓴다
    const regulated = (input.sourceKo ?? []).filter(
      (s) => s.path === 'spec.fullIngredients' || s.path === 'spec.category',
    );
    checks.push({
      key: 'specVerbatim',
      label: regulated.length > 0 ? '스펙표·전성분 표기 변환됨' : '스펙표·전성분 원문 그대로',
      note:
        regulated.length > 0
          ? `한국어로 입력하신 ${regulated.map((s) => (s.path === 'spec.category' ? '区分' : '全成分')).join('·')}을 일본 표기로 바꿔 넣었습니다. 표시 의무 항목이니 업로드 전 반드시 실제 표기와 대조해 주세요.`
          : '区分·全成分은 입력 원문을 자단위로 렌더 — 코드·LLM이 재가공하지 않는다',
    });
  }
  // 입력 언어 변환 기록 — 브랜드 규칙·표기 확인 등급이라 passed 판정에는 넣지 않는다
  const translated = input?.sourceKo ?? [];
  const issues = input?.translationIssues ?? [];
  if (translated.length > 0 || issues.length > 0) {
    checks.push({
      key: 'inputTranslated',
      label: '한국어 입력 일본어 변환',
      pass: issues.length === 0 ? undefined : false,
      note:
        issues.length === 0
          ? `${translated.length}개 항목을 일본 표기로 변환했습니다. 수치는 원문과 일치하는지 자동 검사했습니다.`
          : `${translated.length}개 변환 · ${issues.length}개 실패 — ${issues.map((i) => i.label).join(' · ')}. 실패분은 한국어 원문이 남아 해당 블록이 빠졌을 수 있습니다.`,
    });
  }
  // 일본어 문체 윤문(콜⑨) 기록 — **비차단 등급**이다. 법적 게이트가 아니라 문체 규칙이라
  // `brandKitApplied` 와 같은 등급으로 두고 passed 판정에는 넣지 않는다.
  const humanizeIssues = input?.humanizeIssues ?? [];
  if (input?.humanizeSkipped || humanizeIssues.length > 0) {
    checks.push({
      key: 'jpCopyNaturalness',
      label: '일본어 문체 윤문',
      note: input?.humanizeSkipped
        ? `${input.humanizeSkipped} 카피 내용에는 영향이 없습니다.`
        : `${humanizeIssues.length}개 항목은 검사에 걸려 윤문 전 문장을 그대로 씁니다 — ${humanizeIssues
            .map((i) => `${i.blockId}.${i.key}(${i.reason})`)
            .join(' · ')}`,
    });
  } else if (input?.theme) {
    // theme 스냅샷이 있으면 이 파이프라인을 탄 자산이다 — 윤문이 조용히 통과했다는 뜻
    checks.push({
      key: 'jpCopyNaturalness',
      label: '일본어 문체 윤문',
      note: '모든 일본어 카피에 AI 티 루브릭을 적용했고, 숫자·※각주 마커·금지 표현 검사를 전부 통과했습니다.',
    });
  }
  if (input?.brandKit && (input.brandKit.productNamesJa.length > 0 || input.brandKit.forbiddenTerms.length > 0)) {
    checks.push({
      key: 'brandKitApplied',
      label: '브랜드 용어집·금지 표현 반영',
      note: `등록 표기 ${input.brandKit.productNamesJa.length}건을 우선 적용하고, 금지 표현 ${input.brandKit.forbiddenTerms.length}건을 변환 지시에 실었습니다.`,
    });
  }
  if (dropped.length > 0) {
    checks.push({
      key: 'droppedBlocks',
      label: '빠진 블록 없음',
      pass: false,
      note: `${dropped.join(' · ')} — 렌더에 실패해 결합에서 제외했습니다. 결과 화면에서 해당 블록만 다시 만들 수 있습니다.`,
    });
  }
  if (degraded.length > 0) {
    checks.push({
      key: 'degradedBlocks',
      label: '배경컷 정상 생성',
      pass: false,
      note: `${degraded.join(' · ')} — 배경 이미지 생성에 실패해 문자만으로 만들었습니다. 카피·근거는 그대로입니다.`,
    });
  }
  if (truncated) {
    checks.push({ key: 'truncated', label: '길이 상한 미적용', pass: false, note: truncated });
  }

  // 각주가 깨졌거나 블록이 빠졌으면 통과로 표시하지 않는다 — 그대로 올리면 안 되는 상태다
  return { passed: footnote.ok && !footnoteBlockMissing && dropped.length === 0, checks };
}

/** 파이프라인 실행 — 응답 후 백그라운드(after)로 실행. 실패는 상태로 기록. */
export async function runDetailJob(assetId: string): Promise<void> {
  const store = await getStore();
  const asset = await store.getAsset(assetId);
  if (!asset) {
    logger.error('상세페이지 잡 시작 실패 — 자산 없음', { assetId });
    return;
  }
  const input = asset.detailInput;
  if (!input) {
    await store.updateAsset(assetId, { status: 'failed', stage: null, error: '상세페이지 입력이 없습니다.' });
    return;
  }

  // 벽시계 마감. maxDuration=300 은 Vercel Hobby 플랫폼 상한이라 올릴 수 없으므로(11 §2),
  // 예산을 늘리는 대신 **가진 예산을 결정적으로 쓴다**(budget.ts).
  const deadline = Date.now() + JOB_BUDGET_MS;

  try {
    const platform = asset.platform as Platform;
    const templateId = asset.styleCategory as TemplateId;
    // 이미지 프롬프트에 들어가는 건 **영어 변환분**이다 — 프롬프트 나머지가 전부 영어라
    // 한국어를 그대로 섞으면 지시가 흐려진다. promptUsed 에는 한국어 원문이 그대로 남아
    // 화면이 사용자 입력을 되비출 수 있다(콜⑧이 안 돌았으면 원문이 곧 지시다).
    const note = input.artDirectionEn ?? asset.promptUsed ?? '';

    // ── plan: 결정적 시퀀스 결정(LLM 미개입) ─────────────────────────────
    await store.updateAsset(assetId, { stage: 'plan' });
    const plan = planBlocks(input, platform, templateId, input.disabledBlocks as BlockType[]);
    if (plan.blocks.length === 0) throw new Error('생성할 블록이 없습니다. 입력을 확인해 주세요.');
    await store.updateAsset(assetId, { blockTotal: plan.blocks.length, blockDone: 0 });

    // ── layout: 밴드 톤·높이·간격(§2-6). 결정적 · LLM 미개입 ──────────────
    // 재생성 경로도 같은 함수를 같은 순서에 적용해 색·톤이 흔들리지 않게 한다.
    const rp = buildRenderPlan(input, platform, templateId);
    logger.info('밴드 리듬 확정', {
      assetId,
      templateId,
      blocks: rp.layout.length,
      tones: toneSummary(rp.layout),
      accent: rp.theme.accent,
      themeSource: rp.theme.source,
    });

    // ── copy: 콜⑦ 로 전 블록 슬롯을 한 번에 채운다 ───────────────────────
    await store.updateAsset(assetId, { stage: 'copy' });
    // 제품 대표컷 + KR 상세 원본 전부를 비전 입력으로 넘긴다(위→아래 순서, 최대 10장)
    const images = await loadVisionImages(
      input.sourceImagePaths.length > 0 ? input.sourceImagePaths : [asset.originalImagePath],
    );
    const copy = await runDetailCopy({
      templateId: plan.templateId,
      blocks: plan.blocks,
      input,
      platform,
      brandName: asset.brandNameSnapshot,
      images,
      onLog: (entry) => store.saveLlmLog(null, entry),
    });

    // ── 콜⑨ copyHumanize: 일본어 카피의 문체를 다듬는다 ──────────────────
    // assembleBlockSlots **이전에** 돈다 — 코드 소유 값(가격·실적·시험·전성분)이 섞이기 전이라
    // 윤문이 그 값들에 아예 닿지 않는다. 실패해도 잡을 죽이지 않고 원문으로 진행한다.
    const llmByBlock = new Map(
      copy.blocks.map((b) => [b.blockId, Object.fromEntries(b.slots.map((s) => [s.key, s.value]))]),
    );
    const humanized: HumanizeResult = await runCopyHumanize({
      blocks: plan.blocks,
      slotsBySeq: plan.blocks.map((p) => llmByBlock.get(p.blockId) ?? {}),
      input,
      brandKit: input.brandKit,
      onLog: (entry) => store.saveLlmLog(null, entry),
    });

    // ── 슬롯 확정(법적 게이트) + 블록 행 생성 ────────────────────────────
    const reg = createFootnoteRegistry();
    const slotsBySeq = plan.blocks.map((p) =>
      assembleBlockSlots(p, humanized.slotsByBlock[p.blockId] ?? llmByBlock.get(p.blockId) ?? {}, input, reg),
    );
    const footnote = checkFootnoteIntegrity(slotsBySeq, reg);

    // 테마·윤문 결과를 자산에 스냅샷한다(신규 컬럼 0개 — 전부 detail_input jsonb).
    // regenerateBlock 이 읽는 유일한 입력이라 이것만으로 재생성 일관성이 확보된다.
    const finalInput: DetailInput = {
      ...input,
      theme: rp.theme as unknown as Record<string, unknown>,
      humanizeIssues: humanized.verdicts
        .filter((v) => !v.adopted)
        .map((v) => ({ blockId: v.blockId, key: v.key, reason: v.rejectedReason ?? '검사 실패' })),
      ...(humanized.skippedReason ? { humanizeSkipped: humanized.skippedReason } : {}),
    };
    await store.updateAsset(assetId, { detailInput: finalInput });
    // ⚠ `asset` 은 잡 시작 시점의 스냅샷이라 위 갱신이 반영돼 있지 않다.
    //   게이트에 그대로 넘기면 jpCopyNaturalness 가 **영원히 나타나지 않는다.**
    const gateAsset: GeneratedAssetRecord = { ...asset, detailInput: finalInput };

    const created = await store.createBlocks(
      assetId,
      plan.blocks.map((p, i) => ({
        seq: p.seq,
        blockType: p.blockId,
        renderKind: p.renderKind,
        status: 'pending' as const,
        error: null,
        slots: slotsBySeq[i],
        promptUsed: null,
        visualPath: null,
        imagePath: null,
        height: null,
        version: 1,
        history: [],
      })),
    );

    await store.updateAsset(assetId, {
      explanationJson: {
        styleReason: copy.narrativeReason,
        // 제품명·원본 요약은 썸네일 결과 화면 전용 필드다 — 상세페이지 화면은 쓰지 않아 비운다
        productName: '',
        beforeSummary: '',
        copySlots: copy.copySlots,
        krElementMap: copy.krElementMap,
      },
    });

    // ── blocks: AI 배경컷(동시성 제한) → satori 렌더 ────────────────────
    await store.updateAsset(assetId, { stage: 'blocks' });
    const original = await readStoredFile(asset.originalImagePath);
    const gate = limit(IMAGE_CONCURRENCY);

    // ── 마감 예산 배분 ──────────────────────────────────────────────
    // 앞단(콜⑧·⑦·⑨)이 예상보다 끌었으면 여기서 알아채고 줄인다. 그냥 진행하면 함수가 300초에서
    // 통째로 죽어 **모든 블록이** 스테일 가드로 실패한다 — 사진 몇 장을 포기하는 것보다 나쁘다.
    const budget = fitImageBudget(
      created
        .filter((r) => (r.renderKind as RenderKind) !== 'text')
        .map((r) => ({
          blockId: r.blockType as BlockType,
          priority: imagePriority(r.blockType as BlockType, input.productCategory, templateId),
          seq: r.seq,
        })),
      deadline - Date.now(),
      IMAGE_CONCURRENCY,
      IMAGE_TIMEOUT_MS,
    );
    const budgetDropReason = new Map(budget.drop.map((d) => [d.blockId, d.reason]));
    logger.info('이미지 예산 배분', {
      assetId,
      keep: budget.keep.length,
      drop: budget.drop.length,
      waves: budget.waves,
      perImageTimeoutMs: budget.perImageTimeoutMs,
      remainingMs: deadline - Date.now(),
    });

    const bandBySeq = new Map(rp.layout.map((b) => [b.seq, b]));

    const rendered = await Promise.all(
      created.map(async (row) => {
        const slots = row.slots;
        const kind = row.renderKind as RenderKind;
        const blockId = row.blockType as BlockType;
        const band = bandBySeq.get(row.seq);
        await store.updateBlock(row.id, { status: 'generating' });
        try {
          let visual: Buffer | undefined;
          let visualPath: string | null = null;
          let promptUsed: string | null = null;
          /** 배경컷 없이 텍스트만으로 만든 경우의 사유(화면에 그대로 노출) */
          let degraded: string | null = null;

          /** 카피를 앉힐 실측 여백. 배경컷이 생겼을 때만 잰다 */
          let placement: CopyPlacement | undefined;

          const budgetDrop = budgetDropReason.get(blockId);
          if (kind !== 'text' && budgetDrop) {
            // ai-visual 은 이미지가 곧 내용이라 배경 없이 남길 게 없다 — 실패로 기록해
            // 사용자가 그 블록만 다시 만들게 한다(생성 실패 경로와 같은 처리).
            if (kind === 'ai-visual') throw new Error(budgetDrop);
            degraded = budgetDrop;
            logger.warn('이미지 예산 초과 — 텍스트 전용으로 강등', { assetId, blockType: row.blockType });
          } else if (kind !== 'text') {
            const prompt = buildBlockPrompt(blockId, slots, promptContextOf(rp, input, copy.isKoreanDetailInput, note));
            promptUsed = prompt;
            // 제품이 등장하는 블록만 원본을 편집 모드로 넘긴다(라벨 보존). 목록은 팩이 소유한다
            const usesProduct = usesProductSource(blockId);
            try {
              // 제품컷을 못 읽었는데 그냥 부르면 편집이 아니라 **순수 생성**으로 조용히 떨어진다.
              // 프롬프트는 여전히 "the supplied product" 라고 말하므로 모델이 없는 용기를 지어낸다 —
              // 사용자가 올린 것과 전혀 다른 제품이 나오는 경로다. 아래 catch 로 보내 ai-visual 은
              // 실패로 남기고(그 블록만 재생성), hybrid 는 배경 없이 카피만 남긴다.
              if (usesProduct && !original) {
                throw new Error('제품컷 원본을 불러오지 못했습니다. 이 블록만 다시 만들어 주세요.');
              }
              const gen = await gate(() =>
                generateBlockVisual({
                  prompt,
                  blockType: blockId,
                  blockNameKo: getBlock(blockId).nameKo,
                  source: usesProduct ? original?.buf : undefined,
                  sourceMediaType: usesProduct ? original?.contentType : undefined,
                  timeoutMs: budget.perImageTimeoutMs,
                }),
              );
              visual = gen.buf;
              visualPath = await persistVisual(gen.buf);
              // 생성된 사진을 실제로 재서 제품이 없는 여백을 찾는다(§4b).
              // 위치를 고정하지 않는 게 핵심 — 하단 고정도 제품이 하단인 컷에서 그대로 가린다.
              placement = await analyzeSafeArea(gen.buf);
              logger.info('카피 배치 실측', { assetId, blockType: row.blockType, reason: placement.reason });
            } catch (err) {
              const message =
                err instanceof BlockVisualError ? err.userMessage : String((err as Error)?.message ?? err);
              // ai-visual 은 이미지가 곧 내용이라 남길 게 없다 — 여기서 던져 아래 catch 가 failed 로 기록한다.
              // hybrid 는 카피가 본체이고 모든 템플릿에 배경 없는 <Frame> 폴백이 있으므로,
              // 통째로 버리지 않고 강등해서 남긴다(버리면 서사와 각주가 함께 사라진다).
              if (kind === 'ai-visual') throw err;
              degraded = message;
              logger.warn('배경컷 실패 — 텍스트 전용으로 강등', {
                assetId,
                blockType: row.blockType,
                kind: err instanceof BlockVisualError ? err.kind : 'unknown',
                reason: err instanceof BlockVisualError ? err.cause : message,
              });
            }
          }

          const content = blockContent(
            blockId,
            slots,
            renderContextOf({
              band,
              theme: rp.theme,
              templateId,
              brandName: asset.brandNameSnapshot,
              hasBackground: Boolean(visual),
              placement,
            }),
          );
          const out = await renderBlock({
            content,
            background: visual,
            backgroundMediaType: 'image/png',
            placement,
            visualHeight: visualHeightOf(band),
          });
          const imagePath = await persistBlockImage(out.png, kind);
          // 여백을 못 찾아 강스크림으로 간 경우는 사용자가 알아야 한다(조용히 가리지 않는다)
          const placementNote = placement && placement.confidence === 0 ? placement.reason : null;
          await store.updateBlock(row.id, {
            status: 'done',
            // 강등된 블록은 done 이지만 사유를 남긴다 — 화면이 "배경컷 없이 생성됨"으로 구분해 보여준다
            error: degraded ?? placementNote,
            imagePath,
            visualPath,
            promptUsed,
            height: out.height,
          });
          await store.incrementBlockDone(assetId);
          return { row, png: out.png, height: out.height, degraded };
        } catch (err) {
          const reason = err instanceof BlockVisualError ? err.userMessage : String((err as Error)?.message ?? err);
          logger.error('블록 렌더 실패', {
            assetId,
            blockType: row.blockType,
            reason: err instanceof BlockVisualError ? err.cause : reason,
          });
          await store.updateBlock(row.id, { status: 'failed', error: reason });
          return null;
        }
      }),
    );

    const ok = rendered.filter((r): r is NonNullable<typeof r> => r !== null).sort((a, b) => a.row.seq - b.row.seq);
    if (ok.length === 0) throw new Error('모든 블록 렌더에 실패했습니다.');

    // 렌더 결과를 근거로 다시 판정한다 — 슬롯 단계 검사만 믿으면 빠진 블록을 못 본다
    const dropped = created.filter((_, i) => rendered[i] === null).map((r) => getBlock(r.blockType).nameKo);
    const degradedNames = ok.filter((r) => r.degraded).map((r) => getBlock(r.row.blockType).nameKo);
    const footnoteBlockMissing = reg.entries.length > 0 && !ok.some((r) => r.row.blockType === 'footnote-block');

    // ── compose / slice ─────────────────────────────────────────────────
    await store.updateAsset(assetId, { stage: 'compose' });
    const profile = outputProfile(platform);
    const composed = await composeDetail(
      ok.map((r) => ({ png: r.png, height: r.height })),
      profile,
    );

    await store.updateAsset(assetId, { stage: 'slice' });
    const masterPath = await saveFile(composed.master, 'jpg', 'detail');
    const slicePaths: string[] = [];
    for (const s of composed.slices) slicePaths.push(await saveFile(s, 'jpg', 'slice'));

    // ── gate ────────────────────────────────────────────────────────────
    await store.updateAsset(assetId, { stage: 'gate' });
    await store.updateAsset(assetId, {
      status: 'done',
      stage: null,
      imagePath: masterPath,
      slicePaths,
      gateResult: detailGateResult(
        gateAsset,
        plan,
        footnote,
        composed.truncated,
        dropped,
        degradedNames,
        footnoteBlockMissing,
      ),
    });

    logger.info('상세페이지 잡 완료', {
      assetId,
      templateId: plan.templateId,
      blocks: ok.length,
      failed: rendered.length - ok.length,
      degraded: degradedNames.length,
      height: composed.totalHeight,
      slices: slicePaths.length,
    });
  } catch (err) {
    const reason = String((err as Error)?.message ?? err);
    logger.error('상세페이지 잡 실패', { assetId, reason });
    await store.updateAsset(assetId, { status: 'failed', stage: null, error: reason });
  }
}

/**
 * 블록 PNG 를 다시 이어붙인다(블록 재생성·순서 변경 후).
 * 블록 이미지가 이미 저장돼 있으므로 sharp 만 돈다 — 실측 3~4초.
 */
export async function recomposeDetail(assetId: string): Promise<void> {
  const store = await getStore();
  const asset = await store.getAsset(assetId);
  if (!asset) throw new Error('자산을 찾을 수 없습니다.');
  const blocks = (await store.listBlocks(assetId)).filter((b) => b.status === 'done' && b.imagePath);
  if (blocks.length === 0) throw new Error('결합할 블록이 없습니다.');

  const inputs: { png: Buffer; height: number }[] = [];
  for (const b of blocks) {
    const f = await readStoredFile(b.imagePath as string);
    if (!f) continue;
    inputs.push({ png: f.buf, height: b.height ?? 0 });
  }
  const profile = outputProfile(asset.platform as Platform);
  const composed = await composeDetail(inputs, profile);
  const masterPath = await saveFile(composed.master, 'jpg', 'detail');
  const slicePaths: string[] = [];
  for (const s of composed.slices) slicePaths.push(await saveFile(s, 'jpg', 'slice'));
  await store.updateAsset(assetId, { imagePath: masterPath, slicePaths });
  logger.info('상세페이지 재결합', { assetId, blocks: inputs.length, height: composed.totalHeight });
}

export type RegenerateMode = 'visual' | 'copy' | 'both';

/**
 * 블록 1개만 다시 만든다.
 *  - 'visual' : AI 배경컷만 재생성(카피 유지). 텍스트 블록에는 해당 없음.
 *  - 'copy'   : 슬롯 텍스트를 그대로 두고 다시 렌더(사용자가 PATCH로 고친 뒤 호출). AI 콜 0.
 *  - 'both'   : 둘 다.
 * 완료 후 자동으로 재결합한다.
 */
export async function regenerateBlock(
  assetId: string,
  blockId: string,
  mode: RegenerateMode,
  note?: string,
): Promise<void> {
  const store = await getStore();
  const asset = await store.getAsset(assetId);
  const row = await store.getBlock(blockId);
  if (!asset || !row || row.assetId !== assetId) throw new Error('블록을 찾을 수 없습니다.');
  const input = asset.detailInput;
  if (!input) throw new Error('상세페이지 입력이 없습니다.');

  const blockType = row.blockType as BlockType;
  const kind = row.renderKind as RenderKind;
  await store.updateBlock(blockId, { status: 'generating' });

  // 시퀀스·리듬·테마를 **최초 생성과 같은 함수로 다시 접는다.** 그래야 이 블록만 다시 만들어도
  // 톤·높이·색이 페이지의 나머지와 어긋나지 않는다(§2-6). 테마는 자산에 스냅샷된 값을 읽는다.
  const rp = buildRenderPlan(input, asset.platform as Platform, asset.styleCategory as TemplateId);
  const band = rp.layout.find((b) => b.seq === row.seq) ?? rp.layout.find((b) => b.blockId === blockType);

  try {
    let visualBuf: Buffer | undefined;
    let visualMediaType = 'image/png';
    let visualPath = row.visualPath;
    let promptUsed = row.promptUsed;

    const needsNewVisual = kind !== 'text' && (mode === 'visual' || mode === 'both');
    if (needsNewVisual) {
      const original = await readStoredFile(asset.originalImagePath);
      // 재생성 요청도 한국어로 올 수 있다 — 최초 생성과 같은 규칙으로 영어 지시로 옮긴다.
      // 변환에 실패하면 지시를 통째로 버린다(한국어를 영어 프롬프트에 섞는 것보다 없는 편이 낫다).
      let artNote = note ?? '';
      if (artNote && hasHangul(artNote)) {
        const t = await runInputTranslate({
          input,
          note: artNote,
          brandKit: input.brandKit,
          onlyNote: true,
          onLog: (entry) => store.saveLlmLog(null, entry),
        });
        artNote = t.artDirectionEn;
      }
      const prompt = buildBlockPrompt(blockType, row.slots, promptContextOf(rp, input, true, artNote));
      promptUsed = prompt;
      const usesProduct = usesProductSource(blockType);
      // 생성 잡과 같은 가드 — 무음 순수 생성으로 떨어지면 원본과 다른 제품이 나온다
      if (usesProduct && !original) {
        throw new Error('제품컷 원본을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
      const gen = await generateBlockVisual({
        prompt,
        blockType,
        blockNameKo: getBlock(blockType).nameKo,
        source: usesProduct ? original?.buf : undefined,
        sourceMediaType: usesProduct ? original?.contentType : undefined,
      });
      visualBuf = gen.buf;
      visualMediaType = 'image/png'; // 방금 받은 원본 버퍼는 PNG다(저장본은 JPEG)
      visualPath = await persistVisual(gen.buf);
    } else if (kind !== 'text' && row.visualPath) {
      // 배경컷 재사용 — 카피만 바꾸는 경우 이미지 콜 0
      const f = await readStoredFile(row.visualPath);
      visualBuf = f?.buf;
      // 저장 포맷을 하드코딩하지 않는다 — 배경컷은 JPEG 로 보관된다
      if (f) visualMediaType = f.contentType;
    }

    // 배경컷을 재사용하든 새로 만들든 **그 이미지**를 재서 여백을 찾는다 — 카피만 바뀌어도
    // 글자 길이가 달라지므로 배치를 그때그때 다시 정하는 게 맞다.
    const placement = visualBuf ? await analyzeSafeArea(visualBuf) : undefined;
    const content = blockContent(
      blockType,
      row.slots,
      renderContextOf({
        band,
        theme: rp.theme,
        templateId: asset.styleCategory as TemplateId,
        brandName: asset.brandNameSnapshot,
        hasBackground: Boolean(visualBuf),
        placement,
      }),
    );
    const out = await renderBlock({
      content,
      background: visualBuf,
      backgroundMediaType: visualMediaType,
      placement,
      visualHeight: visualHeightOf(band),
    });
    const imagePath = await persistBlockImage(out.png, kind);

    const history: AssetBlockRecord['history'] = [
      ...row.history,
      { version: row.version, imagePath: row.imagePath, visualPath: row.visualPath, at: new Date().toISOString() },
    ];
    await store.updateBlock(blockId, {
      status: 'done',
      error: null,
      imagePath,
      visualPath,
      promptUsed,
      height: out.height,
      version: row.version + 1,
      history,
    });
    await recomposeDetail(assetId);
    logger.info('블록 재생성 완료', { assetId, blockId, blockType, mode, version: row.version + 1 });
  } catch (err) {
    const message = err instanceof BlockVisualError ? err.userMessage : String((err as Error)?.message ?? err);
    logger.error('블록 재생성 실패', {
      assetId,
      blockId,
      reason: err instanceof BlockVisualError ? err.cause : message,
    });
    // 재시도가 실패했다고 **멀쩡하던 이전 버전까지 잃으면 안 된다.**
    // status 를 failed 로 두면 재결합이 이 블록을 걸러내 페이지에서 통째로 사라진다.
    if (row.imagePath) {
      await store.updateBlock(blockId, {
        status: 'done',
        error: `${message} (이전 버전을 그대로 두었습니다)`,
      });
    } else {
      await store.updateBlock(blockId, { status: 'failed', error: message });
    }
    throw err;
  }
}

/** 화면이 쓰는 블록 표시 메타 — 블록명·역할은 팩에서 온다(라벨 정책). */
export function blockDisplayMeta(blockType: string): { code: string; nameKo: string; role: string } {
  const def = getBlock(blockType);
  return { code: def.code, nameKo: def.nameKo, role: def.role };
}
