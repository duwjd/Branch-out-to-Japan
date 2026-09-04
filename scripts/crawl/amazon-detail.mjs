/**
 * Amazon.co.jp A+ 콘텐츠(상세) 이미지 수집기 — 헤드리스 브라우저(Playwright).
 * amazon.mjs 가 모은 썸네일 레코드의 sourceUrl(https://www.amazon.co.jp/dp/{ASIN})로
 * 상품 페이지에 들어가, A+ 콘텐츠 모듈의 이미지를 세로 순서대로 추출한다.
 *
 * 왜 아마존JP 표본이 필요한가 — A+ 콘텐츠는 가격·프로모션·긴박 문구·타 소매 언급이
 * 규정상 금지다. 즉 **프로모 레이어를 뗀 순수 서사의 대조군**이라, 조건부 레이어 설계
 * (L1 프로모를 템플릿에서 분리한 판단)의 반증 표본으로 반드시 필요하다.
 *
 * 주의: Amazon 은 자동수집을 ToS로 제한하며 CAPTCHA를 띄울 수 있다. 소량·저속·내부분석용.
 *       CAPTCHA 감지 시 해당 상품을 건너뛴다(amazon.mjs 의 판정 로직 재사용).
 *
 * 산출: 이미지 → data/raw/product-detail/amazon-jp/{productId}/{n}.jpg
 *       메타  → product-catalog.jsonl 에 type=detail 레코드 append
 *
 * 사용:
 *   node scripts/crawl/amazon-detail.mjs                  # 표본 20개 상품
 *   node scripts/crawl/amazon-detail.mjs --limit 20 --max-images 24
 *   node scripts/crawl/amazon-detail.mjs --seed-ids data/processed/detail-seed-ids-amazon.txt
 */

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { sleep } from './lib/rakutenClient.mjs';
import { REPO_ROOT, CATALOG_PATH, loadExistingIds, appendRecords, downloadImage, dropRecords } from './lib/catalog.mjs';

// 검색보다 보수적으로 — dp 페이지는 차단률이 낮지만 간격을 넉넉히 둔다
const NAV_DELAY_MS = 5000;
const RENDER_WAIT_MS = 3000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const out = { limit: 20, maxImages: 24, seedIds: null, refresh: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--max-images') out.maxImages = Number(argv[++i]);
    else if (a === '--seed-ids') out.seedIds = argv[++i];
    else if (a === '--refresh') out.refresh = true;
  }
  return out;
}

/** 카탈로그의 아마존 썸네일 레코드를 표집 풀로 쓴다(카테고리 라운드로빈). */
async function loadPool() {
  const text = await readFile(CATALOG_PATH, 'utf8');
  const byCat = new Map();
  for (const l of text.split('\n')) {
    if (!l.trim()) continue;
    let r;
    try {
      r = JSON.parse(l);
    } catch {
      continue;
    }
    if (r.source !== 'amazon' || r.type !== 'thumbnail') continue;
    if (!r.sourceUrl || !/\/dp\//.test(r.sourceUrl)) continue;
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category).push(r);
  }
  // 카테고리 라운드로빈으로 펼쳐 편중을 막는다
  const cats = [...byCat.keys()];
  const out = [];
  for (let i = 0; ; i++) {
    let added = false;
    for (const c of cats) {
      const list = byCat.get(c);
      if (i < list.length) {
        out.push(list[i]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

/** 시드 파일(한 줄 1 id, `#` 주석)로 의도 표집. */
async function pickBySeed(seedPath, pool) {
  const abs = path.isAbsolute(seedPath) ? seedPath : path.join(REPO_ROOT, seedPath);
  const text = await readFile(abs, 'utf8');
  // 시드 줄은 `id\t# 셀` 형태다 — 첫 공백/탭/# 앞까지만 id로 읽는다
  const wanted = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/[\s#]/)[0])
    .filter(Boolean);
  const byId = new Map(pool.map((r) => [r.id, r]));
  const picks = [];
  const missing = [];
  for (const id of wanted) {
    const r = byId.get(id);
    if (r) picks.push(r);
    else missing.push(id);
  }
  if (missing.length) logger.warn('시드 id 카탈로그에 없음', { count: missing.length, sample: missing.slice(0, 5) });
  return picks;
}

/** Amazon 이미지 크기 토큰(._AC_UL320_.) 제거 → 풀해상도. */
function fullResImage(url) {
  return String(url ?? '').replace(/\._[A-Z0-9_,]+_\./i, '.');
}

/**
 * A+ 콘텐츠 모듈 이미지를 DOM Y좌표 순으로 추출 + CAPTCHA 감지.
 * A+ 는 모듈 단위(헤더 970×600 · 이미지+텍스트 · 비교표 등)로 구성되므로
 * 모듈 순서가 곧 상세페이지의 세로 순서다.
 */
function extractDetailImages(page) {
  return page.evaluate(() => {
    const blocked = /検証|ロボットではありません|captcha|Enter the characters/i.test(document.body?.innerText || '');
    const SELECTORS =
      '#aplus, #aplus_feature_div, #aplusBrandStory_feature_div, #productDescription, [class*="aplus-module"]';
    const seen = new Map();
    for (const c of document.querySelectorAll(SELECTORS)) {
      for (const img of c.querySelectorAll('img')) {
        const src = img.currentSrc || img.src;
        if (!src || src.startsWith('data:')) continue;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w < 300 || h < 120) continue;
        if (h < w * 0.1) continue;
        const rect = img.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const prev = seen.get(src);
        if (prev && prev.top <= top) continue;
        seen.set(src, { src, top, w, h, isMallBanner: false });
      }
    }
    return { rows: [...seen.values()].sort((a, b) => a.top - b.top), blocked };
  });
}

/**
 * 바리에이션(twister)과 표시 신호 추출.
 * A+ 규정상 가격·프로모는 상세 콘텐츠에 들어갈 수 없으므로 hasPromo 는 항상 false로 둔다
 * — 페이지 상단의 판매가는 몰 UI지 상세 콘텐츠가 아니다(대조군 성격 유지).
 */
function extractVariationMeta(page) {
  return page.evaluate(() => {
    const labels = [];
    for (const el of document.querySelectorAll('#twister li img, #twister .a-button-text, [id^="variation_"] li')) {
      const t = (el.getAttribute?.('alt') || el.textContent || '').trim();
      if (t && t.length < 60) labels.push(t);
    }
    const uniq = [...new Set(labels)];

    let axis = null;
    if (uniq.length >= 2) {
      const joined = uniq.join(' ');
      if (/色|カラー|シェード|トーン/.test(joined)) axis = 'color';
      else if (/mL|ml|g\b|サイズ|大容量|詰め替え|レフィル/.test(joined)) axis = 'size';
      else if (/セット|個|本|枚|入り/.test(joined)) axis = 'set';
      else axis = 'variant';
    }

    return {
      optionLabels: uniq.slice(0, 60),
      optionCount: uniq.length,
      optionAxis: axis,
      hasPromo: false, // A+ 콘텐츠는 가격·프로모션 표기 금지 — 구조적으로 프로모 레이어 없음
      hasDoublePrice: false,
      priceRaw: '',
    };
  });
}

/** 지연로딩(A+ 모듈은 스크롤 시 로드)을 위해 하단까지 반복 스크롤. */
async function autoScroll(page, rounds = 12) {
  for (let i = 0; i < rounds; i++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1000);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(CATALOG_PATH)) {
    logger.error('product-catalog.jsonl 없음. 먼저 amazon.mjs 를 실행하세요.');
    process.exit(1);
  }
  const collectedAt = new Date().toISOString().slice(0, 10);
  const pool = await loadPool();
  if (pool.length === 0) {
    logger.error('아마존 dp URL을 가진 썸네일 레코드가 없습니다. amazon.mjs 를 먼저 실행하세요.');
    process.exit(1);
  }
  const samples = args.seedIds ? await pickBySeed(args.seedIds, pool) : pool.slice(0, args.limit);

  if (args.refresh) {
    const targetParents = new Set(samples.map((s) => s.id));
    await dropRecords((r) => r.type === 'detail' && targetParents.has(r.parentId));
  }
  const seenIds = await loadExistingIds();
  logger.info('시작(아마존JP A+)', { pool: pool.length, samples: samples.length, maxImagesPerProduct: args.maxImages });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ja-JP' });
  const page = await ctx.newPage();

  let totalDetailImgs = 0;
  let processed = 0;
  let blockedCount = 0;
  let noAplusCount = 0;
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

      const { rows, blocked } = await extractDetailImages(page);
      if (blocked) {
        blockedCount++;
        logger.warn('CAPTCHA/차단 감지 — 건너뜀', { id: prod.id, blockedSoFar: blockedCount });
        await sleep(NAV_DELAY_MS * 2);
        continue;
      }
      const imgs = rows.slice(0, args.maxImages);
      if (imgs.length === 0) {
        // A+ 는 브랜드 등록 셀러만 쓸 수 있어 미보유 상품이 흔하다 — 정상 케이스
        noAplusCount++;
        logger.info('A+ 콘텐츠 없음 — 건너뜀', { id: prod.id });
        await sleep(NAV_DELAY_MS);
        continue;
      }

      let variation = {
        optionLabels: [],
        optionCount: 0,
        optionAxis: null,
        hasPromo: false,
        hasDoublePrice: false,
        priceRaw: '',
      };
      try {
        variation = await extractVariationMeta(page);
      } catch (err) {
        logger.warn('옵션 메타 추출 실패', { id: prod.id, reason: String(err.message ?? err) });
      }

      const records = imgs
        .map((img, n) => ({
          id: `${prod.id}_d${n + 1}`,
          source: 'amazon',
          type: 'detail',
          parentId: prod.id,
          productName: prod.productName,
          category: prod.category,
          sourceUrl: prod.sourceUrl,
          imageUrl: fullResImage(img.src),
          localPath: `raw/product-detail/amazon-jp/${prod.id}/${n + 1}.jpg`,
          sequenceIndex: n + 1,
          isMallBanner: false,
          naturalWidth: img.w,
          naturalHeight: img.h,
          optionCount: variation.optionCount,
          optionAxis: variation.optionAxis,
          optionLabels: variation.optionLabels,
          hasPromo: false,
          hasDoublePrice: false,
          priceRaw: '',
          collectedAt,
          license: '브랜드/셀러 저작물 — 내부 분석용',
          via: 'browser',
          schemaVersion: 2,
        }))
        .filter((r) => !seenIds.has(r.id));

      records.forEach((r) => seenIds.add(r.id));
      await appendRecords(records);
      for (const r of records) {
        if (await downloadImage(r)) totalDetailImgs++;
        await sleep(400);
      }
      logger.info('상세 수집', {
        n: `${processed}/${samples.length}`,
        id: prod.id,
        images: records.length,
        options: variation.optionCount,
      });
      await sleep(NAV_DELAY_MS);
    }
  } finally {
    await browser.close();
  }

  logger.info('완료', {
    products: processed,
    detailImages: totalDetailImgs,
    blocked: blockedCount,
    noAplus: noAplusCount,
    catalog: path.relative(REPO_ROOT, CATALOG_PATH),
  });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
