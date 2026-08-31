/**
 * 라쿠텐 상세페이지 소구 이미지 수집기 — 헤드리스 브라우저(Playwright).
 * ①(rakuten-browser.mjs / rakuten.mjs)이 모은 product-catalog.jsonl 의 sourceUrl 로
 * 상품 상세페이지에 들어가, 셀러가 만든 상세 소구 이미지(카피 포함)를 추출한다.
 * → 일본향 메시지·비주얼 관례 분석에 가장 값진 자료.
 *
 * v2 개정(2026-08-10) — 상세페이지 만들기(② 스튜디오) 블록 분류를 위해:
 *  - maxImages 8 → 24. 구 기본값이 상세 후반부(스펙표·각주·Q&A)를 통째로 잘라냈다.
 *  - 크기 필터 완화(h < w*0.35 → w*0.10). 일본 상세의 스펙표·각주 띠·주의사항 띠가
 *    정확히 "가로로 긴 이미지" 형태라 구 필터가 이들을 배너로 오인해 버렸다.
 *  - 몰 배너를 제외하지 않고 isMallBanner 태그로 보존 — 프로모 블록(B01·B02) 분석에 필요.
 *  - DOM Y좌표로 정렬해 sequenceIndex = 실제 세로 순서를 보장(컨테이너 4종 순회로 섞이던 문제).
 *  - 옵션 셀렉터·가격 DOM을 읽어 optionCount·optionAxis·hasPromo·priceRaw 메타 기록
 *    → 조건부 레이어(L1 프로모 · L2 옵션) 판정 근거.
 *  - --seed-ids 로 의도 표집(결손 셀 채우기) 지원.
 *
 * 표본: 기본은 상점(brand 대용)당 1개 상품, 카테고리 라운드로빈, 총 --limit 개.
 *       --seed-ids 를 주면 그 목록을 그대로 쓴다(라운드로빈 무시).
 *
 * 산출: 이미지 → data/raw/product-detail/rakuten/{productId}/{n}.jpg
 *       메타  → product-catalog.jsonl 에 type=detail 레코드 append
 *
 * 사용:
 *   node scripts/crawl/rakuten-detail.mjs                     # 표본 50개 상품
 *   node scripts/crawl/rakuten-detail.mjs --limit 26 --category skincare
 *   node scripts/crawl/rakuten-detail.mjs --max-images 24
 *   node scripts/crawl/rakuten-detail.mjs --seed-ids data/processed/detail-seed-ids.txt
 *   node scripts/crawl/rakuten-detail.mjs --refresh --limit 44   # 구 필터로 모은 상품 재수집
 *
 * ⚠ --refresh 는 대상 상품의 기존 detail 레코드를 카탈로그에서 지운 뒤 다시 모은다.
 *   구 레코드를 남기면 `_d{n}` 번호가 서로 다른 이미지를 가리키게 되므로, 필터를 바꾼
 *   지금은 기존 44상품에 대해 반드시 --refresh 로 돌려야 한다. (카탈로그는 자동 백업)
 */

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { sleep } from './lib/rakutenClient.mjs';
import { REPO_ROOT, CATALOG_PATH, loadExistingIds, appendRecords, downloadImage, dropRecords } from './lib/catalog.mjs';

const NAV_DELAY_MS = 3000;
const RENDER_WAIT_MS = 2500;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const out = { limit: 50, maxImages: 24, only: null, seedIds: null, refresh: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--max-images') out.maxImages = Number(argv[++i]);
    else if (a === '--category') out.only = argv[++i];
    else if (a === '--seed-ids') out.seedIds = argv[++i];
    else if (a === '--refresh') out.refresh = true;
  }
  return out;
}

/** id(rakuten_{shop}_{code})에서 shop 추출. */
function shopOf(id) {
  return String(id).split('_')[1] ?? '';
}

/** 카탈로그의 썸네일 레코드 전체를 읽는다(표집 대상 풀). */
async function loadThumbnailRecords(only) {
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
    if (r.type !== 'thumbnail') continue;
    if (only && r.category !== only) continue;
    if (!r.sourceUrl) continue;
    out.push(r);
  }
  return out;
}

/**
 * 의도 표집 — 시드 파일의 id 목록 순서대로 표본을 만든다.
 * 시드 파일 형식: 한 줄에 id 하나. `#`로 시작하는 줄과 빈 줄은 주석.
 * 결손 셀(예: "성분 근거형 × 프로모 없음 × 옵션 없음")을 채울 때 쓴다.
 */
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

/** 상점당 1개·카테고리 라운드로빈으로 표본 선정(기본 전략). */
function pickRoundRobin(pool, limit) {
  const byCat = new Map();
  for (const r of pool) {
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
        if (!seenShops.has(shop)) {
          seenShops.add(shop);
          picks.push(r);
          break;
        }
      }
      ptr.set(cat, i);
      if (i < list.length) exhausted = false;
      if (picks.length >= limit) break;
    }
  }
  return picks;
}

/**
 * 상세페이지에서 셀러 소구 이미지를 추출(브라우저 컨텍스트).
 * 구 버전과 달리 (a) 몰 배너를 버리지 않고 태그하며 (b) DOM Y좌표로 정렬해
 * 배열 인덱스가 곧 상세페이지의 세로 순서(sequenceIndex)가 되게 한다.
 * @returns {Promise<{src:string, top:number, w:number, h:number, isMallBanner:boolean}[]>}
 */
function extractDetailImages(page) {
  return page.evaluate(() => {
    const MALL_BANNER_HOSTS = ['cdn.rmc.contents.rakuten.co.jp', 'r.r10s.jp/com/img', 'r10s.jp/com/'];
    const seen = new Map(); // src -> 최상단 위치(중첩 컨테이너 중복 방지)
    const containers = document.querySelectorAll('.sale_desc, .item_desc, #item_desc, [class*="itemDesc"]');
    for (const c of containers) {
      for (const img of c.querySelectorAll('img')) {
        const src = img.currentSrc || img.src;
        if (!src) continue;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        // 아이콘·스페이서 제외. 구 버전(w<400||h<300)은 좁은 각주 띠까지 버렸다.
        if (w < 300 || h < 120) continue;
        // 진짜 얇은 장식 띠만 제외. 스펙표·각주 띠는 가로로 길어도 보존한다.
        if (h < w * 0.1) continue;
        const rect = img.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const prev = seen.get(src);
        if (prev && prev.top <= top) continue;
        seen.set(src, {
          src,
          top,
          w,
          h,
          isMallBanner: MALL_BANNER_HOSTS.some((b) => src.includes(b)),
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.top - b.top);
  });
}

/**
 * 옵션 축·개수와 프로모 신호를 상세 DOM에서 확증한다(조건부 레이어 판정 근거).
 * 상품명 정규식만으로는 "全21色" 같은 표기가 없는 상품을 놓치므로 DOM을 직접 읽는다.
 */
function extractVariationMeta(page) {
  return page.evaluate(() => {
    const labels = [];
    // 라쿠텐 바리에이션은 재고 셀렉트(inventory) 또는 바리에이션 테이블로 표현된다
    const selects = document.querySelectorAll(
      'select[name*="inventory"], select[name*="variation"], select[class*="inventory"]',
    );
    for (const sel of selects) {
      for (const opt of sel.querySelectorAll('option')) {
        const t = (opt.textContent || '').trim();
        if (!t || /選択|選んで|お選び|---/.test(t)) continue;
        labels.push(t);
      }
    }
    if (labels.length === 0) {
      for (const el of document.querySelectorAll('[class*="variation"] label, [class*="inventory"] label')) {
        const t = (el.textContent || '').trim();
        if (t) labels.push(t);
      }
    }
    const uniq = [...new Set(labels)];

    // 옵션 축 추정 — 색상 > 사이즈/용량 > 세트 > 기타
    let axis = null;
    if (uniq.length >= 2) {
      const joined = uniq.join(' ');
      if (/色|カラー|シェード|トーン|[0-9]{2}\s*[A-Z]/.test(joined)) axis = 'color';
      else if (/mL|ml|ｍｌ|g\b|ｇ|サイズ|大容量|詰め替え|レフィル/.test(joined)) axis = 'size';
      else if (/セット|個|本|枚|入り/.test(joined)) axis = 'set';
      else axis = 'variant';
    }

    // 프로모 신호 — 쿠폰 배너 호스트 · 이중가격 · 캠페인 문구
    const bodyText = (document.body.innerText || '').slice(0, 20000);
    const priceEl = document.querySelector('[class*="price"], #priceCalculationConfig, .price2');
    const priceRaw = priceEl ? (priceEl.textContent || '').trim().slice(0, 200) : '';
    const hasCouponBanner = [...document.images].some((i) =>
      (i.currentSrc || i.src || '').includes('rmc.contents.rakuten.co.jp'),
    );
    const promoPattern =
      /クーポン|[%％]\s*OFF|オフ|ポイント\s*\d+\s*倍|P\d+倍|限定価格|マラソン|メガ割|半額|タイムセール/;
    const doublePricePattern = /通常価格|参考価格|希望小売価格|[⇒→]\s*[¥￥\d]/;

    return {
      optionLabels: uniq.slice(0, 60),
      optionCount: uniq.length,
      optionAxis: axis,
      hasPromo: hasCouponBanner || promoPattern.test(bodyText),
      hasDoublePrice: doublePricePattern.test(bodyText),
      priceRaw,
    };
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
        if (y >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
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
  const pool = await loadThumbnailRecords(args.only);
  const samples = args.seedIds ? await pickBySeed(args.seedIds, pool) : pickRoundRobin(pool, args.limit);

  // --refresh: 대상 상품의 구 detail 레코드를 먼저 제거한다.
  // 남겨두면 loadExistingIds()가 `_d1..d8`을 스킵해버려, 완화된 필터로 새로 잡힌
  // 앞쪽 이미지들이 밀려 들어가면서 같은 번호가 다른 이미지를 가리키게 된다.
  if (args.refresh) {
    const targetParents = new Set(samples.map((s) => s.id));
    await dropRecords((r) => r.type === 'detail' && targetParents.has(r.parentId));
  }
  const seenIds = await loadExistingIds();

  logger.info('시작(상세)', {
    samples: samples.length,
    maxImagesPerProduct: args.maxImages,
    mode: args.seedIds ? 'seed' : 'round-robin',
    refresh: args.refresh,
  });

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
      const imgs = (await extractDetailImages(page)).slice(0, args.maxImages);
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
          source: 'rakuten',
          type: 'detail',
          parentId: prod.id,
          productName: prod.productName,
          category: prod.category,
          sourceUrl: prod.sourceUrl,
          imageUrl: img.src,
          localPath: `raw/product-detail/rakuten/${prod.id}/${n + 1}.jpg`,
          // 블록 분류용 메타(v2) — sequenceIndex 는 DOM Y좌표 정렬 결과라 실제 세로 순서다
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
