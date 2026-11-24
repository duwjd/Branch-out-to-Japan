/**
 * 랜딩 히어로 영상용 실화면 캡처 — 로컬 dev 서버의 실제 앱 화면을 3배율로 찍고,
 * 영상에서 확대·하이라이트할 요소의 좌표(CSS px, 뷰포트 기준)를 `assets/ui/rects.json` 에 남긴다.
 *
 * 실행(저장소 루트에서):
 *   YOAKE_SESSION=<yoake_session 쿠키 값> node video/landing-hero/capture/capture.mjs
 * 전제: dev 서버가 BASE(기본 http://localhost:3100)에서 돌고, 그 계정에 발행 리포트 1건과
 *       썸네일 1건(공식샵 신뢰 배지형)이 있다. 화면의 값은 로컬 데모 데이터다.
 *
 * 캡처 전에 dev 전용 표식(로컬 저장·목 모드 배지, 데모 이미지 배너)만 감춘다 — 운영 화면에는 없는 것들이다.
 * 그 밖의 화면은 손대지 않는다.
 */
import { chromium } from 'playwright';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.YOAKE_BASE ?? 'http://localhost:3100';
const SESSION = process.env.YOAKE_SESSION;
if (!SESSION) throw new Error('YOAKE_SESSION 환경 변수(yoake_session 쿠키 값)가 필요합니다.');

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'assets', 'ui');
const REPO = path.join(here, '..', '..', '..');
const VIEW = { width: 1440, height: 900 };

/** dev 전용 표식을 감춘다 — 배지는 자리만 비우고(visibility), 배너는 접는다(display) */
async function hideDevMarks(page) {
  await page.evaluate(() => {
    document.querySelector('nextjs-portal')?.remove();
    document.documentElement.style.scrollBehavior = 'auto';
    for (const el of document.querySelectorAll('main span, main p, main b')) {
      const t = el.textContent ?? '';
      if (t.length < 90 && /로컬 저장\(dev\)|목 모드\(dev\)|목\(mock\)|데모 해설|Supabase 미연결/.test(t)) {
        el.style.visibility = 'hidden';
      }
    }
    for (const el of document.querySelectorAll('main div, main p, main section')) {
      const t = el.textContent ?? '';
      if (t.length < 260 && /^\s*(데모 이미지입니다|목\(mock\) 모드 리포트)/.test(t)) el.style.display = 'none';
    }
  });
}

/** 요소를 뷰포트 위에서 offset px 내려온 자리에 오게 스크롤한다 */
async function scrollTo(page, locator, offset = 120) {
  await locator.evaluate((el, off) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off);
  }, offset);
  await page.waitForTimeout(250);
}

/** 로케이터들의 뷰포트 기준 사각형 [x, y, w, h] */
async function rects(map) {
  const out = {};
  for (const [key, loc] of Object.entries(map)) {
    const box = (await loc.count()) > 0 ? await loc.first().boundingBox() : null;
    out[key] = box ? [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)] : null;
  }
  return out;
}

const all = {};
/** 화면을 찍고 좌표를 모은다 */
async function shot(page, name, map) {
  await hideDevMarks(page);
  await page.waitForTimeout(350);
  all[name] = await rects(map);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(name, JSON.stringify(all[name]));
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 3, locale: 'ko-KR' });
await ctx.addCookies([{ name: 'yoake_session', value: SESSION, url: BASE }]);
const page = await ctx.newPage();

// ── 1) 진단 입력 폼 ─────────────────────────────────────────────────────────
await page.goto(`${BASE}/app/report/new`, { waitUntil: 'networkidle' });
await page.getByRole('radio', { name: '화장품' }).check();
await page.getByLabel('제품명').fill('CICA 진정 앰플');
await page.getByLabel('예상 판매가 (엔)').fill('2480');
await page.getByLabel('핵심 성분').fill('센텔라아시아티카, 판테놀');
await page.getByRole('button', { name: '텍스트 붙여넣기' }).click();
const copyBox = page.getByLabel('상세페이지 카피');
const productHeading = page.getByRole('heading', { name: '제품 정보' });
const formMap = {
  productName: page.getByLabel('제품명'),
  copy: copyBox,
  submit: page.getByRole('button', { name: '진단 리포트 생성' }),
};
await scrollTo(page, productHeading, 96);
await shot(page, 'form-empty', formMap);
// 200자를 넘겨 넣는다 — 그보다 짧으면 폼이 "정밀도 제한" 안내를 띄운다(실제 동작)
await copyBox.fill(
  [
    '병원 안 가도 되는 진정의 답, 하루온 CICA 진정 앰플.',
    '트러블 싹, 붉은기 싹 — 바르는 순간 즉각 진정.',
    '손상된 피부 장벽을 재생시켜 근본부터 치료합니다.',
    '72시간 지속되는 강력한 진정력.',
    '3개월 만에 10만 병 완판, 리뷰 미쳤다고 난리.',
    '센텔라 성분 99% 고농축, 피부 속 깊은 곳까지 파고듭니다.',
    '민감성·트러블 피부를 위한 병원 처방급.',
    '피부과 시술 후에도 안심하고 쓰는 재생 앰플.',
    '바르고 자면 아침에 트러블이 사라집니다.',
    '지금 구매하고 오래된 피부 고민을 한 번에 끝내세요.',
  ].join('\n'),
);
await copyBox.evaluate((el) => {
  el.scrollTop = 0;
  el.setSelectionRange(0, 0);
});
await page.waitForTimeout(200);
await scrollTo(page, productHeading, 96);
await shot(page, 'form-filled', formMap);

// ── 2) 진단 리포트 — 상단(점수) · 처방 탭(재설계 문구) ───────────────────────
const reportId = process.env.YOAKE_REPORT_ID;
if (!reportId) throw new Error('YOAKE_REPORT_ID(발행 리포트의 요청 id)가 필요합니다.');
await page.goto(`${BASE}/app/report/${reportId}`, { waitUntil: 'networkidle' });
const scoreLabel = page.getByText('일본 상세 관례 충족도', { exact: true }).first();
const scoreCard = scoreLabel.locator('xpath=ancestor::section[1]');
await scrollTo(page, scoreCard, 84);
await shot(page, 'report-top', {
  card: scoreCard,
  ring: page.getByRole('img', { name: /일본 상세 관례 충족도/ }),
  summary: scoreLabel.locator('xpath=following-sibling::p[1]'),
  tileNg: page.getByText('표현 불가', { exact: true }).locator('xpath=..'),
  tileCond: page.getByText('조건부', { exact: true }).first().locator('xpath=..'),
  tiles: page.getByText('표현 불가', { exact: true }).locator('xpath=../..'),
  top3: page.getByRole('heading', { name: '최우선 재설계 Top 3' }).locator('xpath=..'),
  radar: page.getByRole('heading', { name: '영역별 충족도' }).locator('xpath=..'),
});

await page.goto(`${BASE}/app/report/${reportId}#prescription`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const rxHeading = page.getByRole('heading', { name: '이렇게 바꾸면, 이 문제가 풀린다' });
await scrollTo(page, rxHeading, 84);
const before = page.getByText('BEFORE · KR').first();
const after = page.getByText('AFTER · JP').first();
// 재작성 1의 머리줄 — "푸는 문제(…薬機法 불가)" 칩과 "+ 더한 것" 칩들. 규정 기준으로 무엇을 고쳤는지 화면이 직접 말하는 자리다
const rxRow = before.locator('xpath=ancestor::*[3]');
await shot(page, 'report-rx', {
  problem: rxRow.getByText(/푸는 문제/).first(),
  fix1: rxRow.getByText(/^\+ /).nth(0),
  fix2: rxRow.getByText(/^\+ /).nth(1),
  heading: rxHeading,
  before: before.locator('xpath=..'),
  after: after.locator('xpath=..'),
  row: before.locator('xpath=ancestor::*[3]'),
  before2: page.getByText('BEFORE · KR').nth(1).locator('xpath=..'),
  after2: page.getByText('AFTER · JP').nth(1).locator('xpath=..'),
});

// ── 3) 스튜디오 — 썸네일 만들기 폼 · 결과 ───────────────────────────────────
await page.goto(`${BASE}/app/studio/thumbnail`, { waitUntil: 'networkidle' });
await shot(page, 'studio-empty', {
  dropzone: page.getByText('이미지를 끌어다 놓거나').locator('xpath=ancestor::*[self::label or self::button][1]'),
});
await page
  .locator('input[type="file"]')
  .first()
  .setInputFiles(path.join(REPO, 'public/studio-templates/haruon-before.jpg'));
await page.waitForTimeout(900);
const tpl = page.getByText('공식샵 신뢰 배지형', { exact: true }).first();
const tplCard = tpl.locator('xpath=ancestor::*[self::button or self::label or self::li][1]');
const tplHeading = page.getByRole('heading', { name: '템플릿' });
// 목표 몰을 먼저 고른다(라쿠텐 공식샵) — 그 몰의 문법에 맞는 템플릿이 앞에 선다. 결과 화면의 "라쿠텐 공식샵 기준"과 같은 이야기다
await page.getByRole('radio', { name: '라쿠텐 공식샵', exact: true }).click();
await page.waitForTimeout(400);
// 고르기 전 → 고른 뒤 순서로 찍는다. 영상에서 클릭 한 번에 선택 표시(테두리·체크)가 켜지는 것이 실제 상태 변화다
await scrollTo(page, tplHeading, 84);
await page.mouse.move(4, 4); // 커서가 카드 위에 남아 hover 테두리가 찍히지 않게 치운다
await page.waitForTimeout(200);
// 몰 필터 칩 — 템플릿이 몰별로 나뉘어 있음을 화면이 직접 보여 주는 자리다(카드마다 추천 · 부적합 표시가 붙는다)
await shot(page, 'studio-template-idle', {
  template: tplCard,
  mallFirst: page.getByRole('radio', { name: '아마존JP', exact: true }),
  mallLast: page.getByRole('radio', { name: 'Qoo10', exact: true }),
  mallPicked: page.getByRole('radio', { name: '라쿠텐 공식샵', exact: true }),
});
await tpl.click();
await page.mouse.move(4, 4);
await page.waitForTimeout(400);
await scrollTo(page, tplHeading, 84);
await shot(page, 'studio-template', {
  template: tplCard,
  generate: page.getByRole('button', { name: '생성하기' }),
});
await page.evaluate(() => window.scrollTo(0, 0));
await shot(page, 'studio-uploaded', {
  upload: page.getByRole('heading', { name: '이미지 업로드' }).locator('xpath=ancestor::section[1]'),
  preview: page.locator('main img').first(),
});

const assetId = process.env.YOAKE_THUMB_ID;
if (!assetId) throw new Error('YOAKE_THUMB_ID(완성 썸네일 자산 id)가 필요합니다.');
await page.goto(`${BASE}/app/studio/thumbnail/${assetId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await hideDevMarks(page);
const resultHeading = page.getByRole('heading', { name: '생성된 이미지' });
await scrollTo(page, resultHeading.locator('xpath=ancestor::section[1]'), 84);
await shot(page, 'studio-result', {
  card: resultHeading.locator('xpath=ancestor::section[1]'),
  image: page.locator('main section img').first(),
  original: page.getByText('원본', { exact: true }).locator('xpath=..'),
  copyNote: page.getByText('카피 해설', { exact: true }).locator('xpath=..'),
  copyCard1: page.getByText('白浮きしない、透明感トーンアップUV').locator('xpath=ancestor::*[1]'),
  copyCard1b: page.getByText('白浮きしない、透明感トーンアップUV').locator('xpath=..'),
  title: page.getByText('하루온 톤업 선케어', { exact: false }).first(),
  gates: page.getByText('제품 라벨 보존', { exact: false }).first().locator('xpath=..'),
  download: page.getByRole('button', { name: /이미지 다운로드/ }),
});

await writeFile(path.join(OUT, 'rects.json'), JSON.stringify({ viewport: VIEW, scale: 3, screens: all }, null, 2));
await browser.close();

// PNG → WebP(품질 92) — 3배율 UI 캡처라 글자가 선명한 채로 용량이 1/5 쯤 된다
for (const f of (await readdir(OUT)).filter((n) => n.endsWith('.png'))) {
  const src = path.join(OUT, f);
  await sharp(src)
    .webp({ quality: 92, effort: 6 })
    .toFile(src.replace(/\.png$/, '.webp'));
  await unlink(src);
}
// 템플릿 화면의 흐린 판 — 고른 카드만 또렷하게 남기고 나머지를 물릴 때 깐다(1배율이면 충분하다)
await sharp(path.join(OUT, 'studio-template.webp'))
  .resize(VIEW.width, VIEW.height)
  .blur(24)
  .webp({ quality: 80 })
  .toFile(path.join(OUT, 'studio-template-soft.webp'));
console.log('saved →', OUT);
