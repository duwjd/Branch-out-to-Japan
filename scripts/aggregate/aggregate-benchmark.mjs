/**
 * 카테고리별 벤치마크 사전집계 — detail-ocr.jsonl → benchmark-aggregates.json.
 * 리포트 LLM 콜(①③④)의 grounding으로 주입된다(원본 코퍼스를 통째로 넣지 않기 위한 요약).
 * 근거: docs/08-data-flow.md §2·§8-D3 (수동 재실행, 빈도 2 미만 제외 + 스팟체크).
 *
 * 사용: npm run aggregate
 * 결정성: 정렬 고정(빈도 내림차순 → 텍스트 오름차순) — 같은 입력이면 같은 출력.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../crawl/lib/logger.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(REPO_ROOT, 'data/processed/detail-ocr.jsonl');
const OUT = path.join(REPO_ROOT, 'data/processed/benchmark-aggregates.json');

const MIN_COUNT = 2; // OCR 노이즈 1차 필터: 2회 미만 관찰 항목 제외
const TOP_N = 20;
const EXAMPLE_N = 12;

/** 공백·중복 문자를 정규화한다(집계 키 안정화). */
function normalizeText(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/** 배열 항목 빈도를 세어 [{text, count}] 상위 N을 결정적 순서로 반환한다. */
function topByCount(counter, topN) {
  return [...counter.entries()]
    .filter(([, count]) => count >= MIN_COUNT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .slice(0, topN)
    .map(([text, count]) => ({ text, count }));
}

async function main() {
  const text = await readFile(SRC, 'utf8');
  const rows = text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

  /** @type {Map<string, {sampleCount:number, badges:Map<string,number>, ingredients:Map<string,number>, appeals:Map<string,number>}>} */
  const byCategory = new Map();

  for (const row of rows) {
    const cat = row.category;
    if (!cat) continue;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, { sampleCount: 0, badges: new Map(), ingredients: new Map(), appeals: new Map() });
    }
    const bucket = byCategory.get(cat);
    bucket.sampleCount += 1;
    for (const b of row.trustBadges ?? []) {
      const key = normalizeText(b);
      if (key) bucket.badges.set(key, (bucket.badges.get(key) ?? 0) + 1);
    }
    for (const ing of row.ingredients ?? []) {
      const key = normalizeText(ing);
      if (key) bucket.ingredients.set(key, (bucket.ingredients.get(key) ?? 0) + 1);
    }
    for (const a of row.appeals ?? []) {
      const key = normalizeText(a);
      // 소구문 예문은 문장다운 길이만(너무 짧으면 배지, 너무 길면 OCR 덩어리)
      if (key.length >= 8 && key.length <= 60) bucket.appeals.set(key, (bucket.appeals.get(key) ?? 0) + 1);
    }
  }

  const categories = {};
  for (const cat of [...byCategory.keys()].sort()) {
    const bucket = byCategory.get(cat);
    categories[cat] = {
      sampleCount: bucket.sampleCount,
      topTrustBadges: topByCount(bucket.badges, TOP_N),
      topIngredients: topByCount(bucket.ingredients, TOP_N),
      // 예문은 빈도 필터를 완화(문장은 반복이 드묾): 빈도순 → 자주 나오는 관례 문형 위주
      appealExamples: [...bucket.appeals.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
        .slice(0, EXAMPLE_N)
        .map(([textValue]) => textValue),
    };
  }

  const out = {
    version: '1.0.0',
    source: 'data/processed/detail-ocr.jsonl',
    sourceCount: rows.length,
    note: '라쿠텐 단일 채널 표본 — 과잉일반화 금지. 빈도 2 미만 제외(OCR 노이즈 1차 필터). 갱신: 코퍼스 갱신 시 npm run aggregate 수동 재실행.',
    generatedAt: new Date().toISOString().slice(0, 10),
    categories,
  };

  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  logger.info('사전집계 완료', {
    out: path.relative(REPO_ROOT, OUT),
    categories: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.sampleCount])),
  });
}

main().catch((err) => {
  logger.error('사전집계 실패', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
