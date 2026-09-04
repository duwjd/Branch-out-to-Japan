/**
 * 상세페이지 파이프라인 CLI 러너 — 화면 없이 엔진만 돌린다(run-thumbnail.ts 관례).
 * 목 모드에서는 AI 콜 0으로 상세페이지 한 장이 끝까지 나온다.
 *
 * 사용:
 *   npm run detail:cli                      # skincare 데모
 *   npm run detail:cli -- --category makeup --platform qoo10 --colors 8
 *   npm run detail:cli -- --no-promo --no-proof     # 게이트로 블록이 빠지는 걸 확인
 *
 * 산출: .data/detail-cli/{master.jpg, slice-N.jpg, block-N.png, plan.json}
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  assembleBlockSlots,
  buildBlockPrompt,
  checkFootnoteIntegrity,
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
import { buildRenderPlan, promptContextOf, renderContextOf, visualHeightOf } from '../lib/studio/detail/renderContext';
import { analyzeSafeArea, type CopyPlacement } from '../lib/studio/detail/safeArea';
import { toneSummary } from '../lib/studio/detail/rhythm';
import { blockContent } from '../lib/studio/detail/templates';
import type { Platform } from '../lib/studio/platform';

const OUT_DIR = path.join(process.cwd(), '.data', 'detail-cli');

interface Args {
  category: ProductCategory;
  platform: Platform;
  template?: TemplateId;
  colors: number;
  promo: boolean;
  proof: boolean;
  brand: string;
  /** 제품 대표컷 경로 — 실 모드에서 AI 배경컷의 편집 원본이 된다 */
  image: string | null;
  /** 이전 실행의 배경컷을 재사용한다(렌더·레이아웃만 재검증할 때 — 이미지 비용 0) */
  reuseVisuals: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    category: 'skincare',
    platform: 'rakuten-official',
    colors: 0,
    promo: true,
    proof: true,
    brand: 'HARUON',
    image: null,
    reuseVisuals: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--category') out.category = argv[++i] as ProductCategory;
    else if (a === '--platform') out.platform = argv[++i] as Platform;
    else if (a === '--template') out.template = argv[++i] as TemplateId;
    else if (a === '--colors') out.colors = Number(argv[++i]);
    else if (a === '--no-promo') out.promo = false;
    else if (a === '--no-proof') out.proof = false;
    else if (a === '--brand') out.brand = argv[++i];
    else if (a === '--image') out.image = argv[++i];
    else if (a === '--reuse-visuals') out.reuseVisuals = true;
  }
  return out;
}

function demoInput(args: Args): DetailInput {
  return {
    productCategory: args.category,
    sourceImagePaths: [],
    disabledBlocks: [],
    spec: {
      volume: '30mL',
      category: '化粧品',
      manufacturer: `株式会社${args.brand}`,
      origin: '韓国',
      fullIngredients: '水、BG、グリセリン、ナイアシンアミド、ヒアルロン酸Na、トコフェロール',
    },
    ingredients: [
      { name: 'ナイアシンアミド', percent: '2%', purpose: '整肌成分' },
      { name: 'ヒアルロン酸Na', percent: '—', purpose: '保湿成分' },
    ],
    freeOf: ['合成香料', '鉱物油', 'パラベン', 'エタノール', '合成着色料'],
    specs:
      args.category === 'suncare'
        ? [
            { label: 'SPF', value: '50+' },
            { label: 'PA', value: '++++' },
          ]
        : [],
    howToSteps: [
      '洗顔後、化粧水で肌をととのえます。',
      '適量を手にとり、顔全体になじませます。',
      '気になる部分は重ねづけしてください。',
    ],
    options: Array.from({ length: args.colors }, (_, i) => ({
      axis: 'color' as const,
      name: `カラー${String(i + 1).padStart(2, '0')}`,
      swatchHex: ['#c86b5a', '#b8564d', '#d98a76', '#a34b58', '#e0a08c', '#8f4550', '#cf7d6b', '#b96a72'][i % 8],
      sku: `SHADE ${i + 1}`,
    })),
    cautions: [
      'お肌に異常が生じないかよく注意してご使用ください。',
      '傷やはれもの、湿疹等、異常のある部位にはお使いにならないでください。',
    ],
    proof: args.proof
      ? { rankTitle: '楽天ランキング1位', genre: '美容液部門', aggregationDate: '2026年7月14日更新' }
      : null,
    sales: args.proof ? { count: '累計163,991個', period: '2022.5/19-2026.4/29' } : null,
    test: args.proof
      ? {
          name: '効能評価試験済み',
          condition: '4週間連用試験',
          institution: '第三者評価機関',
          date: '2026.04.15',
          sampleSize: '21名',
        }
      : null,
    reviews: [{ text: 'べたつかず、朝のメイクのりが安定しました。', rating: '★5', age: '30代' }],
    promo: args.promo
      ? {
          setTitle: '2個セット',
          salePrice: '1,920',
          normalPrice: '2,610',
          normalPriceVerified: true,
          discountRate: '26',
          gift: 'ミニサイズ1本',
          qualifierChips: ['7/7 0:00〜7/11 9:59'],
          footnote: 'クーポン適用時の価格です。',
        }
      : null,
    modelConsent: false,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = demoInput(args);
  mkdirSync(OUT_DIR, { recursive: true });

  const plan = planBlocks(input, args.platform, args.template);
  // 밴드 리듬·테마도 잡 러너와 같은 함수로 확정한다 — 안 하면 프리뷰 카드와 산출물이 어긋난다
  const rp = buildRenderPlan(input, args.platform, plan.templateId);
  console.log(`밴드 리듬: ${toneSummary(rp.layout)} · accent ${rp.theme.accent}`);
  console.log(`템플릿 ${plan.templateId} · 블록 ${plan.blocks.length}개 · AI 블록 ${plan.aiBlockCount}개`);
  console.log('포함:', plan.blocks.map((b) => `${b.code} ${b.nameKo}`).join(' → '));
  if (plan.excluded.length) {
    console.log('제외:');
    for (const e of plan.excluded)
      console.log(`  - ${e.code} ${e.nameKo}: ${e.reason}${e.fixHint ? ` [${e.fixHint}]` : ''}`);
  }

  const llmMode = currentLlmMode();
  const imageMode = currentImageMode();
  console.log(`모드 — LLM ${llmMode} · 이미지 ${imageMode}`);

  // 제품 대표컷(선택) — 실 모드에서 비전 입력·배경컷 편집 원본이 된다
  const productBuf = args.image
    ? readFileSync(path.isAbsolute(args.image) ? args.image : path.join(process.cwd(), args.image))
    : null;
  const productMediaType = args.image?.endsWith('.png') ? 'image/png' : 'image/jpeg';

  // 슬롯 채움 — 실 모드면 콜⑦, 아니면 픽스처
  const tCopy = Date.now();
  let llmByBlock = new Map<string, Record<string, string>>();
  let narrativeReason = '';
  if (llmMode === 'real' && productBuf) {
    const copy = await runDetailCopy({
      templateId: plan.templateId,
      blocks: plan.blocks,
      input,
      platform: args.platform,
      brandName: args.brand,
      images: [
        { mediaType: productMediaType as 'image/png' | 'image/jpeg', dataBase64: productBuf.toString('base64') },
      ],
    });
    llmByBlock = new Map(copy.blocks.map((b) => [b.blockId, Object.fromEntries(b.slots.map((x) => [x.key, x.value]))]));
    narrativeReason = copy.narrativeReason;
    console.log(`콜⑦ detailCopy — ${Date.now() - tCopy}ms · 블록 ${copy.blocks.length}개 슬롯 채움`);
    console.log(`  구성 근거: ${narrativeReason}`);
  } else {
    llmByBlock = new Map(
      plan.blocks.map((b) => [b.blockId, mockLlmSlots(b.blockId, input.productCategory, args.brand)]),
    );
  }

  const reg = createFootnoteRegistry();
  const slotsBySeq = plan.blocks.map((b) => assembleBlockSlots(b, llmByBlock.get(b.blockId) ?? {}, input, reg));

  const integrity = checkFootnoteIntegrity(slotsBySeq, reg);
  console.log(
    `각주 정합: ${integrity.ok ? 'OK' : 'FAIL'} (등록 ${reg.entries.length} · 고아 ${integrity.orphans.length} · 미사용 ${integrity.unused.length})`,
  );
  if (!integrity.ok) console.log('  고아 마커:', integrity.orphans.join(', '));

  // AI 배경컷 — 동시성 제한. 텍스트 블록은 콜 0
  const tImg = Date.now();
  const gate = limit(IMAGE_CONCURRENCY);
  const visuals = new Map<string, Buffer>();
  const aiBlocks = plan.blocks.filter((b) => b.renderKind !== 'text');
  if (aiBlocks.length > 0) {
    await Promise.all(
      aiBlocks.map((b) =>
        gate(async () => {
          const cachePath = path.join(OUT_DIR, `visual-${b.blockId}.png`);
          if (args.reuseVisuals && existsSync(cachePath)) {
            visuals.set(b.blockId, readFileSync(cachePath));
            return;
          }
          const i = plan.blocks.indexOf(b);
          const prompt = buildBlockPrompt(b.blockId, slotsBySeq[i], promptContextOf(rp, input, Boolean(productBuf)));
          const usesProduct = usesProductSource(b.blockId as BlockType);
          const gen = await generateBlockVisual({
            prompt,
            blockType: b.blockId as BlockType,
            source: usesProduct && productBuf ? productBuf : undefined,
            sourceMediaType: usesProduct && productBuf ? productMediaType : undefined,
          });
          visuals.set(b.blockId, gen.buf);
          writeFileSync(cachePath, gen.buf); // 재실행 시 --reuse-visuals 로 비용 없이 재검증
        }),
      ),
    );
    console.log(
      `배경컷 ${aiBlocks.length}장 (동시성 ${IMAGE_CONCURRENCY}${args.reuseVisuals ? ' · 캐시 재사용' : ''}) — ${Date.now() - tImg}ms`,
    );
  }

  // 블록 렌더
  const t0 = Date.now();
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
        brandName: args.brand,
        hasBackground: Boolean(bg),
        placement,
      }),
    );
    const out = await renderBlock({
      content,
      background: bg,
      backgroundMediaType: 'image/png',
      placement,
      visualHeight: visualHeightOf(band),
    });
    rendered.push(out);
    writeFileSync(path.join(OUT_DIR, `block-${String(i).padStart(2, '0')}-${b.blockId}.png`), out.png);
  }
  console.log(`블록 렌더 ${rendered.length}개 — ${Date.now() - t0}ms`);

  const profile = outputProfile(args.platform);
  const t1 = Date.now();
  const composed = await composeDetail(rendered, profile);
  writeFileSync(path.join(OUT_DIR, 'master.jpg'), composed.master);
  composed.slices.forEach((s, i) =>
    writeFileSync(path.join(OUT_DIR, `slice-${String(i + 1).padStart(2, '0')}.jpg`), s),
  );
  writeFileSync(
    path.join(OUT_DIR, 'plan.json'),
    JSON.stringify(
      {
        plan,
        narrativeReason,
        footnotes: reg.entries,
        integrity,
        output: { ...composed, master: undefined, slices: composed.slices.length },
      },
      null,
      2,
    ),
  );

  console.log(
    `결합 ${composed.width}x${composed.totalHeight} → master ${(composed.master.length / 1024 / 1024).toFixed(2)}MB · ` +
      `분할 ${composed.slices.length}장(최대 ${(Math.max(...composed.slices.map((s) => s.length)) / 1024).toFixed(0)}KB) — ${Date.now() - t1}ms`,
  );
  if (composed.truncated) console.log('⚠', composed.truncated);
  console.log(`산출: ${path.relative(process.cwd(), OUT_DIR)}`);
}

main().catch((err) => {
  console.error('실패:', err?.stack ?? err);
  process.exit(1);
});
