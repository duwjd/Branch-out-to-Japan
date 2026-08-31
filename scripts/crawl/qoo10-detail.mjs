/**
 * Qoo10 재팬 상세페이지 소구 이미지 수집기 — 헤드리스 브라우저(Playwright).
 * qoo10.mjs 가 모은 썸네일 레코드의 sourceUrl(실제 아이템 URL)로 상품 상세에 들어가,
 * 셀러가 만든 상세 소구 이미지를 세로 순서대로 추출한다.
 *
 * 왜 Qoo10 표본이 따로 필요한가 — 우리 페르소나의 주력 채널이고, 사용자 대부분이
 * 모바일 앱으로 보기 때문에 블록 높이·정보 밀도 관례가 라쿠텐과 다르다. 또 Qoo10은
 * 설명문을 LP처럼 이미지로 구성하는 것이 표준이라 블록 시퀀스 표본으로 가치가 높다.
 *
 * 주의: Qoo10 은 비브라우저 요청을 차단(523)한다. 헤드리스로만 접근. 소량·저속·내부분석용.
 *
 * 산출: 이미지 → data/raw/product-detail/qoo10/{productId}/{n}.jpg
 *       메타  → product-catalog.jsonl 에 type=detail 레코드 append
 *
 * 사용:
 *   node scripts/crawl/qoo10-detail.mjs                  # 표본 30개 상품
 *   node scripts/crawl/qoo10-detail.mjs --limit 30 --max-images 24
 *   node scripts/crawl/qoo10-detail.mjs --seed-ids data/processed/detail-seed-ids-qoo10.txt
 */

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { sleep } from './lib/rakutenClient.mjs';
import { REPO_ROOT, CATALOG_PATH, loadExistingIds, appendRecords, downloadImage, dropRecords } from './lib/catalog.mjs';

const NAV_DELAY_MS = 3500;
const RENDER_WAIT_MS = 3000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const out = { limit: 30, maxImages: 24, seedIds: null, refresh: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--max-images') out.maxImages = Number(argv[++i]);
    else if (a === '--seed-ids') out.seedIds = argv[++i];
    else if (a === '--refresh') out.refresh = true;
  }
  return out;
}

/** 카탈로그의 Qoo10 썸네일 레코드 중 실제 아이템 URL을 가진 것만 표집 풀로 쓴다. */
async function loadPool() {
  const text = await readFile(CATALOG_PATH, 'utf8');
  const out = [];
  for (const l of text.split('\n')) {
    if (!l.trim()) continue;
    let r;
    try {
      r = JSON.parse(l);
    } catch {
      continue;
    }
    if (r.source !== 'qoo10' || r.type !== 'thumbnail') continue;
    // 랭킹 페이지 URL이 그대로 박힌 레코드는 상세 진입이 불가하므로 제외
    if (!r.sourceUrl || !/\/item\//.test(r.sourceUrl)) continue;
    out.push(r);
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

/**
 * Qoo10 상세 설명 영역의 이미지를 DOM Y좌표 순으로 추출한다.
 * Qoo10은 설명을 iframe에 담는 경우가 있어 메인 문서에서 못 찾으면 프레임을 훑는다.
 */
async function extractDetailImages(page) {
  const inFrame = (frame) =>
    frame.evaluate(() => {
      const SELECTORS =
        '#div_goods_detail, .goods_detail, #goods_detail, [class*="detail_content"], #detail_page, .item_detail';
      const seen = new Map();
      const containers = document.querySelectorAll(SELECTORS);
      const scope = containers.length ? containers : [];
      for (const c of scope) {
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
          seen.set(src, { src, top, w, h, isMallBanner: /qoo10\.jp\/gmkt\.inc\/.*(event|banner)/i.test(src) });
        }
      }
      return [...seen.values()].sort((a, b) => a.top - b.top);
    });

  const main = await inFrame(page.mainFrame());
  if (main.length > 0) return main;
  // 설명이 iframe 안에 있는 레이아웃 폴백
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const rows = await inFrame(frame);
      if (rows.length > 0) return rows;
    } catch {
      /* 크로스오리진 프레임 무시 */
    }
  }
  return [];
}

/** 옵션 셀렉트·가격·프로모 신호 추출(조건부 레이어 판정 근거). */
function extractVariationMeta(page) {
  return page.evaluate(() => {
    const labels = [];
    const selects = document.querySelectorAll('select[id^="opt"], select[name^="opt"], select[class*="option"]');
    for (const sel of selects) {
      for (const opt of sel.querySelectorAll('option')) {
        const t = (opt.textContent || '').trim();
        if (!t || /選択|選んで|お選び|---|option/i.test(t)) continue;
        labels.push(t);
      }
    }
    const uniq = [...new Set(labels)];

    let axis = null;
    if (uniq.length >= 2) {
      const joined = uniq.join(' ');
      if (/色|カラー|シェード|トーン|号/.test(joined)) axis = 'color';
      else if (/mL|ml|g\b|サイズ|大容量|詰め替え|レフィル/.test(joined)) axis = 'size';
      else if (/セット|個|本|枚|入り/.test(joined)) axis = 'set';
      else axis = 'variant';
    }

    const bodyText = (document.body.innerText || '').slice(0, 20000);
    const priceEl = document.querySelector('[class*="price"], #price, .sell_price');
    const priceRaw = priceEl ? (priceEl.textContent || '').trim().slice(0, 200) : '';
    // メガ割(메가와리)는 Qoo10 고유의 대형 캠페인 — 프로모 레이어 판정에 중요
    const promoPattern = /クーポン|[%％]\s*OFF|オフ|メガ割|タイムセール|限定価格|半額|割引/;
    const doublePricePattern = /定価|通常価格|参考価格|[⇒→]\s*[¥￥\d]/;

    return {
      optionLabels: uniq.slice(0, 60),
      optionCount: uniq.length,
      optionAxis: axis,
      hasPromo: promoPattern.test(bodyText),
      hasDoublePrice: doublePricePattern.test(bodyText),
      priceRaw,
    };
  });
}

/** 지연로딩 이미지를 강제로 불러오도록 하단까지 반복 스크롤. */
async function autoScroll(page, rounds = 14) {
  for (let i = 0; i < rounds; i++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1000);
}

/**
 * Qoo10 지연로딩 이미지를 강제 수화(hydrate)한다.
 * Qoo10은 실제 URL을 `gd_src`(때로 `data-original`)에 두고 `src`에는 로딩 GIF를 넣는다.
 * 수화하지 않으면 naturalWidth 가 0이라 크기 필터에서 전량 탈락한다.
 * 모든 프레임에 적용한 뒤 디코딩을 기다린다.
 */
async function hydrateLazyImages(page) {
  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        for (const img of document.querySelectorAll('img[gd_src], img[data-original], img[data-src]')) {
          const real = img.getAttribute('gd_src') || img.getAttribute('data-original') || img.getAttribute('data-src');
          if (real && img.src !== real) img.src = real;
        }
      });
    } catch {
      /* 크로스오리진 프레임 무시 */
    }
  }
  // 교체한 src 들이 디코딩될 때까지 대기(완료 못한 것은 크기 필터가 걸러낸다)
  await page.waitForTimeout(2500);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(CATALOG_PATH)) {
    logger.error('product-catalog.jsonl 없음. 먼저 qoo10.mjs 를 실행하세요.');
    process.exit(1);
  }
  const collectedAt = new Date().toISOString().slice(0, 10);
  const pool = await loadPool();
  if (pool.length === 0) {
    logger.error('Qoo10 아이템 URL을 가진 썸네일 레코드가 없습니다. qoo10.mjs 를 먼저 확장 실행하세요.');
    process.exit(1);
  }
  const samples = args.seedIds ? await pickBySeed(args.seedIds, pool) : pool.slice(0, args.limit);

  if (args.refresh) {
    const targetParents = new Set(samples.map((s) => s.id));
    await dropRecords((r) => r.type === 'detail' && targetParents.has(r.parentId));
  }
  const seenIds = await loadExistingIds();
  logger.info('시작(Qoo10 상세)', { pool: pool.length, samples: samples.length, maxImagesPerProduct: args.maxImages });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ja-JP' });
  const page = await ctx.newPage();

  let totalDetailImgs = 0;
  let processed = 0;
  try {
    for (const prod of samples) {
      processed++;
      try {
        const resp = await page.goto(prod.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        if (!resp || resp.status() >= 400) throw new Error(`HTTP ${resp?.status()}`);
      } catch (err) {
        logger.warn('상세 이동 실패', { id: prod.id, reason: String(err.message ?? err) });
        continue;
      }
      await page.waitForTimeout(RENDER_WAIT_MS);
      await autoScroll(page);
      await hydrateLazyImages(page);

      let imgs = [];
      try {
        imgs = (await extractDetailImages(page)).slice(0, args.maxImages);
      } catch (err) {
        logger.warn('상세 이미지 추출 실패', { id: prod.id, reason: String(err.message ?? err) });
      }
      if (imgs.length === 0) {
        logger.warn('상세 이미지 0장 — 렌더 실패/차단 가능', { id: prod.id });
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
        logger.warn('옵션·가격 메타 추출 실패', { id: prod.id, reason: String(err.message ?? err) });
      }

      const records = imgs
        .map((img, n) => ({
          id: `${prod.id}_d${n + 1}`,
          source: 'qoo10',
          type: 'detail',
          parentId: prod.id,
          productName: prod.productName,
          category: prod.category,
          sourceUrl: prod.sourceUrl,
          imageUrl: img.src,
          localPath: `raw/product-detail/qoo10/${prod.id}/${n + 1}.jpg`,
          sequenceIndex: n + 1,
          isMallBanner: img.isMallBanner,
          naturalWidth: img.w,
          naturalHeight: img.h,
          optionCount: variation.optionCount,
          optionAxis: variation.optionAxis,
          optionLabels: variation.optionLabels,
          hasPromo: variation.hasPromo,
          hasDoublePrice: variation.hasDoublePrice,
          priceRaw: variation.priceRaw,
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
        promo: variation.hasPromo,
      });
      await sleep(NAV_DELAY_MS);
    }
  } finally {
    await browser.close();
  }

  logger.info('완료', {
    products: processed,
    detailImages: totalDetailImgs,
    catalog: path.relative(REPO_ROOT, CATALOG_PATH),
  });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
