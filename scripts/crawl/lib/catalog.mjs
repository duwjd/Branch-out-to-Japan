/**
 * 제품 카탈로그(data/processed/product-catalog.jsonl) 공용 유틸.
 * API 수집기(rakuten.mjs)와 브라우저 수집기(rakuten-browser.mjs)가 함께 쓴다.
 * 두 수집기가 같은 id 포맷을 쓰므로 중복 제거가 교차로 동작한다.
 */

import { readFile, appendFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { logger } from './logger.mjs';

// 이 파일은 scripts/crawl/lib/ 안에 있으므로 저장소 루트는 세 단계 위.
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const CATALOG_PATH = path.join(REPO_ROOT, 'data/processed/product-catalog.jsonl');

/** 카탈로그·이미지 폴더를 보장한다. @param {string} imageSubdir data/ 기준 상대경로 */
export async function ensureDirs(imageSubdir) {
  await mkdir(path.dirname(CATALOG_PATH), { recursive: true });
  await mkdir(path.join(REPO_ROOT, 'data', imageSubdir), { recursive: true });
}

/** 기존 카탈로그의 id 집합(중복 수집 방지). @returns {Promise<Set<string>>} */
export async function loadExistingIds() {
  if (!existsSync(CATALOG_PATH)) return new Set();
  const text = await readFile(CATALOG_PATH, 'utf8');
  const ids = new Set();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      ids.add(JSON.parse(line).id);
    } catch {
      /* 손상 라인 무시 */
    }
  }
  return ids;
}

/** 레코드들을 카탈로그에 append(JSON Lines). @param {object[]} records */
export async function appendRecords(records) {
  if (records.length === 0) return;
  await appendFile(CATALOG_PATH, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

/**
 * 조건에 맞는 레코드를 카탈로그에서 제거하고, 제거된 id 집합을 돌려준다.
 * 수집기 필터를 바꾼 뒤 재수집할 때 쓴다 — 구 레코드를 남겨두면 같은 `_d{n}` 번호가
 * 서로 다른 이미지를 가리키게 되어 sequenceIndex 가 어긋난다.
 * 덮어쓰기 전 `.bak-{timestamp}` 백업을 남긴다.
 * @param {(record: object) => boolean} shouldDrop 제거할 레코드면 true
 * @returns {Promise<{dropped: Set<string>, backupPath: string|null}>}
 */
export async function dropRecords(shouldDrop) {
  if (!existsSync(CATALOG_PATH)) return { dropped: new Set(), backupPath: null };
  const text = await readFile(CATALOG_PATH, 'utf8');
  const kept = [];
  const dropped = new Set();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      kept.push(line);
      continue;
    } // 손상 라인은 보존
    if (shouldDrop(r)) dropped.add(r.id);
    else kept.push(line);
  }
  if (dropped.size === 0) return { dropped, backupPath: null };

  const backupPath = `${CATALOG_PATH}.bak-${Date.now()}`;
  await writeFile(backupPath, text, 'utf8');
  await writeFile(CATALOG_PATH, kept.join('\n') + '\n', 'utf8');
  logger.info('카탈로그 레코드 제거', { dropped: dropped.size, kept: kept.length, backup: path.basename(backupPath) });
  return { dropped, backupPath };
}

/**
 * record.imageUrl 을 data/{record.localPath} 로 저장. 실패는 경고만.
 * @param {{id:string, imageUrl:string, localPath:string}} record
 * @returns {Promise<boolean>}
 */
export async function downloadImage(record) {
  try {
    if (!record.imageUrl) throw new Error('imageUrl 없음');
    const res = await fetch(record.imageUrl, {
      headers: { 'User-Agent': 'branch-out-to-japan-research/0.1 (internal analysis)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(REPO_ROOT, 'data', record.localPath);
    await mkdir(path.dirname(dest), { recursive: true }); // 상품별 하위폴더 등 보장
    await writeFile(dest, buf);
    return true;
  } catch (err) {
    logger.warn('이미지 다운로드 실패', { id: record.id, reason: String(err.message ?? err) });
    return false;
  }
}
