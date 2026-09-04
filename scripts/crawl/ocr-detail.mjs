/**
 * 상세페이지 이미지 OCR 파이프라인 — Claude 비전 + Message Batches API.
 * ②가 모은 라쿠텐 상세 이미지(type=detail)를 일본어 OCR로 텍스트화하고
 * 소구 문장·성분·신뢰배지를 구조화 추출한다. → ①② 및 렉시콘의 코퍼스.
 *
 * 방식: Batch API(비동기·50% 할인). 이미지 1장 = 요청 1건, custom_id = detail 이미지 id.
 * 모델: claude-sonnet-5 (일본어 OCR 정확도·비용 균형). 사고(thinking) 비활성 — OCR은 인지 작업.
 *
 * 산출: data/processed/detail-ocr.jsonl (한 줄 = 이미지 1건, 파생 텍스트라 커밋 대상)
 * 재실행 안전: 현재 스키마 버전으로 OCR된 id는 스킵. 배치 진행 중 중단돼도 상태파일로 재개.
 *              구 스키마(v1) 행은 자동 재OCR 대상이며, 완료 후 id 기준 압축으로 구 행을 정리한다.
 *
 * 사용:
 *   node scripts/crawl/ocr-detail.mjs --dry-run       # 건수·예상비용만(무전송)
 *   node scripts/crawl/ocr-detail.mjs --limit 3       # 소량 실제 배치(스모크)
 *   node scripts/crawl/ocr-detail.mjs                 # 전체(v1 행 포함 — v2로 통일)
 *   node scripts/crawl/ocr-detail.mjs --force-reocr   # 버전 무관 전량 재처리
 *
 * 자격증명: .env 의 ANTHROPIC_API_KEY, 또는 `ant auth login` 프로필(SDK 기본 해석).
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, appendFile, unlink } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { logger } from './lib/logger.mjs';
import { readEnvValue } from './lib/env.mjs';
import { REPO_ROOT, CATALOG_PATH } from './lib/catalog.mjs';

const OCR_PATH = path.join(REPO_ROOT, 'data/processed/detail-ocr.jsonl');
const STATE_PATH = path.join(REPO_ROOT, 'data/processed/.ocr-batch-state.json');
const NORM_DIR = path.join(REPO_ROOT, 'data/processed/.ocr-normalized'); // 정규화 임시 산출(gitignore)
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4000; // 색상 변형 등 텍스트 밀도 높은 상세 이미지의 JSON 잘림 방지
const POLL_INTERVAL_MS = 60000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Claude 비전 이미지당 바이트 한도
const MAX_EDGE = 8000; // Claude 비전 한 변 최대 px
// Batch API 는 요청 1건이 아니라 **배치 전체**가 256MB 를 넘으면 413 을 낸다.
// base64 는 원본의 약 1.33배라 1,000장이면 수백 MB가 된다 → 크기 기준으로 나눠 순차 처리한다.
const MAX_BATCH_BYTES = 180 * 1024 * 1024; // 256MB 상한에 여유
const MAX_BATCH_REQUESTS = 200;

// 대략 비용 추정(Batch 50% 할인, Sonnet5 인트로가 기준: in $1/MTok, out $5/MTok)
const EST_INPUT_TOKENS = 2500; // 상세 이미지 1장 ≈ (고해상 근접)
const EST_OUTPUT_TOKENS = 900;
const EST_COST_PER_IMAGE = (EST_INPUT_TOKENS * 1 + EST_OUTPUT_TOKENS * 5) / 1_000_000;

/**
 * OCR 스키마 버전. v2(2026-08-10)에서 블록 분류 필드 6종을 추가했다 —
 * ② 상세페이지 만들기의 블록 카탈로그(B01~B27) 라벨링과 조건부 레이어(프로모·옵션) 판정 근거.
 * 기본 실행은 v2 미만 행을 자동으로 재OCR한다(스키마가 갈리면 집계가 조건분기 지옥이 된다).
 */
const SCHEMA_VERSION = 2;

/** 블록 카탈로그 — 정본은 docs/research/jp-detail-style-taxonomy.md. 여기는 라벨링용 축약본. */
const BLOCK_TYPES = [
  ['B01', '몰 프로모 배너(쿠폰·기간한정)'],
  ['B02', '세트·수량 오퍼표(단품가 vs 세트가)'],
  ['B03', '히어로 제품컷·캐치카피'],
  ['B04', '랭킹·수상 스택'],
  ['B05', '누적 판매·리뷰 수'],
  ['B06', '문제 제기·공감(こんなお悩み)'],
  ['B07', '원인 구조화(CASE1/2/3)'],
  ['B08', '비교 도해(Before/After 일러스트)'],
  ['B09', '기전 도해(성분→전달원리→기대효과)'],
  ['B10', '성분 카드(성분명·농도)'],
  ['B11', '정량 데이터·그래프'],
  ['B12', '시험·근거 라벨(効能評価試験済み 등)'],
  ['B13', 'POINT 나열'],
  ['B14', '스펙 수치 패널(SPF/PA·耐水性)'],
  ['B15', '사용 씬'],
  ['B16', '무첨가·프리 처방 배지'],
  ['B17', '컬러 칩 그리드'],
  ['B18', '컬러 차트 매트릭스(Light/Dark×Warm/Cool)'],
  ['B19', '퍼스널컬러 룩 제안(ブルベ/イエベ)'],
  ['B20', '라인업 비교 차트'],
  ['B21', '발색·텍스처 시연 스와치'],
  ['B22', '사용법 STEP'],
  ['B23', '브랜드 스토리·컨셉'],
  ['B24', '텍스처·질감 컷'],
  ['B25', '리뷰·구매자 목소리'],
  ['B26', '제품 스펙표(内容量·全成分·区分·販売元)'],
  ['B27', '각주 모음(※1~※n)'],
];

/** 薬機法·景表法 인접 표현 플래그 — 생성기의 금지 가드 설계 근거. */
const LEGAL_FLAGS = ['efficacy-claim', 'superlative', 'comparative-ad', 'double-price', 'before-after'];

/** 구조화 출력 스키마 v2 — OCR 원문 + 분류 + 블록 라벨. */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rawText: { type: 'string', description: '이미지 내 모든 일본어 텍스트를 그대로' },
    appeals: { type: 'array', items: { type: 'string' }, description: '소구 문장(효능·감성 카피)' },
    ingredients: { type: 'array', items: { type: 'string' }, description: '언급된 성분' },
    trustBadges: { type: 'array', items: { type: 'string' }, description: '신뢰배지/인증(医薬部外品·랭킹·무첨가 등)' },
    blockType: {
      type: 'string',
      enum: [...BLOCK_TYPES.map(([id]) => id), 'noise'],
      description: '이 이미지가 상세페이지에서 맡은 블록 역할. 판단 불가·상품 무관이면 noise',
    },
    footnotes: {
      type: 'array',
      description: '※·＊ 각주. marker는 표기 그대로(※1·＊ 등), text는 각주 본문',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { marker: { type: 'string' }, text: { type: 'string' } },
        required: ['marker', 'text'],
      },
    },
    numericClaims: {
      type: 'array',
      description: '수치 주장(농도·배수·일수·인원 등). value는 숫자 문자열, unit은 단위, context는 그 수치가 붙은 문구',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { value: { type: 'string' }, unit: { type: 'string' }, context: { type: 'string' } },
        required: ['value', 'unit', 'context'],
      },
    },
    optionLabels: { type: 'array', items: { type: 'string' }, description: '이미지에 보이는 색명·옵션명·품번' },
    priceTerms: { type: 'array', items: { type: 'string' }, description: '가격·할인·쿠폰·포인트 문자열' },
    legalFlags: {
      type: 'array',
      items: { type: 'string', enum: LEGAL_FLAGS },
      description: '해당하는 법규 인접 표현 유형',
    },
  },
  required: [
    'rawText',
    'appeals',
    'ingredients',
    'trustBadges',
    'blockType',
    'footnotes',
    'numericClaims',
    'optionLabels',
    'priceTerms',
    'legalFlags',
  ],
};

const PROMPT =
  'これは日本のECサイトの商品詳細ページを構成する画像1枚です。以下を抽出してください。\n' +
  '1) rawText: 画像内のすべての日本語テキストをそのまま。読み取れない場合は空文字。\n' +
  '2) appeals: 訴求文（効能・感情に訴えるコピー）\n' +
  '3) ingredients: 記載された成分\n' +
  '4) trustBadges: 信頼バッジ・認証（医薬部外品・ランキング1位・無添加など）\n' +
  '5) blockType: この画像が詳細ページで担う役割を次から1つ選ぶ。\n' +
  BLOCK_TYPES.map(([id, ko]) => `   ${id} = ${ko}`).join('\n') +
  '\n' +
  '   商品と無関係・判別不能なら noise。\n' +
  '6) footnotes: ※・＊ の注釈。marker は表記のまま、text は注釈本文。\n' +
  '7) numericClaims: 数値主張（濃度・倍数・日数・人数など）。例 value="6", unit="%", context="グリシルグリシン6%配合"\n' +
  '8) optionLabels: 画像に見えるカラー名・オプション名・品番\n' +
  '9) priceTerms: 価格・割引・クーポン・ポイントの文字列\n' +
  '10) legalFlags: 該当する表現類型。' +
  'efficacy-claim=効能効果の断定 / superlative=最上級表現(No.1・最高) / comparative-ad=他社比較 / ' +
  'double-price=二重価格(通常価格の取り消し線) / before-after=使用前後の変化提示\n' +
  '該当がない配列項目は空配列にしてください。';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const out = { limit: Infinity, dryRun: false, forceReocr: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') out.limit = Number(argv[++i]);
    else if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--force-reocr') out.forceReocr = true;
  }
  return out;
}

/** 카탈로그의 detail 레코드 로드. */
async function loadDetailRecords() {
  const text = await readFile(CATALOG_PATH, 'utf8');
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.type === 'detail') out.push(r);
    } catch {
      /* skip */
    }
  }
  return out;
}

/**
 * 이미 **현재 스키마 버전으로** OCR 완료된 id 집합.
 * 구 버전(v1) 행은 done 으로 치지 않아 자동으로 재OCR 대상이 된다 — 스키마가 갈린 코퍼스는
 * 집계 단계에서 전부 조건분기가 되므로, 한 번 비용을 내고 전량 통일하는 편이 싸다.
 * @param {boolean} force true면 버전과 무관하게 전량 재처리
 */
async function loadDoneIds(force = false) {
  if (force || !existsSync(OCR_PATH)) return new Set();
  const text = await readFile(OCR_PATH, 'utf8');
  const ids = new Set();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if ((r.schemaVersion ?? 1) >= SCHEMA_VERSION) ids.add(r.id);
    } catch {
      /* skip */
    }
  }
  return ids;
}

/**
 * OCR 파일을 id 기준으로 압축한다 — 같은 id가 여러 번 나오면 **마지막(=최신) 행만** 남긴다.
 * 재OCR은 append 로 이뤄지므로 이 압축이 없으면 v1·v2 행이 공존해 집계가 이중 계상된다.
 * 덮어쓰기 전 `.bak-{timestamp}` 백업을 남긴다.
 */
async function compactOcrFile() {
  if (!existsSync(OCR_PATH)) return { kept: 0, removed: 0 };
  const text = await readFile(OCR_PATH, 'utf8');
  const byId = new Map(); // 삽입 순서 유지 + 나중 값이 앞 값을 덮어씀
  let total = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    total++;
    byId.set(r.id, line);
  }
  const removed = total - byId.size;
  if (removed <= 0) return { kept: byId.size, removed: 0 };
  await writeFile(`${OCR_PATH}.bak-${Date.now()}`, text, 'utf8');
  await writeFile(OCR_PATH, [...byId.values()].join('\n') + '\n', 'utf8');
  return { kept: byId.size, removed };
}

/** 매직바이트로 실제 이미지 타입 판별(확장자가 .jpg여도 실제는 GIF/WebP인 셀러 이미지 대응). */
function detectMediaType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

/** sips로 픽셀 크기 조회. sips 미존재(비-macOS) 또는 실패 시 null. */
function imageDims(abs) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', abs], { encoding: 'utf8' });
    const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]);
    const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]);
    return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null;
  } catch {
    return null;
  }
}

/**
 * 한도 초과 이미지를 sips로 JPEG 정규화. resample=true면 최대변 7800px로 축소(초장문 이미지),
 * false면 재인코딩만(대용량 파일 압축·작은 이미지 업스케일 방지). 실패/미존재 시 null.
 */
function normalizeViaSips(abs, safeId, resample) {
  try {
    if (!existsSync(NORM_DIR)) mkdirSync(NORM_DIR, { recursive: true });
    const out = path.join(NORM_DIR, `${safeId}.jpg`);
    const argv = ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80'];
    if (resample) argv.push('--resampleHeightWidthMax', '7800');
    argv.push(abs, '--out', out);
    execFileSync('sips', argv, { stdio: 'ignore' });
    return out;
  } catch {
    return null;
  }
}

/** detail 레코드 → Batch 요청 1건(이미지 base64 포함). 처리 불가 이미지는 null 반환(스킵). */
async function toBatchRequest(rec) {
  const abs = path.join(REPO_ROOT, 'data', rec.localPath);
  // 카탈로그에는 레코드가 있어도 다운로드가 실패한 이미지가 있다(downloadImage 는 경고만 남긴다).
  // 여기서 던지면 배치 전체가 죽으므로 해당 건만 건너뛴다.
  let buf;
  try {
    buf = await readFile(abs);
  } catch {
    logger.warn('이미지 파일 없음 — 스킵', { id: rec.id, path: rec.localPath });
    return null;
  }
  let mediaType = detectMediaType(buf);
  if (!mediaType) {
    logger.warn('알 수 없는 이미지 포맷 — 스킵', { id: rec.id });
    return null;
  }
  // 크기/해상도 한도 초과 시 정규화(초과 이미지는 API가 거부함)
  const dims = imageDims(abs);
  const tooBig = buf.length > MAX_IMAGE_BYTES;
  const tooTall = dims != null && (dims.w > MAX_EDGE || dims.h > MAX_EDGE);
  if (tooBig || tooTall) {
    const safeId = rec.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const normPath = normalizeViaSips(abs, safeId, tooTall);
    if (!normPath) {
      logger.warn('크기 초과 이미지 정규화 실패(sips 필요) — 스킵', { id: rec.id, bytes: buf.length, dims });
      return null;
    }
    buf = await readFile(normPath);
    mediaType = 'image/jpeg';
  }
  const b64 = buf.toString('base64');
  return {
    custom_id: rec.id,
    params: {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    },
  };
}

/** 배치 결과 message → 구조화 객체. 실패 시 null. */
function parseResultMessage(message) {
  const textBlock = (message?.content || []).find((b) => b.type === 'text');
  if (!textBlock) return null;
  try {
    return JSON.parse(textBlock.text);
  } catch {
    return null;
  }
}

/** 배치 결과 + 카탈로그 레코드 → OCR 행(v2). */
function buildRow(rec, parsed, collectedAt) {
  return {
    id: rec.id,
    parentId: rec.parentId,
    productName: rec.productName,
    category: rec.category,
    imagePath: rec.localPath,
    // 세로 순서는 크롤러가 DOM Y좌표로 확정한 값을 쓴다(LLM 추정 금지).
    // 구 레코드(v1 크롤)에는 없으므로 id 접미 `_d{n}`에서 복원한다.
    sequenceIndex: rec.sequenceIndex ?? Number(String(rec.id).match(/_d(\d+)$/)?.[1]) ?? null,
    source: rec.source ?? null,
    rawText: parsed.rawText ?? '',
    appeals: parsed.appeals ?? [],
    ingredients: parsed.ingredients ?? [],
    trustBadges: parsed.trustBadges ?? [],
    blockType: parsed.blockType ?? 'noise',
    footnotes: parsed.footnotes ?? [],
    numericClaims: parsed.numericClaims ?? [],
    optionLabels: parsed.optionLabels ?? [],
    priceTerms: parsed.priceTerms ?? [],
    legalFlags: parsed.legalFlags ?? [],
    // 크롤러가 DOM에서 확증한 조건부 레이어 신호(이미지가 아니라 페이지 단위 사실)
    hasPromo: rec.hasPromo ?? null,
    optionCount: rec.optionCount ?? null,
    optionAxis: rec.optionAxis ?? null,
    isMallBanner: rec.isMallBanner ?? null,
    model: MODEL,
    collectedAt,
    schemaVersion: SCHEMA_VERSION,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(CATALOG_PATH)) {
    logger.error('product-catalog.jsonl 없음. 먼저 ②(rakuten-detail.mjs)를 실행하세요.');
    process.exit(1);
  }

  const details = await loadDetailRecords();
  const done = await loadDoneIds(args.forceReocr);
  let pending = details.filter((r) => !done.has(r.id));
  if (Number.isFinite(args.limit)) pending = pending.slice(0, args.limit);

  logger.info('OCR 대상', {
    schemaVersion: SCHEMA_VERSION,
    detailTotal: details.length,
    alreadyDoneAtV: done.size,
    thisRun: pending.length,
    forceReocr: args.forceReocr,
    estCostUSD: Number((pending.length * EST_COST_PER_IMAGE).toFixed(2)),
  });

  if (args.dryRun) {
    logger.info('dry-run — 전송하지 않고 종료');
    return;
  }
  if (pending.length === 0) {
    logger.info('처리할 이미지 없음(모두 OCR 완료)');
    return;
  }

  // SDK 클라이언트: .env 의 키가 있으면 사용, 없으면 SDK 기본 해석(ant 프로필 등)
  const apiKey = await readEnvValue('ANTHROPIC_API_KEY');
  const client = new Anthropic(apiKey ? { apiKey } : {});

  const byId = new Map(details.map((r) => [r.id, r]));
  const collectedAt = new Date().toISOString().slice(0, 10);
  let succeeded = 0,
    empty = 0,
    failed = 0,
    skipped = 0;

  /** 배치 1건을 끝까지 처리한다(폴링 → 결과 수집 → append). */
  async function drainBatch(batchId) {
    let batch;
    while (true) {
      batch = await client.messages.batches.retrieve(batchId);
      if (batch.processing_status === 'ended') break;
      logger.info('처리 중...', { batchId, status: batch.processing_status, counts: batch.request_counts });
      await sleep(POLL_INTERVAL_MS);
    }
    logger.info('배치 완료', { batchId, counts: batch.request_counts });

    for await (const result of await client.messages.batches.results(batchId)) {
      const rec = byId.get(result.custom_id);
      if (!rec) continue;
      if (result.result.type !== 'succeeded') {
        failed++;
        logger.warn('결과 실패', { id: result.custom_id, type: result.result.type });
        continue;
      }
      const parsed = parseResultMessage(result.result.message);
      if (!parsed) {
        failed++;
        continue;
      }
      const row = buildRow(rec, parsed, collectedAt);
      await appendFile(OCR_PATH, JSON.stringify(row) + '\n', 'utf8');
      if (row.rawText.trim()) succeeded++;
      else empty++;
    }
    if (existsSync(STATE_PATH)) await unlink(STATE_PATH);
  }

  // 중단된 배치가 있으면 먼저 회수한다
  if (existsSync(STATE_PATH)) {
    try {
      const st = JSON.parse(await readFile(STATE_PATH, 'utf8'));
      if (st.batchId) {
        logger.info('진행 중 배치 재개', { batchId: st.batchId });
        await drainBatch(st.batchId);
      }
    } catch {
      /* 손상 상태파일 무시 */
    }
  }

  // 크기 기준 청크로 나눠 순차 처리
  let chunk = [];
  let chunkBytes = 0;
  let chunkNo = 0;

  async function flushChunk() {
    if (chunk.length === 0) return;
    chunkNo++;
    logger.info('배치 생성 중...', { chunk: chunkNo, count: chunk.length, mb: Math.round(chunkBytes / 1024 / 1024) });
    let batch;
    try {
      batch = await client.messages.batches.create({ requests: chunk });
    } catch (err) {
      logger.error('배치 생성 실패 — 자격증명/요청 확인 필요', { reason: String(err?.message ?? err) });
      process.exit(1);
    }
    await writeFile(STATE_PATH, JSON.stringify({ batchId: batch.id, createdCount: chunk.length }), 'utf8');
    logger.info('배치 생성됨', { batchId: batch.id, status: batch.processing_status });
    chunk = [];
    chunkBytes = 0;
    await drainBatch(batch.id);
  }

  for (const rec of pending) {
    const req = await toBatchRequest(rec);
    if (!req) {
      skipped++;
      continue;
    }
    const size = JSON.stringify(req).length;
    if (chunk.length > 0 && (chunkBytes + size > MAX_BATCH_BYTES || chunk.length >= MAX_BATCH_REQUESTS)) {
      await flushChunk();
    }
    chunk.push(req);
    chunkBytes += size;
  }
  await flushChunk();

  if (skipped > 0) logger.info('스킵된 이미지', { skipped });

  // 재OCR된 id의 구 행을 정리한다(append-only라 이 압축이 없으면 v1·v2가 공존)
  const compacted = await compactOcrFile();

  logger.info('완료', {
    succeeded,
    emptyText: empty,
    failed,
    skipped,
    compactedRows: compacted.kept,
    removedStaleRows: compacted.removed,
    out: path.relative(REPO_ROOT, OCR_PATH),
  });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
