/**
 * ② 마케팅 스튜디오 프로토타입 이미지 자산 빌드.
 *
 * 두 종류를 만든다 — 성격이 다르므로 폴더도 라벨도 분리한다.
 *   assets/templates/  실측 참고 컷 8종. ①의 assets/market/ 원본을 800×800으로 정규화만 한다.
 *                      (타사 저작물 · 분석 인용 · 비배포 한정 — assets/README.md)
 *   assets/samples/    HARUON 데모 생성물 5장. docs/presentation/샘플.png 에서 파생한 우리 자산.
 *
 * 샘플 파생 방식: 원본에서 오버레이(좌상단 브랜드 칩·하단 스펙 칩)를 지운 "클린 베이스"를 만들고,
 * 그 위에 문법별 오버레이를 얹어 1024×1024로 굽는다. 카피 문구는 새로 짓지 않고
 * 프로토타입에 이미 있는 문자열만 옮긴다(증거 원칙 — 02-thumbnail-converter-spec.md §3).
 *
 * 이미지는 data URI로 페이지에 주입한다 — file:// 로 로드하면 canvas가 오염돼 getImageData가 막힌다.
 *
 * 실행: node scripts/build-studio-assets.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marketDir = path.join(root, 'docs/specs/01-report/assets/market');
const outDir = path.join(root, 'docs/specs/02-studio/assets');
const tplDir = path.join(outDir, 'templates');
const smpDir = path.join(outDir, 'samples');

/** 실측 참고 컷 — 파일명은 템플릿 키 순서로 바꿔 화면 마크업에서 바로 읽히게 한다 */
const TEMPLATES = [
  { out: '01-clean.jpg', src: 'thumb-A_amazon_B0BT99BF83.jpg' },
  { out: '02-texture.jpg', src: 'thumb-B_amazon_B0BY8NVDX5.jpg' },
  { out: '03-official.jpg', src: 'thumb-C_rakuten_aestura-japan_atobarrier365cream.jpg' },
  { out: '04-copy-ingredient.jpg', src: 'thumb-D_rakuten_kiso_kiso-k47.jpg' },
  { out: '05-award.jpg', src: 'thumb-E_rakuten_tvert_352.jpg' },
  { out: '06-model.jpg', src: 'thumb-F_rakuten_norm-plus_nm1007-f.jpg' },
  { out: '07-promo.jpg', src: 'thumb-G_qoo10_8365200734.jpg' },
  { out: '08-premium.jpg', src: 'thumb-H_rakuten_attenir_132551.jpg' },
];

/** 샘플.png(1254²) 실측 좌표 — 지울 오버레이 사각형과 하단 카피 밴드 시작점 */
const SRC = { size: 1254, bandTop: 1107 };
const WIPE = [
  { x0: 20, y0: 24, x1: 528, y1: 112 },   // 좌상단 "Chasin' Rabbits 公式ショップ" 칩
  { x0: 26, y0: 992, x1: 766, y1: 1086 }, // 하단 스펙 칩 3종 (SPF50+ · PA++++ · 顔・からだ用)
];

const dataUri = (p, mime) => `data:${mime};base64,${readFileSync(p).toString('base64')}`;
const writeDataUrl = (file, url) =>
  writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));

mkdirSync(tplDir, { recursive: true });
mkdirSync(smpDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
await page.goto('about:blank');

/** 캔버스 유틸을 페이지에 심는다 — 리사이즈·인페인트·굽기가 전부 여기서 일어난다 */
await page.addScriptTag({
  content: `
  window.loadImg = (src) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src;
  });

  /** 정사각 리사이즈 — 원본이 1:1이 아니면 중앙 크롭 */
  window.square = async (src, size, mime, q) => {
    const im = await loadImg(src);
    const s = Math.min(im.width, im.height);
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);
    return cv.toDataURL(mime, q);
  };

  /**
   * 사각형 영역을 위/아래 경계 픽셀의 세로 선형 보간으로 덮는다.
   * 하늘·구름처럼 세로로 완만한 배경에서 오버레이만 지울 때 가장 자연스럽다.
   */
  window.wipeRect = (ctx, r, pad) => {
    const w = r.x1 - r.x0, h = r.y1 - r.y0 + pad * 2;
    const top = ctx.getImageData(r.x0, r.y0 - pad, w, 1).data;
    const bot = ctx.getImageData(r.x0, r.y1 + pad, w, 1).data;
    const out = ctx.createImageData(w, h);
    for (let j = 0; j < h; j++) {
      const t = j / (h - 1);
      for (let i = 0; i < w; i++) {
        const s = i * 4, d = (j * w + i) * 4;
        for (let k = 0; k < 3; k++) out.data[d + k] = top[s + k] * (1 - t) + bot[s + k] * t;
        out.data[d + 3] = 255;
      }
    }
    ctx.putImageData(out, r.x0, r.y0 - pad);
  };

  /** 샘플.png → 오버레이 제거 + 하단 밴드 크롭 + 정사각 1024 클린 베이스 */
  window.cleanBase = async (src, cfg, wipes, size) => {
    const im = await loadImg(src);
    const cv = document.createElement('canvas'); cv.width = cv.height = cfg.size;
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, cfg.size, cfg.size);
    wipes.forEach((r) => wipeRect(x, r, 6));
    const side = cfg.bandTop;                 // 밴드를 잘라낸 높이에 맞춰 좌우 대칭 크롭
    const sx = Math.round((cfg.size - side) / 2);
    const out = document.createElement('canvas'); out.width = out.height = size;
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    o.drawImage(cv, sx, 0, side, side, 0, 0, size, size);
    return out.toDataURL('image/png');
  };
  `,
});

// ── 1. 실측 참고 컷 8종 정규화 ─────────────────────────────
for (const t of TEMPLATES) {
  const url = await page.evaluate(
    ([src]) => window.square(src, 800, 'image/jpeg', 0.86),
    [dataUri(path.join(marketDir, t.src), 'image/jpeg')],
  );
  writeDataUrl(path.join(tplDir, t.out), url);
  process.stdout.write(`  ok  templates/${t.out}\n`);
}

// ── 2. KR 원본(Before) ────────────────────────────────────
const beforeUrl = await page.evaluate(
  ([src]) => window.square(src, 1024, 'image/jpeg', 0.9),
  [dataUri(path.join(root, 'docs/presentation/샘플원본.webp'), 'image/webp')],
);
writeDataUrl(path.join(smpDir, 'haruon-before.jpg'), beforeUrl);
process.stdout.write('  ok  samples/haruon-before.jpg\n');

// ── 3. 클린 베이스 (오버레이 제거본) ───────────────────────
const sampleUri = dataUri(path.join(root, 'docs/presentation/샘플.png'), 'image/png');
const baseUrl = await page.evaluate(
  ([src, cfg, wipes]) => window.cleanBase(src, cfg, wipes, 1024),
  [sampleUri, SRC, WIPE],
);

// ── 4. 문법별 샘플 4종 ─────────────────────────────────────
const JP = `font-family:'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif`;

/** 각 샘플은 1024×1024 스테이지에 베이스 + 오버레이를 얹어 스크린샷으로 굽는다 */
const SAMPLES = [
  {
    // 공식샵 신뢰 배지형 — 원본 구성을 그대로 두고 브랜드 칩만 HARUON으로 덮는다
    file: 'haruon-official.png',
    base: sampleUri,
    layers: `
      <div style="position:absolute;left:1.4%;top:1.8%;display:flex;height:6.6%;border-radius:11px;overflow:hidden;box-shadow:0 2px 8px rgba(34,48,79,.14)">
        <span style="display:flex;align-items:center;padding:0 22px;background:#fff;border:2px solid #22304F;border-right:none;border-radius:11px 0 0 11px;color:#22304F;font-size:34px;font-weight:800;letter-spacing:.01em">HARUON</span>
        <span lang="ja" style="display:flex;align-items:center;padding:0 20px;background:#22304F;color:#fff;font-size:30px;font-weight:700;${JP}">公式ショップ</span>
      </div>`,
  },
  {
    // 클린 스튜디오 단독컷 — 배경을 화이트로 날리고 제품만 남긴다
    file: 'haruon-clean.png',
    base: baseUrl,
    stage: 'background:#fff',
    // 배경만 화이트로 날리되 제품 대비는 남긴다 — 카드 크기로 줄었을 때 제품이 사라지지 않도록
    baseStyle: 'filter:brightness(1.06) saturate(.8);transform:scale(.94)',
    layers: `
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 44%,rgba(255,255,255,0) 32%,rgba(255,255,255,.46) 58%,#fff 84%)"></div>`,
  },
  {
    // 캐치카피+성분 비주얼형 — 대형 JP 카피 + 성분 버블 + 조건 각주
    file: 'haruon-copy-ingredient.png',
    base: baseUrl,
    layers: `
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,251,240,.5),rgba(255,255,255,.08) 46%,rgba(255,255,255,.5))"></div>
      <div style="position:absolute;left:7%;top:26%;width:20%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.95),rgba(169,212,245,.62));box-shadow:0 6px 20px rgba(60,110,170,.16)"></div>
      <div style="position:absolute;right:9%;top:44%;width:13%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.95),rgba(169,212,245,.58));box-shadow:0 6px 20px rgba(60,110,170,.14)"></div>
      <div style="position:absolute;left:16%;top:62%;width:9%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.92),rgba(169,212,245,.5))"></div>
      <p lang="ja" style="position:absolute;left:6.5%;top:6%;margin:0;font-size:66px;font-weight:800;line-height:1.3;letter-spacing:-.01em;color:#1B2740;text-shadow:0 2px 16px rgba(255,255,255,.9);${JP}">白浮きしない、<br />透け感UV</p>
      <p lang="ja" style="position:absolute;left:6.5%;bottom:4.5%;margin:0;font-size:22px;font-weight:600;color:#5A6472;${JP}">※メーキャップ効果による</p>`,
  },
  {
    // 제품+텍스처 스와치 — 무텍스트 컷. 제형 스와치만 곁들인다
    file: 'haruon-texture.png',
    base: baseUrl,
    backdrop: true,
    baseStyle:
      'transform:scale(.88) translate(9%,-5%);' +
      'mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent),' +
      'linear-gradient(180deg,transparent,#000 6%,#000 94%,transparent);mask-composite:intersect',
    // 제형 스와치는 제품을 가리지 않게 빈 하늘 쪽(좌하단)에 앉힌다
    layers: `
      <div style="position:absolute;left:6%;bottom:11%;width:27%;aspect-ratio:1/.82;border-radius:58% 42% 46% 54%/62% 56% 44% 38%;background:radial-gradient(120% 90% at 34% 26%,#fff 6%,#FBF4EC 42%,#EEDFD0 78%,#E3D0BE);box-shadow:0 14px 34px rgba(80,100,130,.16),inset 0 -6px 14px rgba(190,168,146,.28);transform:rotate(-14deg)"></div>
      <div style="position:absolute;left:22%;bottom:26%;width:7%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.95),rgba(255,255,255,0) 72%)"></div>
      <div style="position:absolute;left:9%;bottom:9%;width:19%;height:5%;border-radius:50%;background:radial-gradient(50% 100% at 50% 0,rgba(120,140,170,.16),transparent);filter:blur(3px)"></div>`,
  },
  {
    // 수상 실적 스택형 — 배지가 본체. 문구는 생성 폼의 실적 3필드 예시 그대로다
    file: 'haruon-award.png',
    base: baseUrl,
    backdrop: true,
    baseStyle:
      'transform:scale(.86) translate(12%,0);' +
      'mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent),' +
      'linear-gradient(180deg,transparent,#000 6%,#000 94%,transparent);mask-composite:intersect',
    layers: `
      <div style="position:absolute;left:5%;top:16%;display:flex;flex-direction:column;gap:26px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;width:272px;padding:22px 14px;border-radius:16px;background:rgba(255,255,255,.93);box-shadow:0 10px 28px rgba(34,48,79,.16)">
          <span style="width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 34% 28%,#F6DC9A,#C9982F);display:flex;align-items:center;justify-content:center;color:#3A2B08;font-size:30px;font-weight:800">1</span>
          <span lang="ja" style="font-size:25px;font-weight:800;color:#22304F;white-space:nowrap;${JP}">楽天ランキング1位</span>
          <span lang="ja" style="font-size:19px;font-weight:600;color:#5A6472;white-space:nowrap;${JP}">日焼け止め部門</span>
        </div>
        <div style="width:272px;padding:12px;border-radius:12px;background:rgba(255,255,255,.88);text-align:center">
          <span lang="ja" style="font-size:17px;font-weight:600;color:#6B7280;${JP}">2026/6/14更新</span>
        </div>
      </div>`,
  },
  {
    // 프리미엄 무드형 — 시네마틱 어두운 연출 + 세로쓰기 카피
    file: 'haruon-premium.png',
    base: baseUrl,
    baseStyle: 'filter:brightness(.52) saturate(.72) contrast(1.08)',
    layers: `
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 46% 38%,rgba(58,40,68,.18),rgba(20,14,26,.86) 78%)"></div>
      <p lang="ja" style="position:absolute;right:7%;top:9%;margin:0;writing-mode:vertical-rl;font-size:52px;font-weight:700;letter-spacing:.14em;line-height:1.5;color:#F3E7D8;text-shadow:0 2px 18px rgba(0,0,0,.5);${JP}">透明感トーンアップUV</p>
      <div style="position:absolute;left:8%;bottom:8%;width:26%;height:2px;background:linear-gradient(90deg,rgba(243,231,216,.85),transparent)"></div>`,
  },
  {
    // 프로모션 강조형 — 상단 세트 밴드 + GIFT 스티커 + 하단 가격 패널
    file: 'haruon-promo.png',
    base: baseUrl,
    // 상·하단 밴드가 화면을 30% 이상 먹으므로 제품을 축소해 밴드 사이에 앉힌다.
    // 축소로 생기는 가장자리는 같은 사진을 확대·블러한 배경판으로 메운다(둘 다 하늘이라 이음매가 없다).
    backdrop: true,
    baseStyle:
      'transform:scale(.84) translateY(3%);' +
      // 축소된 사진의 네 변을 페더링해 배경판과의 이음매를 없앤다
      'mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent),' +
      'linear-gradient(180deg,transparent,#000 6%,#000 94%,transparent);mask-composite:intersect',
    layers: `
      <div lang="ja" style="position:absolute;left:0;right:0;top:0;height:15%;background:#E7638C;display:flex;align-items:center;justify-content:center;color:#fff;font-size:52px;font-weight:800;letter-spacing:.02em;${JP}">選べる2個セット</div>
      <div lang="ja" style="position:absolute;right:5%;top:19%;width:25%;aspect-ratio:1/1;border-radius:18px;background:#fff;border:3px dashed #E7638C;display:flex;align-items:center;justify-content:center;color:#C6362C;font-size:34px;font-weight:800;box-shadow:0 8px 22px rgba(199,54,44,.14);${JP}">限定GIFT</div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:21%;background:#fff;border-top:3px solid #F3C2CF;display:flex;align-items:center;justify-content:center;gap:18px">
        <span lang="ja" style="display:inline-flex;align-items:center;height:52px;padding:0 18px;border-radius:9px;background:#FFEDF2;color:#C6362C;font-size:30px;font-weight:800;${JP}">2個セット</span>
        <span lang="ja" style="font-size:96px;font-weight:800;color:#C6362C;line-height:1;${JP}">¥1,999</span>
        <span lang="ja" style="font-size:30px;font-weight:600;color:#8A8F98;${JP}">（税込）</span>
      </div>`,
  },
];

for (const s of SAMPLES) {
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:1024px;height:1024px;overflow:hidden}</style>
    <div id="stage" style="position:relative;width:1024px;height:1024px;overflow:hidden;${s.stage || ''}">
      ${s.backdrop ? `<img src="${s.base}" alt="" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.5);filter:blur(26px) saturate(1.05)" />` : ''}
      <img src="${s.base}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${s.baseStyle || ''}" />
      ${s.layers}
    </div>`);
  await page.waitForTimeout(220);
  await page.locator('#stage').screenshot({ path: path.join(smpDir, s.file) });
  process.stdout.write(`  ok  samples/${s.file}\n`);
}

await browser.close();
process.stdout.write(`\n${TEMPLATES.length + SAMPLES.length + 1}개 자산 생성 → docs/specs/02-studio/assets/\n`);
