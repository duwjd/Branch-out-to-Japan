/**
 * 상세페이지 이미지 OCR 파이프라인 — Claude 비전 + Message Batches API.
 * ②가 모은 라쿠텐 상세 이미지(type=detail)를 일본어 OCR로 텍스트화하고
 * 소구 문장·성분·신뢰배지를 구조화 추출한다. → ①② 및 렉시콘의 코퍼스.
 *
 * 방식: Batch API(비동기·50% 할인). 이미지 1장 = 요청 1건, custom_id = detail 이미지 id.
 * 모델: claude-sonnet-5 (일본어 OCR 정확도·비용 균형). 사고(thinking) 비활성 — OCR은 인지 작업.
 *
 * 산출: data/processed/detail-ocr.jsonl (한 줄 = 이미지 1건, 파생 텍스트라 커밋 대상)
 * 재실행 안전: 이미 OCR된 id는 스킵. 배치 진행 중 중단돼도 상태파일로 재개.
 *
 * 사용:
 *   node scripts/crawl/ocr-detail.mjs --dry-run     # 건수·예상비용만(무전송)
 *   node scripts/crawl/ocr-detail.mjs --limit 3     # 소량 실제 배치(스모크)
 *   node scripts/crawl/ocr-detail.mjs               # 전체
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
const MAX_EDGE = 8000;                    // Claude 비전 한 변 최대 px

// 대략 비용 추정(Batch 50% 할인, Sonnet5 인트로가 기준: in $1/MTok, out $5/MTok)
const EST_INPUT_TOKENS = 2500; // 상세 이미지 1장 ≈ (고해상 근접)
const EST_OUTPUT_TOKENS = 900;
const EST_COST_PER_IMAGE = (EST_INPUT_TOKENS * 1 + EST_OUTPUT_TOKENS * 5) / 1_000_000;

/** 구조화 출력 스키마 — OCR 원문 + 분류. */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rawText: { type: 'string', description: '이미지 내 모든 일본어 텍스트를 그대로' },
    appeals: { type: 'array', items: { type: 'string' }, description: '소구 문장(효능·감성 카피)' },
    ingredients: { type: 'array', items: { type: 'string' }, description: '언급된 성분' },
    trustBadges: { type: 'array', items: { type: 'string' }, description: '신뢰배지/인증(医薬部外品·랭킹·무첨가 등)' },
  },
  required: ['rawText', 'appeals', 'ingredients', 'trustBadges'],
};

const PROMPT =
  'これは日本のECサイトの商品詳細ページ画像です。画像内のすべての日本語テキストをそのまま抜き出し（rawText）、' +
  '訴求文（効能・感情に訴えるコピー）をappeals、記載された成分をingredients、' +
  '信頼バッジ・認証（医薬部外品・ランキング1位・無添加など）をtrustBadgesに分類してください。' +
  '該当がない項目は空配列にしてください。テキストが読み取れない場合はrawTextを空文字にしてください。';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const out = { limit: Infinity, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') out.limit = Number(argv[++i]);
    else if (argv[i] === '--dry-run') out.dryRun = true;
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
    } catch { /* skip */ }
  }
  return out;
}

/** 이미 OCR 완료된 id 집합. */
async function loadDoneIds() {
  if (!existsSync(OCR_PATH)) return new Set();
  const text = await readFile(OCR_PATH, 'utf8');
  const ids = new Set();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { ids.add(JSON.parse(line).id); } catch { /* skip */ }
  }
  return ids;
}

/** 매직바이트로 실제 이미지 타입 판별(확장자가 .jpg여도 실제는 GIF/WebP인 셀러 이미지 대응). */
function detectMediaType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** sips로 픽셀 크기 조회. sips 미존재(비-macOS) 또는 실패 시 null. */
function imageDims(abs) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', abs], { encoding: 'utf8' });
    const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]);
    const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]);
    return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null;
  } catch { return null; }
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
  } catch { return null; }
}

/** detail 레코드 → Batch 요청 1건(이미지 base64 포함). 처리 불가 이미지는 null 반환(스킵). */
async function toBatchRequest(rec) {
  const abs = path.join(REPO_ROOT, 'data', rec.localPath);
  let buf = await readFile(abs);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(CATALOG_PATH)) {
    logger.error('product-catalog.jsonl 없음. 먼저 ②(rakuten-detail.mjs)를 실행하세요.');
    process.exit(1);
  }

  const details = await loadDetailRecords();
  const done = await loadDoneIds();
  let pending = details.filter((r) => !done.has(r.id));
  if (Number.isFinite(args.limit)) pending = pending.slice(0, args.limit);

  logger.info('OCR 대상', {
    detailTotal: details.length,
    alreadyDone: done.size,
    thisRun: pending.length,
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

  // 진행 중 배치가 있으면 재개, 없으면 새로 생성
  let batchId = null;
  if (existsSync(STATE_PATH)) {
    try {
      const st = JSON.parse(await readFile(STATE_PATH, 'utf8'));
      batchId = st.batchId;
      logger.info('진행 중 배치 재개', { batchId });
    } catch { /* 손상 상태파일 무시 */ }
  }

  if (!batchId) {
    logger.info('배치 요청 생성 중...', { count: pending.length });
    const requests = [];
    for (const rec of pending) {
      const req = await toBatchRequest(rec);
      if (req) requests.push(req);
    }
    if (requests.length === 0) {
      logger.info('전송할 유효 이미지 없음(모두 스킵됨)');
      return;
    }
    if (requests.length < pending.length) {
      logger.info('일부 이미지 스킵', { valid: requests.length, skipped: pending.length - requests.length });
    }
    let batch;
    try {
      batch = await client.messages.batches.create({ requests });
    } catch (err) {
      logger.error('배치 생성 실패 — 자격증명/요청 확인 필요', { reason: String(err?.message ?? err) });
      process.exit(1);
    }
    batchId = batch.id;
    await writeFile(STATE_PATH, JSON.stringify({ batchId, createdCount: requests.length }), 'utf8');
    logger.info('배치 생성됨', { batchId, status: batch.processing_status });
  }

  // 완료까지 폴링
  let batch;
  while (true) {
    batch = await client.messages.batches.retrieve(batchId);
    if (batch.processing_status === 'ended') break;
    logger.info('처리 중...', { status: batch.processing_status, counts: batch.request_counts });
    await sleep(POLL_INTERVAL_MS);
  }
  logger.info('배치 완료', { counts: batch.request_counts });

  // 결과 수집 → custom_id 로 부모 매칭 → append
  const byId = new Map(details.map((r) => [r.id, r]));
  const collectedAt = new Date().toISOString().slice(0, 10);
  let succeeded = 0, empty = 0, failed = 0;
  for await (const result of await client.messages.batches.results(batchId)) {
    const rec = byId.get(result.custom_id);
    if (!rec) continue;
    if (result.result.type !== 'succeeded') {
      failed++;
      logger.warn('결과 실패', { id: result.custom_id, type: result.result.type });
      continue;
    }
    const parsed = parseResultMessage(result.result.message);
    if (!parsed) { failed++; continue; }
    const row = {
      id: rec.id,
      parentId: rec.parentId,
      productName: rec.productName,
      category: rec.category,
      imagePath: rec.localPath,
      rawText: parsed.rawText ?? '',
      appeals: parsed.appeals ?? [],
      ingredients: parsed.ingredients ?? [],
      trustBadges: parsed.trustBadges ?? [],
      model: MODEL,
      collectedAt,
    };
    await appendFile(OCR_PATH, JSON.stringify(row) + '\n', 'utf8');
    if (row.rawText.trim()) succeeded++; else empty++;
  }

  // 완료됐으니 상태파일 제거(다음 실행은 남은 이미지로 새 배치를 생성)
  if (existsSync(STATE_PATH)) await unlink(STATE_PATH);

  logger.info('완료', { succeeded, emptyText: empty, failed, out: path.relative(REPO_ROOT, OCR_PATH) });
}

main().catch((err) => {
  logger.error('치명적 오류', { reason: String(err?.stack ?? err) });
  process.exit(1);
});
