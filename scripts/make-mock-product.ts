/**
 * 템플릿 프리뷰용 **가공 제품컷** 1장을 만든다(1회성 — 산출물은 커밋한다).
 *
 * 왜 필요한가 — 프리뷰 6장은 제품 대표컷을 편집 원본으로 쓴다. 그런데 기존 샘플
 * `haruon-before.jpg` 는 assets/README 가 "실제 K뷰티 제품의 실물 컷"이라 명시한 타사 제품이라,
 * 그걸로 구운 이미지를 제품 UI(템플릿 카드)에 상시 노출하면 README 사용조건 3에 어긋난다.
 * 그래서 실존 제품이 아닌 가상 브랜드용 용기를 따로 생성해 둔다.
 *
 * 사용: npm run detail:mockproduct
 * 산출: docs/specs/02-studio/assets/samples/haruon-mock-product.png
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { currentImageMode } from '../lib/studio/imageGen';
import { generateBlockVisual } from '../lib/studio/detail/imageGen';

const OUT = path.join(process.cwd(), 'docs/specs/02-studio/assets/samples/haruon-mock-product.png');

/**
 * 실존 브랜드를 닮지 않도록 **무지(無地) 용기**를 요청한다.
 * 라벨 인쇄를 넣으면 (a) 특정 브랜드를 닮을 위험이 있고 (b) 이미지 안 글자 금지 원칙과도 어긋난다.
 */
const PROMPT = [
  'A single unbranded cosmetic serum bottle standing upright on a clean studio surface.',
  'Frosted off-white glass body with a matte sand-beige cap and a plain dropper. Completely blank packaging.',
  'Soft diffused daylight from the upper left, gentle contact shadow, seamless pale warm-grey background.',
  'Centered, full product visible with generous margins, product photography, sharp focus, no props.',
  '',
  'Strict requirements:',
  '- No text, letters, kana, kanji, hangul, numbers, captions, labels, logos, badges, or watermarks anywhere in the image.',
  '- The packaging must be completely blank — no printed brand name, no ingredient text, no icons.',
  '- Do not imitate any existing real-world cosmetic brand, bottle silhouette, or label design.',
  '- No people, hands, or body parts.',
].join('\n');

async function main() {
  if (currentImageMode() === 'mock') {
    throw new Error('OPENAI_API_KEY 가 필요합니다 — 목 모드에서는 단색 이미지만 나와 제품컷으로 쓸 수 없습니다.');
  }
  if (existsSync(OUT) && !process.argv.includes('--force')) {
    console.log(`이미 있습니다: ${path.relative(process.cwd(), OUT)} (--force 로 다시 만들 수 있습니다)`);
    return;
  }
  mkdirSync(path.dirname(OUT), { recursive: true });

  const t0 = Date.now();
  // 편집 원본 없이 generate 로 간다 — 가공 용기를 새로 만드는 것이 목적이다
  const gen = await generateBlockVisual({ prompt: PROMPT, blockType: 'hero-product' });
  writeFileSync(OUT, gen.buf);
  console.log(
    `가공 제품컷 생성 — ${(gen.buf.length / 1024).toFixed(0)}KB · ${((Date.now() - t0) / 1000).toFixed(1)}s\n` +
      `산출: ${path.relative(process.cwd(), OUT)}`,
  );
}

main().catch((err) => {
  console.error('실패:', err?.stack ?? err);
  process.exit(1);
});
