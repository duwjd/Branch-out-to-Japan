/**
 * 라쿠텐 이치바 제품 썸네일 수집기.
 *
 * 흐름: 카테고리별 키워드로 상품검색 API 페이징 → 카탈로그 레코드 매핑 →
 *       썸네일 다운로드 → data/processed/product-catalog.jsonl 에 append(중복 제거).
 *
 * 사용:
 *   RAKUTEN_APP_ID=xxxx node scripts/crawl/rakuten.mjs
 *   node scripts/crawl/rakuten.mjs --per-category 150 --category skincare
 *   node scripts/crawl/rakuten.mjs --no-images     # 이미지 없이 메타데이터만
 *
 * 앱ID 발급: https://webservice.rakuten.co.jp/ (무료). .env 의 RAKUTEN_APP_ID 로도 읽음.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { searchItems, toCatalogRecord, sleep } from './lib/rakutenClient.mjs';
import { CATEGORIES } from './lib/categories.mjs';
import { REPO_ROOT, CATALOG_PATH, ensureDirs, loadExistingIds, appendRecords, downloadImage } from './lib/catalog.mjs';

const IMAGE_SUBDIR = 'raw/product-thumbnails/rakuten';
const REQUEST_DELAY_MS = 1200; // 라쿠텐 API·이미지 서버 예의상 요청 간 딜레이
const HITS_PER_PAGE = 30; // API 상한

/** 간단한 CLI 파서. @returns {{perCategory:number, downloadImages:boolean, only:string|null}} */
function parseArgs(argv) {
  const out = { perCategory: 150, downloadImages: true, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--per-category') out.perCategory = Number(argv[++i]);
    else if (a === '--no-images') out.downloadImages = false;
    else if (a === '--category') out.only = argv[++i];
  }
  return out;
}

/** .env 에서 KEY=VALUE 를 읽어 하나만 반환(dotenv 미의존). @returns {string|undefined} */
async function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  const envPath = path.join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) return undefined;
  const text = await readFile(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '');
  }
  return undefined;
}

/** 한 카테고리를 목표 수량까지 수집. @returns {Promise<object[]>} 신규 레코드들 */
async function collectCategory({ category, keywords }, { perCategory, applicationId, seenIds, collectedAt }) {
  const collected = [];
  const perKeyword = Math.ceil(perCategory / keywords.length);
  for (const keyword of keywords) {
    let page = 1;
    let gotForKeyword = 0;
    while (gotForKeyword < perKeyword) {
      let result;
      try {
        result = await searchItems({ applicationId, keyword, page, hits: HITS_PER_PAGE, sort: '-reviewCount' });
      } catch (err) {
        logger.warn('검색 실패 — 다음 키워드로', { keyword, page, reason: String(err.message ?? err) });
        break;
      }
      if (result.items.length === 0) break;
      for (const item of result.items) {
        const record = toCatalogRecord(item, { category, collectedAt });
        if (seenIds.has(record.id)) continue;
        seenIds.add(record.id);
        collected.push(record);
        gotForKeyword++;
        if (gotForKeyword >= perKeyword) break;
      }
      logger.info('페이지 수집', { category, keyword, page, running: collected.length });
      if (page >= result.pageCount) break;
      page++;
      await sleep(REQUEST_DELAY_MS);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  return collected;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const applicationId = await readEnvValue('RAKUTEN_APP_ID');
  if (!applicationId) {
    logger.error('RAKUTEN_APP_ID 없음. https://webservice.rakuten.co.jp/ 에서 앱ID를 발급받아 .env 에 넣거나 환경변수로 전달하세요.');
    process.exit(1);
  }

  await ensureDirs(IMAGE_SUBDIR);

  const collectedAt = new Date().toISOString().slice(0, 10);
  const seenIds = await loadExistingIds();
  logger.info('시작', { perCategory: args.perCategory, downloadImages: args.downloadImages, existing: seenIds.size });

  const targets = args.only ? CATEGORIES.filter((c) => c.category === args.only) : CATEGORIES;
  if (targets.length === 0) {
    logger.error('일치하는 카테고리 없음', { only: args.only, available: CATEGORIES.map((c) => c.category) });
    process.exit(1);
  }

  let totalNew = 0;
  let totalImages = 0;
  for (const cat of targets) {
    const records = await collectCategory(cat, { perCategory: args.perCategory, applicationId, seenIds, collectedAt });
    // 메타데이터를 먼저 안전하게 기록(이미지 실패와 무관하게 카탈로그는 남는다)
    await appendRecords(records);
    totalNew += records.length;
    logger.info('카테고리 완료', { category: cat.category, newRecords: records.length });

    if (args.downloadImages) {
      for (const record of records) {
        const ok = await downloadImage(record);
        if (ok) totalImages++;
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  logger.info('완료', { newRecords: totalNew, imagesDownloaded: totalImages, catalog: path.relative(REPO_ROOT, CATALOG_PATH) });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
