/**
 * AI 에이전트 UT용 **무지(無地) 제품컷** 6종을 만든다 (1회성 — 산출물은 커밋한다).
 *
 * 왜 필요한가 — UT에서 페르소나 20인이 썸네일 1장·상세페이지 1건을 각각 생성하는데,
 * 두 API 모두 제품 이미지가 **필수**다(app/api/studio/thumbnail·detail). 그런데
 * `docs/specs/02-studio/assets/samples/haruon-before.jpg` 는 assets/README 가
 * "실제 K뷰티 제품의 실물 컷"이라 명시한 타사 제품이라 UT 산출물의 편집 원본으로 쓸 수 없다.
 * `haruon-mock-product.png`(무지 세럼 병)가 이미 있으므로 그건 재사용하고, 나머지
 * 카테고리 5종만 같은 원칙으로 생성한다.
 *
 * 왜 웹 다운로드가 아닌 생성인가 — CC0 스톡에는 단일·무라벨·클린배경 화장품 컷이 사실상 없다
 * (대부분 빈티지 클립아트이거나 라벨이 붙은 다중 제품 사진). 편집 원본은 제품 하나가
 * 화면 중앙에 서 있고 배경이 비어 있어야 `images.edit` 가 제대로 동작한다.
 *
 * 사용: node --env-file-if-exists=.env scripts/ut/make-ut-products.mjs [--force] [--only tint,suncare]
 * 산출: docs/research/ut-agent/fixtures/products/product-{id}.jpg  (+ usage.json 비용 실측)
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs/research/ut-agent/fixtures/products');
const SEED_SERUM = path.join(ROOT, 'docs/specs/02-studio/assets/samples/haruon-mock-product.png');

/** 상세 파이프라인이 쓰는 세로 규격 그대로 — 편집 원본을 같은 비율로 맞춘다 */
const SIZE = '1024x1536';
const QUALITY = process.env.OPENAI_IMAGE_QUALITY ?? 'medium';
const MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2';

/** gpt-image-2 토큰 단가 (USD / 1M) — https://developers.openai.com/api/docs/pricing · 확인 2026-08-20 */
const PRICE = {
  imageIn: Number(process.env.OPENAI_IMAGE_PRICE_IMAGE_IN ?? 8),
  cachedIn: Number(process.env.OPENAI_IMAGE_PRICE_CACHED_IN ?? 2),
  textIn: Number(process.env.OPENAI_IMAGE_PRICE_TEXT_IN ?? 5),
  out: Number(process.env.OPENAI_IMAGE_PRICE_OUT ?? 30),
};

/**
 * 모든 컷이 공유하는 제약. 실존 브랜드를 닮지 않도록 **무지 용기**를 요청하고,
 * 이미지 안 글자를 전면 금지한다(② 파이프라인의 negative 1순위와 같은 원칙).
 */
const COMMON = [
  '',
  'Strict requirements:',
  '- No text, letters, kana, kanji, hangul, numbers, captions, labels, logos, badges, or watermarks anywhere in the image.',
  '- The packaging must be completely blank — no printed brand name, no ingredient text, no icons.',
  '- Do not imitate any existing real-world cosmetic brand, container silhouette, or label design.',
  '- No people, hands, or body parts. No props, no flowers, no leaves.',
  '- Centered, full product visible with generous margins, product photography, sharp focus.',
].join('\n');

/** 카테고리별 컷. id 는 fixtures 의 productImage 경로 키가 된다. */
const PRODUCTS = [
  {
    id: 'serum',
    label: '세럼·앰플 (드로퍼 병)',
    seed: SEED_SERUM, // 이미 있는 자산을 재사용 — 새로 굽지 않는다
    prompt: null,
  },
  {
    id: 'cream',
    label: '크림 (자)',
    prompt: [
      'A single unbranded cosmetic cream jar standing on a clean studio surface.',
      'Wide squat jar with a matte cream-white ceramic-look body and a smooth pale beige screw lid. Completely blank packaging.',
      'Soft diffused daylight from the upper left, gentle contact shadow, seamless pale warm-grey background.',
    ].join('\n'),
  },
  {
    id: 'toner',
    label: '토너 (펌프 병)',
    prompt: [
      'A single unbranded cosmetic toner bottle standing upright on a clean studio surface.',
      'Tall slim cylindrical bottle in translucent pale glass with a simple matte white pump head. Completely blank packaging.',
      'Soft diffused daylight from the upper left, gentle contact shadow, seamless pale warm-grey background.',
    ].join('\n'),
  },
  {
    id: 'tint',
    label: '립·틴트 (색조)',
    prompt: [
      'A single unbranded lip tint applicator standing upright on a clean studio surface.',
      'Slim glossy cylindrical tube in soft coral-rose with a matte cap of the same tone. Completely blank packaging.',
      'Soft diffused daylight from the upper left, gentle contact shadow, seamless pale warm-grey background.',
    ].join('\n'),
  },
  {
    id: 'suncare',
    label: '선크림 (튜브)',
    prompt: [
      'A single unbranded sunscreen squeeze tube standing upright on its flip cap on a clean studio surface.',
      'Soft matte tube in pale ivory with a simple white flip-top cap. Completely blank packaging.',
      'Soft diffused daylight from the upper left, gentle contact shadow, seamless pale warm-grey background.',
    ].join('\n'),
  },
  {
    id: 'cleansing',
    label: '클렌징 폼 (튜브)',
    prompt: [
      'A single unbranded cleansing foam squeeze tube lying-free and standing upright on a clean studio surface.',
      'Slim matte tube in soft grey-white with a small white screw cap. Completely blank packaging.',
      'Soft diffused daylight from the upper left, gentle contact shadow, seamless pale warm-grey background.',
    ].join('\n'),
  },
];

/** OpenAI images 응답의 usage → USD. usage 가 없으면 null(추정치로 채우지 않는다). */
function costUsd(usage) {
  if (!usage) return null;
  const d = usage.input_tokens_details ?? {};
  const cached = d.cached_tokens ?? 0;
  const imageIn = Math.max(0, (d.image_tokens ?? 0) - cached);
  const textIn = d.text_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  return (imageIn * PRICE.imageIn + cached * PRICE.cachedIn + textIn * PRICE.textIn + out * PRICE.out) / 1_000_000;
}

const log = (msg) => process.stdout.write(`${msg}\n`);

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY 가 없습니다.\n' +
        '원인: .env 미로드 / 해결: node --env-file-if-exists=.env scripts/ut/make-ut-products.mjs',
    );
  }
  const force = process.argv.includes('--force');
  const onlyArg = process.argv.indexOf('--only');
  const only = onlyArg > -1 ? (process.argv[onlyArg + 1] ?? '').split(',').filter(Boolean) : null;

  mkdirSync(OUT_DIR, { recursive: true });
  const client = new OpenAI({ timeout: 180_000, maxRetries: 2 });

  const usagePath = path.join(OUT_DIR, 'usage.json');
  const ledger = existsSync(usagePath)
    ? JSON.parse(readFileSync(usagePath, 'utf8'))
    : { model: MODEL, quality: QUALITY, size: SIZE, calls: [] };

  for (const p of PRODUCTS) {
    if (only && !only.includes(p.id)) continue;
    const out = path.join(OUT_DIR, `product-${p.id}.jpg`);
    if (existsSync(out) && !force) {
      log(`· 건너뜀 (이미 있음): product-${p.id}.jpg`);
      continue;
    }

    // 씨앗 자산이 있는 컷은 굽지 않고 규격만 맞춰 옮긴다 — 콜을 아낀다
    if (p.seed) {
      const buf = await sharp(p.seed).resize(1024, 1536, { fit: 'cover' }).jpeg({ quality: 92 }).toBuffer();
      writeFileSync(out, buf);
      log(`· 재사용: product-${p.id}.jpg  (${(buf.length / 1024).toFixed(0)}KB) ← ${path.relative(ROOT, p.seed)}`);
      continue;
    }

    const t0 = Date.now();
    const res = await client.images.generate({
      model: MODEL,
      prompt: `${p.prompt}${COMMON}`,
      size: SIZE,
      quality: QUALITY,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error(`${p.id}: 응답에 b64_json 이 없습니다 — 모델 ID·파라미터를 확인하세요.`);

    const png = Buffer.from(b64, 'base64');
    const jpg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
    writeFileSync(out, jpg);

    const usd = costUsd(res.usage);
    ledger.calls.push({
      id: p.id,
      call: 'generate',
      size: SIZE,
      quality: QUALITY,
      usage: res.usage ?? null,
      usd,
      elapsedMs: Date.now() - t0,
    });
    writeFileSync(usagePath, `${JSON.stringify(ledger, null, 2)}\n`);

    log(
      `· 생성: product-${p.id}.jpg  (${(jpg.length / 1024).toFixed(0)}KB · ${((Date.now() - t0) / 1000).toFixed(1)}s` +
        `${usd === null ? ' · usage 없음' : ` · $${usd.toFixed(4)}`})`,
    );
  }

  const measured = ledger.calls.filter((c) => typeof c.usd === 'number');
  if (measured.length) {
    const total = measured.reduce((a, c) => a + c.usd, 0);
    log(
      `\n실측 — ${measured.length}콜 · 합계 $${total.toFixed(4)} · 장당 평균 $${(total / measured.length).toFixed(4)}` +
        `  (${SIZE} · ${QUALITY} · ${MODEL})`,
    );
    log(`원장: ${path.relative(ROOT, usagePath)}`);
  }
}

main().catch((err) => {
  process.stderr.write(`실패: ${err?.stack ?? err}\n`);
  process.exit(1);
});
