/**
 * 상세페이지 블록 시퀀스 집계 — detail-ocr.jsonl(v2) → detail-block-aggregates.json.
 * ② 상세페이지 만들기의 템플릿 6종·조건부 레이어 3종 설계의 실측 근거를 만든다.
 * 근거 문서: docs/research/jp-detail-style-taxonomy.md
 *
 * 산출:
 *  - blockFrequency      : 블록별 관측 수 + 상품 커버리지
 *  - positionProfile     : 블록별 상대 위치 분포(앞/중/뒤) — 시퀀스 순서 설계의 1차 근거
 *  - sequencesByProduct  : 상품별 블록 시퀀스(템플릿 판정용 원자료)
 *  - layerCoverage       : 조건부 레이어(프로모·옵션·실적) 보유율
 *  - categoryProfile     : 카테고리별 블록 사용 편향
 *  - legalFlagFrequency  : 薬機法·景表法 인접 표현 빈도(생성 가드 우선순위)
 *
 * 사용: npm run aggregate:detail
 * 결정성: 정렬 고정(빈도 내림차순 → 키 오름차순) — 같은 입력이면 같은 출력.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../crawl/lib/logger.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(REPO_ROOT, 'data/processed/detail-ocr.jsonl');
const PACK = path.join(REPO_ROOT, 'data/processed/detail-style-prompts.json');
const OUT = path.join(REPO_ROOT, 'data/processed/detail-block-aggregates.json');

/**
 * OCR 라벨은 블록 **코드**(B01~B27)이고 팩·코드베이스는 **슬러그**(hero-product 등)를 쓴다.
 * 두 표기가 갈리면 집계 조건이 조용히 어긋나므로(초기 구현에서 실제로 발생) 팩에서 매핑을 만든다.
 */
async function loadBlockMap() {
  const pack = JSON.parse(await readFile(PACK, 'utf8'));
  const byCode = new Map();
  for (const b of pack.blockCatalog) byCode.set(b.code, { id: b.id, nameKo: b.nameKo, layer: b.layer ?? null });
  return byCode;
}

/** 위치 구간 — 상세페이지를 앞/중/뒤 3분할해 블록의 자리를 본다. */
const ZONES = ['head', 'body', 'tail'];

function zoneOf(index, total) {
  if (total <= 1) return 'head';
  const r = (index - 1) / (total - 1); // 1-based → 0..1
  if (r < 0.34) return 'head';
  if (r < 0.67) return 'body';
  return 'tail';
}

function inc(map, key, by = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + by);
}

function sortedEntries(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

async function main() {
  const blockMap = await loadBlockMap();
  const label = (code) => blockMap.get(code)?.nameKo ?? code;
  const slugOf = (code) => blockMap.get(code)?.id ?? code;
  const text = await readFile(SRC, 'utf8');
  const rows = text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

  const v2 = rows.filter((r) => (r.schemaVersion ?? 1) >= 2);
  if (v2.length === 0) {
    logger.error('v2 스키마 행이 없습니다. 먼저 `npm run crawl:ocr` 로 블록 라벨을 채우세요.', {
      totalRows: rows.length,
    });
    process.exit(1);
  }
  if (v2.length < rows.length) {
    logger.warn('구 스키마(v1) 행은 집계에서 제외', { v1: rows.length - v2.length, v2: v2.length });
  }

  // 상품 단위로 묶어 시퀀스를 복원한다(블록 순서가 분석 대상이므로 단위는 이미지가 아니라 상품)
  const byProduct = new Map();
  for (const r of v2) {
    if (!byProduct.has(r.parentId)) {
      byProduct.set(r.parentId, {
        parentId: r.parentId,
        productName: r.productName,
        category: r.category,
        source: r.source ?? 'rakuten',
        hasPromo: r.hasPromo ?? null,
        optionCount: r.optionCount ?? null,
        optionAxis: r.optionAxis ?? null,
        images: [],
      });
    }
    byProduct.get(r.parentId).images.push(r);
  }

  const blockFreq = new Map();
  const blockProducts = new Map();  // 블록 → 보유 상품 수
  const posByBlock = new Map();     // 블록 → {head, body, tail}
  const catByBlock = new Map();     // 블록 → 카테고리별 관측
  const legalFreq = new Map();
  const sequences = [];
  let noiseCount = 0;

  for (const p of byProduct.values()) {
    p.images.sort((a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0));
    const seq = [];
    const seen = new Set();
    const total = p.images.length;

    for (const img of p.images) {
      const bt = img.blockType ?? 'noise';
      if (bt === 'noise') { noiseCount++; continue; }
      const idx = img.sequenceIndex ?? seq.length + 1;
      seq.push({ seq: idx, blockType: bt });

      inc(blockFreq, bt);
      if (!seen.has(bt)) { seen.add(bt); inc(blockProducts, bt); }

      if (!posByBlock.has(bt)) posByBlock.set(bt, new Map(ZONES.map((z) => [z, 0])));
      inc(posByBlock.get(bt), zoneOf(idx, total));

      if (!catByBlock.has(bt)) catByBlock.set(bt, new Map());
      inc(catByBlock.get(bt), p.category ?? 'unknown');

      for (const f of img.legalFlags ?? []) inc(legalFreq, f);
    }

    sequences.push({
      parentId: p.parentId,
      productName: p.productName,
      category: p.category,
      source: p.source,
      imageCount: total,
      hasPromo: p.hasPromo,
      optionCount: p.optionCount,
      optionAxis: p.optionAxis,
      sequence: seq.map((s) => s.blockType),
    });
  }

  const productTotal = byProduct.size;

  // 레이어 보유율 — 조건부 레이어를 템플릿에서 분리한 판단의 실측 근거.
  // 옵션은 두 경로로 본다: 크롤러가 DOM 셀렉터로 확증한 값(optionCount)과
  // OCR이 이미지에서 읽은 컬러/라인업 블록. DOM 셀렉터는 몰마다 달라 놓치는 경우가 많으므로
  // 블록 관측을 1차 근거로 쓴다(수집 한계는 taxonomy 문서에 명시).
  const OPTION_CODES = ['B17', 'B18', 'B19', 'B20', 'B21'];
  const PROOF_CODES = ['B04', 'B05', 'B11', 'B12', 'B25'];
  const PROMO_CODES = ['B01', 'B02'];
  const has = (s, codes) => s.sequence.some((b) => codes.includes(b));
  const layerCoverage = {
    productTotal,
    promoByDom: sequences.filter((s) => s.hasPromo === true).length,
    promoByBlock: sequences.filter((s) => has(s, PROMO_CODES)).length,
    optionByDom: sequences.filter((s) => (s.optionCount ?? 0) >= 2).length,
    optionByBlock: sequences.filter((s) => has(s, OPTION_CODES)).length,
    colorByBlock: sequences.filter((s) => has(s, ['B17', 'B18', 'B19'])).length,
    proofByBlock: sequences.filter((s) => has(s, PROOF_CODES)).length,
  };

  const positionProfile = {};
  for (const [bt, zones] of posByBlock.entries()) {
    const sum = [...zones.values()].reduce((a, b) => a + b, 0) || 1;
    positionProfile[bt] = Object.fromEntries(
      ZONES.map((z) => [z, Number(((zones.get(z) ?? 0) / sum).toFixed(3))]),
    );
  }

  const out = {
    generatedFrom: path.relative(REPO_ROOT, SRC),
    sourceRows: v2.length,
    productCount: productTotal,
    noiseImages: noiseCount,
    bySource: Object.fromEntries(sortedEntries(
      sequences.reduce((m, s) => (inc(m, s.source), m), new Map()),
    )),
    blockFrequency: sortedEntries(blockFreq).map(([blockType, count]) => ({
      blockType,
      slug: slugOf(blockType),
      nameKo: label(blockType),
      count,
      products: blockProducts.get(blockType) ?? 0,
      productShare: Number(((blockProducts.get(blockType) ?? 0) / (productTotal || 1)).toFixed(3)),
    })),
    positionProfile,
    categoryProfile: Object.fromEntries(
      [...catByBlock.entries()]
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([bt, m]) => [bt, Object.fromEntries(sortedEntries(m))]),
    ),
    layerCoverage,
    legalFlagFrequency: sortedEntries(legalFreq).map(([flag, count]) => ({ flag, count })),
    sequencesByProduct: sequences.sort((a, b) => a.parentId.localeCompare(b.parentId)),
  };

  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  logger.info('집계 완료', {
    products: productTotal,
    images: v2.length,
    noise: noiseCount,
    blockTypes: blockFreq.size,
    out: path.relative(REPO_ROOT, OUT),
  });
  logger.info('조건부 레이어 보유율(블록 관측 기준)', {
    promo: `${layerCoverage.promoByBlock}/${productTotal}`,
    option: `${layerCoverage.optionByBlock}/${productTotal}`,
    color: `${layerCoverage.colorByBlock}/${productTotal}`,
    proof: `${layerCoverage.proofByBlock}/${productTotal}`,
  });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
