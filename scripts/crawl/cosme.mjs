/**
 * @cosme(アットコスメ) 뷰티 어휘 수집기 — 헤드리스 브라우저(Playwright).
 * 랭킹 페이지에서 인기 제품명·브랜드명을 모아 일본 뷰티 문구/단어 코퍼스를 만든다.
 * (③ SNS 유행어/뷰티 컨텐츠 문구 수집의 소스. @cosme는 Shift_JIS지만 브라우저 렌더로 무관.)
 *
 * 산출: data/raw/sns-copy/cosme/cosme-{date}.tsv  (type<TAB>text)
 *   → build-lexicon.mjs 가 이 원자료 + 라쿠텐 상품명을 스캔해 sns-lexicon.csv 를 만든다.
 *
 * 사용:
 *   node scripts/crawl/cosme.mjs                 # 랭킹 페이지들 자동 탐색·수집
 *   node scripts/crawl/cosme.mjs --pages 8       # 방문할 랭킹 페이지 수
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { sleep } from './lib/rakutenClient.mjs';
import { REPO_ROOT } from './lib/catalog.mjs';

const OUT_DIR = path.join(REPO_ROOT, 'data/raw/sns-copy/cosme');
const START_URL = 'https://www.cosme.net/ranking/';
const NAV_DELAY_MS = 2500;
const RENDER_WAIT_MS = 3000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 제품명이 아닌 UI/노이즈 문자열 제외 목록. */
const STOP = new Set(['購入サイトへ', 'クチコミ', 'もっと見る', '詳細を見る', 'お気に入り', '公式', 'PR']);

/** @returns {{pages:number}} */
function parseArgs(argv) {
  const out = { pages: 8 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pages') out.pages = Number(argv[++i]);
  }
  return out;
}

/** 유효한 뷰티 텍스트인가(숫자·UI·너무짧음 제외). */
function isMeaningful(text) {
  if (!text || text.length < 2 || text.length > 40) return false;
  if (/^\d+$/.test(text)) return false; // 순위번호 등
  if (STOP.has(text)) return false;
  return /[぀-ゟ゠-ヿ一-龯A-Za-z]/.test(text); // 일본어/영문 포함
}

/** 현재 페이지에서 제품명·브랜드명·랭킹링크를 추출(브라우저 컨텍스트). */
function extractOnPage(page) {
  return page.evaluate(() => {
    const pick = (sel) => [...document.querySelectorAll(sel)].map((a) => a.textContent.trim().replace(/\s+/g, ' '));
    return {
      products: pick('a[href*="/products/"]'),
      brands: pick('a[href*="/brands/"]'),
      rankingLinks: [...document.querySelectorAll('a[href*="/ranking/"]')].map((a) => a.href),
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });
  const collectedAt = new Date().toISOString().slice(0, 10);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ja-JP' });
  const page = await ctx.newPage();

  const queue = [START_URL];
  const visited = new Set();
  /** @type {Map<string,'product'|'brand'>} */
  const terms = new Map();

  try {
    while (queue.length > 0 && visited.size < args.pages) {
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
      } catch (err) {
        logger.warn('페이지 이동 실패', { url, reason: String(err.message ?? err) });
        continue;
      }
      await page.waitForTimeout(RENDER_WAIT_MS);
      const { products, brands, rankingLinks } = await extractOnPage(page);
      for (const t of products) if (isMeaningful(t)) terms.set(t, 'product');
      for (const t of brands) if (isMeaningful(t) && !terms.has(t)) terms.set(t, 'brand');
      // 새 랭킹 페이지 탐색(같은 호스트만)
      for (const link of rankingLinks) {
        if (link.startsWith('https://www.cosme.net/ranking/') && !visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }
      logger.info('수집', { url: url.replace('https://www.cosme.net', ''), totalTerms: terms.size, queued: queue.length });
      await sleep(NAV_DELAY_MS);
    }
  } finally {
    await browser.close();
  }

  const outPath = path.join(OUT_DIR, `cosme-${collectedAt}.tsv`);
  const lines = [...terms].map(([text, type]) => `${type}\t${text}`);
  await writeFile(outPath, lines.join('\n') + '\n', 'utf8');
  logger.info('완료', { terms: terms.size, pages: visited.size, out: path.relative(REPO_ROOT, outPath) });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
