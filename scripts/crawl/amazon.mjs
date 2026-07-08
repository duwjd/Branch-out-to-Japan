/**
 * Amazon.co.jp 제품 썸네일 수집기 — 헤드리스 브라우저(Playwright).
 * 키워드 검색 결과에서 상품명·썸네일·ASIN 을 추출한다. API 키 불필요.
 *
 * 주의: Amazon 은 자동수집을 ToS로 제한하며 CAPTCHA를 띄울 수 있다. 소량·저속·내부분석용.
 *       검색결과 0개면 CAPTCHA/차단으로 보고 경고 후 다음 키워드로.
 * 가격은 접속 로케일에 따라 통화가 달라질 수 있어 신뢰하지 않는다(이미지·상품명이 목적).
 *
 * 산출: 이미지 → data/raw/product-thumbnails/amazon-jp/amazon_{ASIN}.jpg
 *       메타  → product-catalog.jsonl (source=amazon, type=thumbnail)
 *
 * 사용: node scripts/crawl/amazon.mjs [--per-category 80] [--category skincare] [--no-images]
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { sleep } from './lib/rakutenClient.mjs';
import { CATEGORIES } from './lib/categories.mjs';
import { REPO_ROOT, CATALOG_PATH, ensureDirs, loadExistingIds, appendRecords, downloadImage } from './lib/catalog.mjs';

const IMAGE_SUBDIR = 'raw/product-thumbnails/amazon-jp';
const NAV_DELAY_MS = 3000;
const RENDER_WAIT_MS = 3000;
const RESULTS_PER_PAGE = 48; // Amazon 검색결과 대략치
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const out = { perCategory: 80, downloadImages: true, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--per-category') out.perCategory = Number(argv[++i]);
    else if (a === '--no-images') out.downloadImages = false;
    else if (a === '--category') out.only = argv[++i];
  }
  return out;
}

/** Amazon 이미지 크기 토큰(._AC_UL320_.) 제거 → 풀해상도. */
function fullResImage(url) {
  return String(url ?? '').replace(/\._[A-Z0-9_,]+_\./i, '.');
}

function searchUrl(keyword, page) {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&page=${page}`;
}

/** 검색결과 카드에서 상품 원자료 추출(브라우저 컨텍스트). */
function extractOnPage(page) {
  return page.evaluate(() => {
    const rows = [];
    for (const el of document.querySelectorAll('[data-component-type="s-search-result"]')) {
      const asin = el.getAttribute('data-asin');
      const name = el.querySelector('h2')?.textContent?.trim().replace(/\s+/g, ' ') ?? '';
      const img = el.querySelector('img.s-image')?.src ?? '';
      if (asin && img && name) rows.push({ asin, name, img });
    }
    // CAPTCHA/차단 감지
    const blocked = /検証|ロボットではありません|captcha|Enter the characters/i.test(document.body?.innerText || '');
    return { rows, blocked };
  });
}

function toRecord(raw, { category, collectedAt }) {
  return {
    id: `amazon_${raw.asin}`,
    source: 'amazon',
    type: 'thumbnail',
    productName: raw.name,
    brand: '',
    category,
    price: null, // 로케일 의존 → 미신뢰
    sourceUrl: `https://www.amazon.co.jp/dp/${raw.asin}`,
    imageUrl: fullResImage(raw.img),
    localPath: `raw/product-thumbnails/amazon-jp/amazon_${raw.asin}.jpg`,
    collectedAt,
    license: '브랜드/셀러 저작물 — 내부 분석용',
    via: 'browser',
  };
}

async function collectCategory(page, { category, keywords }, { perCategory, seenIds, collectedAt }) {
  const collected = [];
  const perKeyword = Math.ceil(perCategory / keywords.length);
  for (const keyword of keywords) {
    let got = 0;
    const maxPages = Math.ceil(perKeyword / RESULTS_PER_PAGE) + 1;
    for (let p = 1; p <= maxPages && got < perKeyword; p++) {
      try {
        const resp = await page.goto(searchUrl(keyword, p), { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
      } catch (err) {
        logger.warn('페이지 이동 실패 — 다음 키워드', { keyword, p, reason: String(err.message ?? err) });
        break;
      }
      await page.waitForTimeout(RENDER_WAIT_MS);
      const { rows, blocked } = await extractOnPage(page);
      if (blocked) { logger.warn('CAPTCHA/차단 감지 — 다음 키워드', { keyword, p }); break; }
      if (rows.length === 0) { logger.warn('상품 0개 — 결과끝/차단', { keyword, p }); break; }
      for (const raw of rows) {
        const record = toRecord(raw, { category, collectedAt });
        if (seenIds.has(record.id)) continue;
        seenIds.add(record.id);
        collected.push(record);
        got++;
        if (got >= perKeyword) break;
      }
      logger.info('페이지 수집', { category, keyword, p, found: rows.length, running: collected.length });
      await sleep(NAV_DELAY_MS);
    }
  }
  return collected;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureDirs(IMAGE_SUBDIR);
  const collectedAt = new Date().toISOString().slice(0, 10);
  const seenIds = await loadExistingIds();
  logger.info('시작(Amazon)', { perCategory: args.perCategory, downloadImages: args.downloadImages, existing: seenIds.size });

  const targets = args.only ? CATEGORIES.filter((c) => c.category === args.only) : CATEGORIES;
  if (targets.length === 0) {
    logger.error('일치하는 카테고리 없음', { only: args.only, available: CATEGORIES.map((c) => c.category) });
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ja-JP' });
  const page = await ctx.newPage();

  let totalNew = 0, totalImages = 0;
  try {
    for (const cat of targets) {
      const records = await collectCategory(page, cat, { perCategory: args.perCategory, seenIds, collectedAt });
      await appendRecords(records);
      totalNew += records.length;
      logger.info('카테고리 완료', { category: cat.category, newRecords: records.length });
      if (args.downloadImages) {
        for (const record of records) {
          if (await downloadImage(record)) totalImages++;
          await sleep(400);
        }
      }
    }
  } finally {
    await browser.close();
  }
  logger.info('완료', { newRecords: totalNew, imagesDownloaded: totalImages, catalog: path.relative(REPO_ROOT, CATALOG_PATH) });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
