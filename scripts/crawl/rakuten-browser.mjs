/**
 * 라쿠텐 이치바 제품 썸네일 수집기 — 헤드리스 브라우저(Playwright) 버전.
 * API 키 없이 검색결과 페이지를 실제 브라우저로 렌더링해 상품을 추출한다.
 *
 * 주의(설계 원칙):
 *  - 소량·저속·실제 UA 로 JS 렌더링만 한다. CAPTCHA 우회·핑거프린트 스푸핑은 하지 않는다.
 *  - 라쿠텐 ToS 상 자동수집은 회색지대이며 사이트 구조 변경에 취약하다.
 *    안정·합법 경로는 무료 API 버전(rakuten.mjs). 이 스크립트는 키 없이 쓰려는 경우의 대안.
 *  - id 포맷을 API 버전과 맞춰(rakuten_{shop}_{code}) 카탈로그가 교차 중복제거된다.
 *
 * 사용:
 *   node scripts/crawl/rakuten-browser.mjs
 *   node scripts/crawl/rakuten-browser.mjs --per-category 100 --category skincare
 *   node scripts/crawl/rakuten-browser.mjs --per-category 5 --no-images --headful   # 눈으로 확인
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { sleep } from './lib/rakutenClient.mjs';
import { CATEGORIES } from './lib/categories.mjs';
import { REPO_ROOT, CATALOG_PATH, ensureDirs, loadExistingIds, appendRecords, downloadImage } from './lib/catalog.mjs';

const IMAGE_SUBDIR = 'raw/product-thumbnails/rakuten';
const NAV_DELAY_MS = 2500; // 페이지 이동 간 딜레이(저속)
const RENDER_WAIT_MS = 3500; // 렌더 대기
const IMAGES_PER_PAGE = 45; // 검색결과 1페이지에 대략 표시되는 상품 수
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** @returns {{perCategory:number, downloadImages:boolean, only:string|null, headful:boolean}} */
function parseArgs(argv) {
  const out = { perCategory: 150, downloadImages: true, only: null, headful: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--per-category') out.perCategory = Number(argv[++i]);
    else if (a === '--no-images') out.downloadImages = false;
    else if (a === '--category') out.only = argv[++i];
    else if (a === '--headful') out.headful = true;
  }
  return out;
}

/** 검색 URL(키워드 URL 인코딩 + 페이지). */
function searchUrl(keyword, page) {
  const kw = encodeURIComponent(keyword);
  return `https://search.rakuten.co.jp/search/mall/${kw}/?p=${page}`;
}

/** 썸네일 URL 화질을 키운다(r10s CDN 은 ?fitin=WxH 로 리사이즈). */
function upscaleImage(url) {
  if (!url) return '';
  return url.replace(/\?fitin=\d+:\d+/, '?fitin=600:600');
}

/** 상품 URL → 안정적 id/파일명. 예: /tvert/352/ → rakuten_tvert_352 */
function idFromUrl(productUrl) {
  try {
    const segs = new URL(productUrl).pathname.split('/').filter(Boolean);
    const base = segs.slice(0, 2).join('_') || 'unknown';
    return `rakuten_${base}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  } catch {
    return null;
  }
}

/** "2,100円送料無料" → 2100 (첫 숫자열). @returns {number|null} */
function parsePrice(text) {
  const m = String(text ?? '').match(/[\d,]+/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * 현재 렌더된 검색결과 페이지에서 상품 원자료를 추출(브라우저 컨텍스트에서 실행).
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{imageUrl:string, productUrl:string, productName:string, priceText:string}>>}
 */
function extractItemsOnPage(page) {
  return page.evaluate(() => {
    const rows = [];
    for (const card of document.querySelectorAll('.searchresultitem')) {
      const img = card.querySelector('img');
      const link = [...card.querySelectorAll('a')].find((a) => a.href.includes('item.rakuten.co.jp'));
      const priceEl = card.querySelector('[class*="price"]');
      if (!link || !img) continue;
      rows.push({
        imageUrl: img.src || img.getAttribute('data-src') || '',
        productUrl: link.href,
        productName: (link.textContent || img.alt || '').trim().replace(/\s+/g, ' '),
        priceText: priceEl?.textContent?.trim() ?? '',
      });
    }
    return rows;
  });
}

/** 원자료 → 카탈로그 레코드. 유효하지 않으면 null. */
function toRecord(raw, { category, collectedAt }) {
  const id = idFromUrl(raw.productUrl);
  if (!id) return null;
  const safe = id.replace(/^rakuten_/, '');
  return {
    id,
    source: 'rakuten',
    type: 'thumbnail',
    productName: raw.productName,
    brand: '', // 검색결과 카드엔 상점명이 안정적으로 안 나옴(상세에서 보강 가능)
    category,
    price: parsePrice(raw.priceText),
    reviewCount: null,
    sourceUrl: raw.productUrl,
    imageUrl: upscaleImage(raw.imageUrl),
    localPath: `raw/product-thumbnails/rakuten/rakuten_${safe}.jpg`,
    collectedAt,
    license: '브랜드/셀러 저작물 — 내부 분석용',
    via: 'browser',
  };
}

/** 한 카테고리를 목표 수량까지 수집. */
async function collectCategory(page, { category, keywords }, { perCategory, seenIds, collectedAt }) {
  const collected = [];
  const perKeyword = Math.ceil(perCategory / keywords.length);
  for (const keyword of keywords) {
    let got = 0;
    const maxPages = Math.ceil(perKeyword / IMAGES_PER_PAGE) + 1;
    for (let p = 1; p <= maxPages && got < perKeyword; p++) {
      try {
        const resp = await page.goto(searchUrl(keyword, p), { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
      } catch (err) {
        logger.warn('페이지 이동 실패 — 다음 키워드', { keyword, p, reason: String(err.message ?? err) });
        break;
      }
      await page.waitForTimeout(RENDER_WAIT_MS);
      const raws = await extractItemsOnPage(page);
      if (raws.length === 0) {
        logger.warn('상품 0개 — 차단 또는 결과 끝 가능', { keyword, p });
        break;
      }
      for (const raw of raws) {
        const record = toRecord(raw, { category, collectedAt });
        if (!record || seenIds.has(record.id)) continue;
        seenIds.add(record.id);
        collected.push(record);
        got++;
        if (got >= perKeyword) break;
      }
      logger.info('페이지 수집', { category, keyword, p, found: raws.length, running: collected.length });
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
  logger.info('시작(브라우저)', { perCategory: args.perCategory, downloadImages: args.downloadImages, existing: seenIds.size });

  const targets = args.only ? CATEGORIES.filter((c) => c.category === args.only) : CATEGORIES;
  if (targets.length === 0) {
    logger.error('일치하는 카테고리 없음', { only: args.only, available: CATEGORIES.map((c) => c.category) });
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: !args.headful });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ja-JP' });
  const page = await ctx.newPage();

  let totalNew = 0;
  let totalImages = 0;
  try {
    for (const cat of targets) {
      const records = await collectCategory(page, cat, { perCategory: args.perCategory, seenIds, collectedAt });
      await appendRecords(records); // 이미지 실패와 무관하게 메타는 먼저 보존
      totalNew += records.length;
      logger.info('카테고리 완료', { category: cat.category, newRecords: records.length });

      if (args.downloadImages) {
        for (const record of records) {
          const ok = await downloadImage(record);
          if (ok) totalImages++;
          await sleep(400); // 이미지 CDN 은 API 서버보다 부담 적음
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
