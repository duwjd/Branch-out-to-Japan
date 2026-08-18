/**
 * 템플릿 카드(DETAIL-04) 프리뷰 6장을 **실제 파이프라인으로** 굽는다.
 *
 * 왜 실제로 굽는가 — 카드가 보여주는 것이 "이 템플릿을 고르면 나오는 결과"여야 한다.
 * 도식·목업은 실제 산출과 어긋나는 순간 사용자를 속이게 된다.
 *
 * 사용:
 *   npm run detail:previews                 # 6종 전부(캐시된 배경컷 재사용)
 *   npm run detail:previews -- --force      # 배경컷까지 새로 생성(gpt-image-2 콜 발생)
 *   npm run detail:previews -- --only D4    # 한 종만
 *
 * 산출: public/detail-templates/preview-D{1..6}.webp (폭 592, 전체 높이)
 * 중간물: .data/detail-previews/<템플릿>/ (배경컷 캐시 — 커밋하지 않는다)
 *
 * ⚠ 제품 대표컷은 **가공 제품컷**(assets/samples/haruon-mock-product.png)만 쓴다.
 *   실측 참고 컷·실존 타사 제품컷을 쓰면 그 이미지가 제품 UI에 상시 노출된다
 *   (docs/specs/02-studio/assets/README.md 사용조건 3).
 *
 * ⚠ 프로모·실적 레이어는 끄고 굽는다. 이 레이어는 6종 공통으로 앞에 4블록이 붙어
 *   카드 상단이 전부 같아진다 — 템플릿을 구분해 보여준다는 목적을 스스로 무너뜨린다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  assembleBlockSlots,
  buildBlockPrompt,
  createFootnoteRegistry,
  planBlocks,
  usesProductSource,
  type DetailInput,
  type ProductCategory,
  type TemplateId,
} from '../lib/studio/detail/blockPack';
import { mockLlmSlots } from '../lib/studio/detail/fixtures';
import { runDetailCopy } from '../lib/studio/detail/copyCall';
import { generateBlockVisual } from '../lib/studio/detail/imageGen';
import { limit } from '../lib/studio/detail/limit';
import { currentImageMode } from '../lib/studio/imageGen';
import { currentLlmMode } from '../lib/engine/llm/client';
import { composeDetail } from '../lib/studio/detail/compose';
import { IMAGE_CONCURRENCY, outputProfile, type BlockType } from '../lib/studio/detail/output';
import { renderBlock } from '../lib/studio/detail/render';
import {
  buildRenderPlan,
  promptContextOf,
  renderContextOf,
  visualHeightOf,
} from '../lib/studio/detail/renderContext';
import { analyzeSafeArea, type CopyPlacement } from '../lib/studio/detail/safeArea';
import { toneSummary } from '../lib/studio/detail/rhythm';
import { blockContent } from '../lib/studio/detail/templates';
import type { Platform } from '../lib/studio/platform';

const OUT_DIR = path.join(process.cwd(), 'public', 'detail-templates');
const CACHE_ROOT = path.join(process.cwd(), '.data', 'detail-previews');
const PRODUCT_SHOT = path.join(process.cwd(), 'docs/specs/02-studio/assets/samples/haruon-mock-product.png');

/** 카드 이미지 폭(2x). 카드는 296 CSS px 로 표시하고, 「전체 보기」가 같은 파일을 그대로 쓴다. */
const PREVIEW_WIDTH = 592;
/** 카드 썸네일 치수(2x DPR 기준) — 화면 카드는 74×168 CSS px */
const CARD_W = 148;
const CARD_H = 336;
const BRAND = 'HARUON';

/**
 * 템플릿별 데모 조건 — 그 템플릿이 **실제로 노리는 상품**으로 굽는다.
 * D4 를 스킨케어로 구우면 컬러 블록이 근거 미충족으로 빠져 카드가 거짓말을 하게 된다.
 */
const CASES: { id: TemplateId; category: ProductCategory; platform: Platform; colors: number }[] = [
  { id: 'D1', category: 'skincare', platform: 'rakuten-official', colors: 0 },
  { id: 'D2', category: 'skincare', platform: 'rakuten-official', colors: 0 },
  { id: 'D3', category: 'suncare', platform: 'rakuten-official', colors: 0 },
  { id: 'D4', category: 'makeup', platform: 'qoo10', colors: 8 },
  { id: 'D5', category: 'cleansing', platform: 'rakuten-official', colors: 0 },
  { id: 'D6', category: 'skincare', platform: 'rakuten-official', colors: 0 },
];

/** 데모 입력 — 전부 일본어다(콜⑧ 변환 경로를 타지 않는다). */
function demoInput(c: (typeof CASES)[number]): DetailInput {
  return {
    productCategory: c.category,
    sourceImagePaths: [],
    disabledBlocks: [],
    spec: {
      volume: '30mL',
      category: '化粧品',
      manufacturer: `株式会社${BRAND}`,
      origin: '韓国',
      fullIngredients: '水、BG、グリセリン、ナイアシンアミド、ヒアルロン酸Na、トコフェロール',
    },
    ingredients: [
      { name: 'ナイアシンアミド', percent: '2%', purpose: '整肌成分' },
      { name: 'ヒアルロン酸Na', percent: '—', purpose: '保湿成分' },
    ],
    freeOf: ['合成香料', '鉱物油', 'パラベン', 'エタノール', '合成着色料'],
    specs: c.category === 'suncare' ? [{ label: 'SPF', value: '50+' }, { label: 'PA', value: '++++' }] : [],
    howToSteps: [
      '洗顔後、化粧水で肌をととのえます。',
      '適量を手にとり、顔全体になじませます。',
      '気になる部分は重ねづけしてください。',
    ],
    options: Array.from({ length: c.colors }, (_, i) => ({
      axis: 'color' as const,
      name: `カラー${String(i + 1).padStart(2, '0')}`,
      swatchHex: ['#c86b5a', '#b8564d', '#d98a76', '#a34b58', '#e0a08c', '#8f4550', '#cf7d6b', '#b96a72'][i % 8],
      sku: `SHADE ${i + 1}`,
    })),
    cautions: [
      'お肌に異常が生じないかよく注意してご使用ください。',
      '傷やはれもの、湿疹等、異常のある部位にはお使いにならないでください。',
    ],
    // 프로모·실적 레이어는 끈다(파일 상단 주석 참조)
    proof: null,
    sales: null,
    test: { name: '効能評価試験済み', condition: '4週間連用試験', institution: '第三者評価機関', date: '2026.04.15', sampleSize: '21名' },
    reviews: [{ text: 'べたつかず、朝のメイクのりが安定しました。', rating: '★5', age: '30代' }],
    promo: null,
    modelConsent: false,
  };
}

/** 템플릿 1종을 끝까지 굽고 master 를 돌려준다. */
async function buildOne(
  c: (typeof CASES)[number],
  product: Buffer,
  force: boolean,
): Promise<{ master: Buffer; width: number; height: number; blocks: number; aiCalls: number }> {
  const input = demoInput(c);
  const cacheDir = path.join(CACHE_ROOT, c.id);
  mkdirSync(cacheDir, { recursive: true });

  const plan = planBlocks(input, c.platform, c.id);
  // 밴드 리듬·테마도 잡 러너와 같은 함수로 확정한다 — 안 하면 프리뷰 카드와 산출물이 어긋난다
  const rp = buildRenderPlan(input, c.platform, c.id);
  console.log(`밴드 리듬: ${toneSummary(rp.layout)} · accent ${rp.theme.accent}`);
  process.stdout.write(`  블록 ${plan.blocks.length}개 · AI ${plan.aiBlockCount}개\n`);

  // 카피 — 실 모드면 콜⑦, 아니면 픽스처
  let llmByBlock: Map<string, Record<string, string>>;
  const copyCache = path.join(cacheDir, 'copy.json');
  // ⚠ **블록 구성이 바뀌면 캐시는 스테일이다.** 캐시에 없는 블록은 슬롯이 통째로 비어
  //   라벨만 찍힌 빈 밴드가 나오는데, 그게 프리뷰라 실제 산출물인 줄 알고 디버깅하게 된다
  //   (2026-08-18 실측: 카테고리 샷 보강으로 D2에 사용컷이 생기자 그 밴드가 "SCENE" 한 줄만 나왔다).
  const cachedKeys: string[] = existsSync(copyCache)
    ? Object.keys(JSON.parse(readFileSync(copyCache, 'utf8')) as Record<string, unknown>)
    : [];
  const missing = plan.blocks.filter((b) => !cachedKeys.includes(b.blockId)).map((b) => b.blockId);
  const cacheUsable = cachedKeys.length > 0 && missing.length === 0;
  if (missing.length > 0 && cachedKeys.length > 0) {
    console.log(`  카피 캐시 스테일 — 블록 ${missing.join(', ')} 없음. 다시 채웁니다`);
  }
  if (currentLlmMode() === 'real' && (force || !cacheUsable)) {
    const copy = await runDetailCopy({
      templateId: plan.templateId,
      blocks: plan.blocks,
      input,
      platform: c.platform,
      brandName: BRAND,
      images: [{ mediaType: 'image/png', dataBase64: product.toString('base64') }],
    });
    const flat = Object.fromEntries(
      copy.blocks.map((b) => [b.blockId, Object.fromEntries(b.slots.map((s) => [s.key, s.value]))]),
    );
    writeFileSync(copyCache, JSON.stringify(flat, null, 2));
    llmByBlock = new Map(Object.entries(flat));
  } else if (cacheUsable) {
    llmByBlock = new Map(Object.entries(JSON.parse(readFileSync(copyCache, 'utf8')) as Record<string, Record<string, string>>));
  } else {
    // 목 모드이거나 캐시가 스테일인데 실 콜을 못 쓰는 경우 — 픽스처로 채워 빈 밴드를 만들지 않는다
    llmByBlock = new Map(plan.blocks.map((b) => [b.blockId, mockLlmSlots(b.blockId, input.productCategory, BRAND)]));
  }

  const reg = createFootnoteRegistry();
  const slotsBySeq = plan.blocks.map((b) => assembleBlockSlots(b, llmByBlock.get(b.blockId) ?? {}, input, reg));

  // 배경컷 — 템플릿별 캐시 디렉터리라 6종이 각자 다른 사진을 갖는다
  const gate = limit(IMAGE_CONCURRENCY);
  const visuals = new Map<string, Buffer>();
  const aiBlocks = plan.blocks.filter((b) => b.renderKind !== 'text');
  let aiCalls = 0;
  await Promise.all(
    aiBlocks.map((b) =>
      gate(async () => {
        const cachePath = path.join(cacheDir, `visual-${b.blockId}.png`);
        if (!force && existsSync(cachePath)) {
          visuals.set(b.blockId, readFileSync(cachePath));
          return;
        }
        const i = plan.blocks.indexOf(b);
        const prompt = buildBlockPrompt(b.blockId, slotsBySeq[i], promptContextOf(rp, input, false));
        const usesProduct = usesProductSource(b.blockId as BlockType);
        try {
          const gen = await generateBlockVisual({
            prompt,
            blockType: b.blockId as BlockType,
            source: usesProduct ? product : undefined,
            sourceMediaType: usesProduct ? 'image/png' : undefined,
          });
          visuals.set(b.blockId, gen.buf);
          writeFileSync(cachePath, gen.buf);
          aiCalls += 1;
        } catch (err) {
          // 배경컷 하나가 실패해도 6종 빌드를 죽이지 않는다 — 그 블록만 텍스트로 강등된다
          process.stdout.write(`  ⚠ 배경컷 실패 ${b.blockId}: ${String((err as Error)?.message ?? err)}\n`);
        }
      }),
    ),
  );

  const rendered: { png: Buffer; height: number }[] = [];
  for (let i = 0; i < plan.blocks.length; i++) {
    const b = plan.blocks[i];
    const bg = visuals.get(b.blockId);
    // 잡 러너와 같은 경로를 탄다 — 배경컷을 실제로 재서 제품이 없는 여백에 카피를 앉힌다
    const band = rp.layout.find((x) => x.seq === b.seq);
    const placement: CopyPlacement | undefined = bg ? await analyzeSafeArea(bg) : undefined;
    const content = blockContent(
      b.blockId,
      slotsBySeq[i],
      renderContextOf({
        band,
        theme: rp.theme,
        templateId: rp.templateId,
        brandName: BRAND,
        hasBackground: Boolean(bg),
        placement,
      }),
    );
    rendered.push(
      await renderBlock({
        content,
        background: bg,
        backgroundMediaType: 'image/png',
        placement,
        visualHeight: visualHeightOf(band),
      }),
    );
  }

  const composed = await composeDetail(rendered, outputProfile(c.platform));
  return {
    master: composed.master,
    width: composed.width,
    height: composed.totalHeight,
    blocks: plan.blocks.length,
    aiCalls,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const onlyIdx = argv.indexOf('--only');
  const only = onlyIdx >= 0 ? (argv[onlyIdx + 1] as TemplateId) : null;

  if (!existsSync(PRODUCT_SHOT)) {
    throw new Error(
      `가공 제품컷이 없습니다: ${path.relative(process.cwd(), PRODUCT_SHOT)}\n` +
        '먼저 `node --env-file-if-exists=.env .tmp-node/scripts/make-mock-product.js` 로 만들어 주세요.',
    );
  }
  const product = readFileSync(PRODUCT_SHOT);

  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`모드 — LLM ${currentLlmMode()} · 이미지 ${currentImageMode()}${force ? ' · 배경컷 강제 재생성' : ''}`);

  const cases = only ? CASES.filter((c) => c.id === only) : CASES;
  let totalBytes = 0;
  let totalCalls = 0;

  for (const c of cases) {
    console.log(`\n▸ ${c.id} (${c.category} / ${c.platform})`);
    const t0 = Date.now();
    const { master, width, height, blocks, aiCalls } = await buildOne(c, product, force);
    totalCalls += aiCalls;

    // 전체 세로 스트립 — 확대 모달(TemplateZoom)이 쓴다
    const webp = await sharp(master).resize({ width: PREVIEW_WIDTH }).webp({ quality: 78 }).toBuffer();
    const outPath = path.join(OUT_DIR, `preview-${c.id}.webp`);
    writeFileSync(outPath, webp);
    totalBytes += webp.length;

    // 카드용 상단 크롭 — 같은 master 에서 함께 굽는다(따로 만들면 둘이 어긋난다).
    // 카드는 74×168 CSS px 로 상단만 보여주는데, 전체 스트립은 592×5087 급이라
    // 300만 픽셀을 디코드해서 1만 2천 픽셀만 그리게 된다.
    const card = await sharp(master)
      .extract({ left: 0, top: 0, width, height: Math.min(Math.round((width * CARD_H) / CARD_W), height) })
      .resize({ width: CARD_W })
      .webp({ quality: 80 })
      .toBuffer();
    writeFileSync(path.join(OUT_DIR, `preview-${c.id}-card.webp`), card);
    totalBytes += card.length;

    const kb = (webp.length / 1024).toFixed(0);
    console.log(
      `  ${width}x${height} → ${PREVIEW_WIDTH}x${Math.round((height * PREVIEW_WIDTH) / width)} · ${kb}KB ` +
        `(카드 ${(card.length / 1024).toFixed(0)}KB) · ` +
        `블록 ${blocks}개 · 이미지 콜 ${aiCalls}회 · ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
    if (webp.length > 300 * 1024) console.log('  ⚠ 300KB 예산 초과 — PREVIEW_WIDTH 를 480 으로 낮추는 것을 검토하세요.');
  }

  console.log(
    `\n완료 — ${cases.length}장 · 합계 ${(totalBytes / 1024).toFixed(0)}KB · 이미지 콜 ${totalCalls}회\n` +
      `산출: ${path.relative(process.cwd(), OUT_DIR)}`,
  );
}

main().catch((err) => {
  console.error('실패:', err?.stack ?? err);
  process.exit(1);
});
