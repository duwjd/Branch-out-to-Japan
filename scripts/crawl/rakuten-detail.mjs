/**
 * 라쿠텐 상세페이지 소구 이미지 수집기 — 헤드리스 브라우저(Playwright).
 * ①(rakuten-browser.mjs / rakuten.mjs)이 모은 product-catalog.jsonl 의 sourceUrl 로
 * 상품 상세페이지에 들어가, 셀러가 만든 상세 소구 이미지(카피 포함)를 추출한다.
 * → 일본향 메시지·비주얼 관례 분석에 가장 값진 자료.
 *
 * 표본: 상점(brand 대용)당 1개 상품, 카테고리 라운드로빈, 총 --limit 개(기본 50).
 *       (전량 크롤은 부하·용량 과대 → 중간 규모 표본. 상세 브랜드당 1~3 원칙.)
 *
 * 산출: 이미지 → data/raw/product-detail/rakuten/{productId}/{n}.jpg
 *       메타  → product-catalog.jsonl 에 type=detail 레코드 append
 *
 * 사용:
 *   node scripts/crawl/rakuten-detail.mjs                  # 표본 50개 상품
 *   node scripts/crawl/rakuten-detail.mjs --limit 20 --category skincare
 *   node scripts/crawl/rakuten-detail.mjs --max-images 6   # 상품당 상세 이미지 상한
 */

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { sleep } from './lib/rakutenClient.mjs';
import { REPO_ROOT, CATALOG_PATH, loadExistingIds, appendRecords, downloadImage } from './lib/catalog.mjs';

const NAV_DELAY_MS = 3000;
const RENDER_WAIT_MS = 2500;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const out = { limit: 50, maxImages: 8, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--max-images') out.maxImages = Number(argv[++i]);
    else if (a === '--category') out.only = argv[++i];
  }
  return out;
}

/** id(rakuten_{shop}_{code})에서 shop 추출. */
function shopOf(id) {
  return String(id).split('_')[1] ?? '';
}

/** 카탈로그의 썸네일 레코드를 읽어 상점당 1개·카테고리 라운드로빈으로 표본 선정. */
async function pickSamples({ limit, only }) {
  const text = await readFile(CATALOG_PATH, 'utf8');
  const byCat = new Map();
  for (const l of text.split('\n')) {
    if (!l.trim()) continue;
    let r;
    try { r = JSON.parse(l); } catch { continue; }
    if (r.type !== 'thumbnail') continue;
    if (only && r.category !== only) continue;
    if (!r.sourceUrl) continue;
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category).push(r);
  }
  const cats = [...byCat.keys()];
  const ptr = new Map(cats.map((c) => [c, 0]));
  const seenShops = new Set();
  const picks = [];
  let exhausted = false;
  while (picks.length < limit && !exhausted) {
    exhausted = true;
    for (const cat of cats) {
      const list = byCat.get(cat);
      let i = ptr.get(cat);
      while (i < list.length) {
        const r = list[i++];
        const shop = shopOf(r.id);
        if (!seenShops.has(shop)) { seenShops.add(shop); picks.push(r); break; }
      }
      ptr.set(cat, i);
      if (i < list.length) exhausted = false;
      if (picks.length >= limit) break;
    }
  }
  return picks;
}

/** 상세페이지에서 셀러 소구 이미지 URL을 추출(브라우저 컨텍스트). 배너·아이콘 필터링. */
function extractDetailImages(page) {
  return page.evaluate(() => {
    const bannerHost = ['cdn.rmc.contents.rakuten.co.jp', 'r.r10s.jp/com/img', 'r10s.jp/com/'];
    const urls = new Set();
    const containers = document.querySelectorAll('.sale_desc, .item_desc, #item_desc, [class*="itemDesc"]');
    for (const c of containers) {
      for (const img of c.querySelectorAll('img')) {
        const src = img.currentSrc || img.src;
        if (!src) continue;
        const w = img.naturalWidth, h = img.naturalHeight;
        if (w < 400 || h < 300) continue;          // 얇은 배너·아이콘 제외
        if (h < w * 0.35) continue;                 // 가로로 매우 긴 배너 제외
        if (bannerHost.some((b) => src.includes(b))) continue;
        urls.add(src);
      }
    }
    return [...urls];
  });
}

/** 지연로딩 이미지를 강제로 불러오도록 페이지 하단까지 스크롤. */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = 800;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        y += step;
        if (y >= document.body.scrollHeight - window.innerHeight) { clearInterval(timer); resolve(); }
      }, 200);
    });
  });
  await page.waitForTimeout(1000);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(CATALOG_PATH)) {
    logger.error('product-catalog.jsonl 없음. 먼저 ①(rakuten-browser.mjs)을 실행하세요.');
    process.exit(1);
  }
  const collectedAt = new Date().toISOString().slice(0, 10);
  const seenIds = await loadExistingIds();
  const samples = await pickSamples(args);
  logger.info('시작(상세)', { samples: samples.length, maxImagesPerProduct: args.maxImages });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ja-JP' });
  const page = await ctx.newPage();

  let totalDetailImgs = 0;
  let processed = 0;
  try {
    for (const prod of samples) {
      processed++;
      try {
        const resp = await page.goto(prod.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
      } catch (err) {
        logger.warn('상세 이동 실패', { id: prod.id, reason: String(err.message ?? err) });
        continue;
      }
      await page.waitForTimeout(RENDER_WAIT_MS);
      await autoScroll(page);
      const imgUrls = (await extractDetailImages(page)).slice(0, args.maxImages);

      const records = imgUrls.map((imageUrl, n) => ({
        id: `${prod.id}_d${n + 1}`,
        source: 'rakuten',
        type: 'detail',
        parentId: prod.id,
        productName: prod.productName,
        category: prod.category,
        sourceUrl: prod.sourceUrl,
        imageUrl,
        localPath: `raw/product-detail/rakuten/${prod.id}/${n + 1}.jpg`,
        collectedAt,
        license: '브랜드/셀러 저작물 — 내부 분석용',
        via: 'browser',
      })).filter((r) => !seenIds.has(r.id));

      records.forEach((r) => seenIds.add(r.id));
      await appendRecords(records);
      for (const r of records) {
        if (await downloadImage(r)) totalDetailImgs++;
        await sleep(400);
      }
      logger.info('상세 수집', { n: `${processed}/${samples.length}`, id: prod.id, images: records.length });
      await sleep(NAV_DELAY_MS);
    }
  } finally {
    await browser.close();
  }

  logger.info('완료', { products: processed, detailImages: totalDetailImgs, catalog: path.relative(REPO_ROOT, CATALOG_PATH) });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
