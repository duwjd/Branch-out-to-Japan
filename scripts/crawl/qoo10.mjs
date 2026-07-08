/**
 * Qoo10 재팬 뷰티 썸네일 수집기 — 헤드리스 브라우저(Playwright).
 * 우리 페르소나의 주력 채널. 키워드 검색이 랭킹으로 리다이렉트되므로
 * 뷰티 카테고리 랭킹 페이지를 스크롤하며 상품 이미지(gd.image-qoo10.jp)+alt(상품명)를 수집한다.
 *
 * 주의: Qoo10 은 비브라우저 요청을 차단(523)한다. 헤드리스로만 접근. 소량·저속·내부분석용.
 *
 * 산출: 이미지 → data/raw/product-thumbnails/qoo10/qoo10_{id}.jpg
 *       메타  → product-catalog.jsonl (source=qoo10, type=thumbnail)
 *
 * 사용: node scripts/crawl/qoo10.mjs [--target 200] [--no-images]
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { sleep } from './lib/rakutenClient.mjs';
import { REPO_ROOT, CATALOG_PATH, ensureDirs, loadExistingIds, appendRecords, downloadImage } from './lib/catalog.mjs';

const IMAGE_SUBDIR = 'raw/product-thumbnails/qoo10';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Qoo10 뷰티 랭킹 페이지. ※ Qoo10 랭킹은 상위 노출 상품만 렌더(나머지는 탭 XHR)라
//   한 페이지당 20~30개 수준. 고품질이나 수량 제한적 → 페르소나 채널 레퍼런스 샘플.
const PAGES = [
  { category: 'beauty', url: 'https://www.qoo10.jp/gmkt.inc/Bestsellers/?g=2&global_yn=N' },
  { category: 'beauty', url: 'https://www.qoo10.jp/gmkt.inc/Bestsellers/?g=2' },
];

function parseArgs(argv) {
  const out = { target: 200, downloadImages: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target') out.target = Number(argv[++i]);
    else if (argv[i] === '--no-images') out.downloadImages = false;
  }
  return out;
}

/** Qoo10 이미지 URL에서 상품 id 추출. .../8364863175.g_150-w-st_g → 8364863175 */
function idFromImg(url) {
  const m = String(url).match(/\/(\d{6,})\.g_/);
  return m ? m[1] : null;
}

/** 썸네일 화질 업스케일(.g_150 → .g_300). */
function upscale(url) {
  return String(url).replace(/\.g_\d+/, '.g_300');
}

/** 지연로딩 상품을 불러오도록 하단까지 반복 스크롤. */
async function autoScroll(page, rounds = 12) {
  for (let i = 0; i < rounds; i++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }
}

/** 현재 페이지에서 상품 이미지+상품명 추출(카테고리 탭 등 노이즈 제외). */
function extractOnPage(page) {
  return page.evaluate(() => {
    const rows = [];
    for (const img of document.querySelectorAll('img')) {
      const src = img.currentSrc || img.src || '';
      if (!/gd\.image-qoo10\.jp/.test(src)) continue;
      const name = (img.alt || '').trim().replace(/\s+/g, ' ');
      if (name.length < 4) continue; // 카테고리 아이콘 등 제외
      const a = img.closest('a');
      const href = a?.href || '';
      if (/Bestsellers\/\?g=\d+$/.test(href)) continue; // 카테고리 탭 썸네일 제외
      rows.push({ src, name, href });
    }
    return rows;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureDirs(IMAGE_SUBDIR);
  const collectedAt = new Date().toISOString().slice(0, 10);
  const seenIds = await loadExistingIds();
  logger.info('시작(Qoo10)', { target: args.target, downloadImages: args.downloadImages, existing: seenIds.size });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ja-JP' });
  const page = await ctx.newPage();

  const collected = [];
  try {
    for (const { category, url } of PAGES) {
      if (collected.length >= args.target) break;
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
        if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
      } catch (err) {
        logger.warn('페이지 이동 실패', { url, reason: String(err.message ?? err) });
        continue;
      }
      await page.waitForTimeout(3000);
      await autoScroll(page);
      const rows = await extractOnPage(page);
      let added = 0;
      for (const raw of rows) {
        const id = idFromImg(raw.src);
        if (!id) continue;
        const recId = `qoo10_${id}`;
        if (seenIds.has(recId)) continue;
        seenIds.add(recId);
        collected.push({
          id: recId,
          source: 'qoo10',
          type: 'thumbnail',
          productName: raw.name,
          brand: '',
          category,
          price: null,
          sourceUrl: raw.href || url,
          imageUrl: upscale(raw.src),
          localPath: `raw/product-thumbnails/qoo10/${recId}.jpg`,
          collectedAt,
          license: '브랜드/셀러 저작물 — 내부 분석용',
          via: 'browser',
        });
        added++;
        if (collected.length >= args.target) break;
      }
      logger.info('페이지 수집', { category, found: rows.length, added, running: collected.length });
      await sleep(2500);
    }
    await appendRecords(collected);

    let totalImages = 0;
    if (args.downloadImages) {
      for (const record of collected) {
        if (await downloadImage(record)) totalImages++;
        await sleep(400);
      }
    }
    logger.info('완료', { newRecords: collected.length, imagesDownloaded: totalImages, catalog: path.relative(REPO_ROOT, CATALOG_PATH) });
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
