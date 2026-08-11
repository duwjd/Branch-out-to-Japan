/**
 * 상세페이지 의도 표집 시드 생성기.
 *
 * 왜 필요한가 — 기존 상세 코퍼스의 프로모 70% · 색상옵션 34%는 **설계된 비율이 아니라
 * 우연히 잡힌 비율**이다(pickRoundRobin 은 상점당 1개를 돌 뿐 프로모·옵션 여부를 모른다).
 * 조건부 레이어(L1 프로모 · L2 옵션)를 설계하려면 각 조건의 유/무 대조군이 모두 필요하므로,
 * 상품명 정규식으로 셀을 나눈 뒤 결손 셀부터 채우는 시드 목록을 만든다.
 *
 * 셀 = 카테고리(4) × 프로모 유무(2) × 옵션 유무(2) = 16셀, 셀당 목표 --per-cell(기본 3).
 * ※ 템플릿(D1~D6)은 수집·OCR 이후에야 판정되므로 여기서는 층화 축으로 쓰지 않는다.
 *
 * 산출: data/processed/detail-seed-ids{,-qoo10,-amazon}.txt (한 줄 1 id, `#` 주석)
 *
 * 사용:
 *   node scripts/crawl/detail-seeds.mjs                  # 세 몰 시드 전부 생성
 *   node scripts/crawl/detail-seeds.mjs --source rakuten --per-cell 3
 *   node scripts/crawl/detail-seeds.mjs --report         # 파일 안 쓰고 셀 분포만 출력
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { REPO_ROOT, CATALOG_PATH } from './lib/catalog.mjs';

/** 상품명에서 조건을 읽는 정규식 — 실제 44상품에서 매칭을 확인한 패턴. */
const PROMO_RE = /クーポン|[%％]\s*OFF|オフ|ポイント\s*\d+\s*倍|P\d+倍|限定価格|マラソン|メガ割|半額|送料無料|[⇒→]\s*[¥￥\d]|\d[\d,]*円\s*[⇒→]/;
const COLOR_RE = /全\s*\d+\s*色|\d+\s*色|カラー(バリエーション|チャート)|シェード/;
const LINEUP_RE = /選べる\s*\d*\s*種|各種選べる|セット|詰め替え|レフィル|大容量|\d+\s*mL\s*[\/･・]\s*\d+\s*mL|\(\s*\d+\s*種\s*\)/;

const OUT_BY_SOURCE = {
  rakuten: 'data/processed/detail-seed-ids.txt',
  qoo10: 'data/processed/detail-seed-ids-qoo10.txt',
  amazon: 'data/processed/detail-seed-ids-amazon.txt',
};

function parseArgs(argv) {
  const out = { source: null, perCell: 3, report: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') out.source = argv[++i];
    else if (a === '--per-cell') out.perCell = Number(argv[++i]);
    else if (a === '--report') out.report = true;
  }
  return out;
}

/** 카탈로그를 읽어 썸네일 레코드와 이미 상세를 수집한 parentId 집합을 돌려준다. */
async function loadCatalog() {
  const text = await readFile(CATALOG_PATH, 'utf8');
  const thumbs = [];
  const detailedParents = new Set();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    if (r.type === 'thumbnail') thumbs.push(r);
    else if (r.type === 'detail' && r.parentId) detailedParents.add(r.parentId);
  }
  return { thumbs, detailedParents };
}

/** 상품명으로 셀 좌표를 매긴다. 옵션 축은 색상 > 라인업 순으로 우선한다. */
function cellOf(rec) {
  const name = String(rec.productName ?? '');
  const promo = PROMO_RE.test(name) ? 'promo' : 'no-promo';
  let option = 'no-option';
  if (COLOR_RE.test(name)) option = 'color';
  else if (LINEUP_RE.test(name)) option = 'lineup';
  return { category: rec.category ?? 'unknown', promo, option };
}

function cellKey(c) {
  // 옵션 유무만으로 층화한다(색상/라인업 구분은 수집 후 DOM 확증으로 정밀화)
  return `${c.category}|${c.promo}|${c.option === 'no-option' ? 'no-option' : 'option'}`;
}

/** 상점(브랜드 대용) 중복을 피하며 셀을 채운다. */
function buildSeeds(thumbs, detailedParents, perCell) {
  const byCell = new Map();
  for (const r of thumbs) {
    const key = cellKey(cellOf(r));
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(r);
  }

  const picks = [];
  const seenShops = new Set();
  const coverage = [];
  for (const [key, list] of [...byCell.entries()].sort()) {
    const already = list.filter((r) => detailedParents.has(r.id)).length;
    const need = Math.max(0, perCell - already);
    let taken = 0;
    for (const r of list) {
      if (taken >= need) break;
      if (detailedParents.has(r.id)) continue; // 이미 상세 보유
      const shop = String(r.id).split('_')[1] ?? r.id;
      if (seenShops.has(shop)) continue;       // 브랜드 편중 방지
      seenShops.add(shop);
      picks.push({ ...r, cell: key });
      taken++;
    }
    coverage.push({ cell: key, pool: list.length, already, needed: need, picked: taken });
  }
  return { picks, coverage };
}

async function run(source, thumbs, detailedParents, args) {
  const scoped = thumbs.filter((r) => (r.source ?? 'rakuten') === source);
  if (scoped.length === 0) {
    logger.warn('썸네일 레코드 없음 — 건너뜀', { source });
    return;
  }
  const { picks, coverage } = buildSeeds(scoped, detailedParents, args.perCell);

  const short = coverage.filter((c) => c.picked < c.needed);
  logger.info('셀 커버리지', {
    source,
    cells: coverage.length,
    picked: picks.length,
    unfilledCells: short.length,
  });
  for (const c of coverage) {
    logger.info(`  ${c.cell}`, { pool: c.pool, already: c.already, needed: c.needed, picked: c.picked });
  }
  if (short.length) {
    logger.warn('풀 부족으로 못 채운 셀 — 표본 한계로 문서에 명시할 것', {
      source,
      cells: short.map((c) => c.cell),
    });
  }

  if (args.report) return;

  const header = [
    `# 상세페이지 의도 표집 시드 — ${source}`,
    `# 생성: detail-seeds.mjs --per-cell ${args.perCell}`,
    '# 셀 = 카테고리 | 프로모 유무 | 옵션 유무. 한 줄 1 id, `#`은 주석.',
    `# 못 채운 셀: ${short.length ? short.map((c) => c.cell).join(', ') : '없음'}`,
    '',
  ];
  const body = picks.map((p) => `${p.id}\t# ${p.cell}`);
  const outRel = OUT_BY_SOURCE[source];
  await writeFile(path.join(REPO_ROOT, outRel), header.concat(body).join('\n') + '\n', 'utf8');
  logger.info('시드 파일 작성', { source, count: picks.length, out: outRel });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(CATALOG_PATH)) {
    logger.error('product-catalog.jsonl 없음. 먼저 썸네일 수집기를 실행하세요.');
    process.exit(1);
  }
  const { thumbs, detailedParents } = await loadCatalog();
  logger.info('카탈로그 로드', { thumbnails: thumbs.length, alreadyDetailed: detailedParents.size });

  const sources = args.source ? [args.source] : ['rakuten', 'qoo10', 'amazon'];
  for (const s of sources) await run(s, thumbs, detailedParents, args);
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
