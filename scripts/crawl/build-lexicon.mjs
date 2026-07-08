/**
 * 뷰티 렉시콘 빌더 — 수집한 일본어 코퍼스에서 뷰티 문구/단어의 빈도를 집계한다.
 * 코퍼스: ① data/processed/product-catalog.jsonl 의 productName(라쿠텐 마케팅 카피)
 *         ② data/raw/sns-copy/cosme/*.tsv 의 @cosme 제품·브랜드명
 * 산출: data/processed/sns-lexicon.csv  (term,reading,source,category,exampleContext,frequency,collectedAt)
 *
 * 방식: (a) 시드 사전(lib/beautyTerms.mjs) 용어의 코퍼스 내 빈도 카운트
 *       (b) 카타카나 연속어(≥3자) 자동 발굴 → 성분·트렌드 신조어 후보(상위 N)
 *   ※ 형태소 분석기 없이 서브스트링/정규식 기반. 연구용 시드 렉시콘.
 *
 * 사용: node scripts/crawl/build-lexicon.mjs [--top-katakana 40]
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { REPO_ROOT } from './lib/catalog.mjs';
import { BEAUTY_TERMS } from './lib/beautyTerms.mjs';

const CATALOG_PATH = path.join(REPO_ROOT, 'data/processed/product-catalog.jsonl');
const COSME_DIR = path.join(REPO_ROOT, 'data/raw/sns-copy/cosme');
const OCR_PATH = path.join(REPO_ROOT, 'data/processed/detail-ocr.jsonl');
const OUT_PATH = path.join(REPO_ROOT, 'data/processed/sns-lexicon.csv');

/** 카타카나 자동발굴에서 제외할 이커머스 판촉어(뷰티 어휘 아님). */
const KATAKANA_STOP = new Set([
  'クーポン', 'ポイント', 'ギフト', 'プレゼント', 'セット', 'キャンペーン', 'セール',
  'オフ', 'クリスマス', 'ランキング', 'サイト', 'ショップ', 'レビュー', 'コスメ',
]);

function parseArgs(argv) {
  const out = { topKatakana: 40 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--top-katakana') out.topKatakana = Number(argv[++i]);
  }
  return out;
}

/** 코퍼스 라인들을 모은다: {text, source}[] */
async function loadCorpus() {
  const lines = [];
  if (existsSync(CATALOG_PATH)) {
    const text = await readFile(CATALOG_PATH, 'utf8');
    for (const l of text.split('\n')) {
      if (!l.trim()) continue;
      try {
        const r = JSON.parse(l);
        // type=detail 은 부모 상품명을 반복하므로 빈도 왜곡 방지 위해 썸네일만 집계
        if (r.type === 'thumbnail' && r.productName) lines.push({ text: r.productName, source: 'rakuten' });
      } catch { /* skip */ }
    }
  }
  if (existsSync(COSME_DIR)) {
    for (const f of await readdir(COSME_DIR)) {
      if (!f.endsWith('.tsv')) continue;
      const text = await readFile(path.join(COSME_DIR, f), 'utf8');
      for (const l of text.split('\n')) {
        const tab = l.indexOf('\t');
        const val = tab >= 0 ? l.slice(tab + 1).trim() : l.trim();
        if (val) lines.push({ text: val, source: 'cosme' });
      }
    }
  }
  // 상세 이미지 OCR — 실제 소구 문장(짧은 상품명이 아닌 본문 카피). 코퍼스 질을 크게 높인다.
  if (existsSync(OCR_PATH)) {
    const text = await readFile(OCR_PATH, 'utf8');
    for (const l of text.split('\n')) {
      if (!l.trim()) continue;
      try {
        const r = JSON.parse(l);
        if (r.rawText) lines.push({ text: r.rawText, source: 'rakuten-detail-ocr' });
        for (const a of r.appeals || []) lines.push({ text: a, source: 'rakuten-detail-ocr' });
      } catch { /* skip */ }
    }
  }
  return lines;
}

/** CSV 셀 이스케이프. */
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const corpus = await loadCorpus();
  if (corpus.length === 0) {
    logger.error('코퍼스 비어있음. 먼저 rakuten/cosme 수집기를 실행하세요.', { catalog: existsSync(CATALOG_PATH), cosme: existsSync(COSME_DIR) });
    process.exit(1);
  }
  const collectedAt = new Date().toISOString().slice(0, 10);
  const rows = [];

  // (a) 시드 사전 빈도
  for (const { term, reading, category } of BEAUTY_TERMS) {
    let freq = 0;
    let example = '';
    const srcSet = new Set();
    for (const { text, source } of corpus) {
      if (text.includes(term)) {
        freq++;
        srcSet.add(source);
        if (!example) example = text.slice(0, 40);
      }
    }
    if (freq > 0) {
      rows.push({ term, reading, source: [...srcSet].join('+'), category, example, freq });
    }
  }

  // (b) 카타카나 연속어 자동 발굴(시드에 없는 것만)
  const seedSet = new Set(BEAUTY_TERMS.map((t) => t.term));
  const kata = new Map(); // term -> {freq, example, srcSet}
  for (const { text, source } of corpus) {
    for (const m of text.match(/[゠-ヿ]{3,}/g) || []) {
      if (seedSet.has(m) || KATAKANA_STOP.has(m)) continue;
      const e = kata.get(m) || { freq: 0, example: '', srcSet: new Set() };
      e.freq++;
      e.srcSet.add(source);
      if (!e.example) e.example = text.slice(0, 40);
      kata.set(m, e);
    }
  }
  const topKata = [...kata.entries()]
    .sort((a, b) => b[1].freq - a[1].freq)
    .slice(0, args.topKatakana);
  for (const [term, e] of topKata) {
    rows.push({ term, reading: '', source: [...e.srcSet].join('+'), category: '자동발굴(카타카나)', example: e.example, freq: e.freq });
  }

  // 빈도 내림차순 정렬 후 CSV
  rows.sort((a, b) => b.freq - a.freq);
  const header = 'term,reading,source,category,exampleContext,frequency,collectedAt';
  const body = rows.map((r) =>
    [r.term, r.reading, r.source, r.category, r.example, r.freq, collectedAt].map(csvCell).join(',')
  );
  await writeFile(OUT_PATH, header + '\n' + body.join('\n') + '\n', 'utf8');

  logger.info('완료', {
    corpusLines: corpus.length,
    seedHits: rows.filter((r) => r.category !== '자동발굴(카타카나)').length,
    katakanaFound: topKata.length,
    out: path.relative(REPO_ROOT, OUT_PATH),
  });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
