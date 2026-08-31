/**
 * 화면 캡처 — 페르소나가 실제로 "보는" 파일을 만든다.
 *
 * 해상도가 평가 타당성을 좌우한다: 페르소나에게 넘어가는 PNG 는 긴 변 ~1568px 로 줄어든다.
 * 1440×5000 fullPage 는 폭 450px 가 되어 글자가 안 읽히고, 그러면 인용이 전부 환각이 된다.
 * 그래서 **뷰포트 타일(1440×900 · DSF 2)이 페르소나가 읽는 실물**이고 fullPage 는 보관용이다.
 * `.txt`(innerText)를 항상 함께 남겨 인용 대조의 정답지로 쓴다.
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { screenName } from './paths.mjs';

/**
 * Read 로 넘어가는 이미지는 긴 변 ~1568px 로 줄어든다. 그 뒤 폭이 이보다 좁아지면 글자를 못 읽고,
 * 페르소나가 "본 것"을 지어내기 시작한다. 그런 캡처는 screens/ 가 아니라 런 루트에 보관만 한다.
 */
const READABLE_MIN_WIDTH = 900;
const READ_LONG_EDGE = 1568;

export const VIEWPORT = { width: 1440, height: 900 };
const TILE_OVERLAP = 60;

/** 캡처 전용 CSS — sticky/fixed 가 fullPage 마다 겹쳐 찍혀 본문을 가리는 걸 막는다 */
const CAPTURE_CSS = `
  *,*::before,*::after{animation:none!important;transition:none!important}
  html{scroll-behavior:auto!important}
  .sticky,[class*="lg:sticky"]{position:static!important}
  .fixed,[class*="lg:fixed"]{position:absolute!important}
`;

/** 클릭하면 안 되는 것들 — T6 는 열람만, T7 은 로그아웃·탈퇴가 있는 화면이다 */
const CLICK_DENY = /^(매칭 신청|신청 취소|탈퇴하기|회원 탈퇴|로그아웃|삭제|계정 삭제)$/;

/** 접근성 이름이 금지 목록에 걸리면 클릭을 거부한다 — 과녁을 놓친 선택자가 조용히 파괴하는 걸 막는다 */
export async function safeClick(locator, opts = {}) {
  const name = (await locator.innerText().catch(() => ''))?.trim() ?? '';
  if (CLICK_DENY.test(name)) throw new Error(`클릭 금지 대상: "${name}"`);
  await locator.click(opts);
}

/**
 * 폰트·이미지가 다 앉을 때까지 기다린다. 어떤 대기도 캡처를 막지는 못하게 전부 삼킨다.
 *
 * ⚠ 브라우저 안의 대기는 **반드시 시한을 건다**. `page.evaluate` 는 `setDefaultTimeout` 의
 * 적용을 받지 않아서, 끝내 complete 되지 않는 `<img>` 가 하나라도 있으면 Promise.all 이
 * 영원히 안 끝나고 드라이버가 통째로 멈춘다(2026-08-22 리포트 처방 탭에서 실측 — 10분+ 무진행).
 */
const IN_PAGE_WAIT_MS = 8_000;

export async function settle(page, { networkIdleMs = 12_000 } = {}) {
  await page.waitForLoadState('networkidle', { timeout: networkIdleMs }).catch(() => {});
  await page
    .evaluate(
      (ms) => Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, ms))]),
      IN_PAGE_WAIT_MS,
    )
    .catch(() => {});
  await page
    .evaluate(
      (ms) =>
        Promise.race([
          Promise.all(
            [...document.images]
              .filter((i) => !i.complete)
              .map(
                (i) =>
                  new Promise((r) => {
                    i.onload = i.onerror = r;
                  }),
              ),
          ),
          new Promise((r) => setTimeout(r, ms)),
        ]),
      IN_PAGE_WAIT_MS,
    )
    .catch(() => {});
  await page.waitForTimeout(300);
}

/** 문서 높이가 두 번 연속 같아질 때까지 훑어 내린다 — lazy 이미지·지연 렌더를 앉힌다 */
export async function settleDescent(page, { maxPasses = 3 } = {}) {
  let prev = -1;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += VIEWPORT.height) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(200);
    }
    await settle(page, { networkIdleMs: 4000 });
    const after = await page.evaluate(() => document.documentElement.scrollHeight);
    if (after === prev) break;
    prev = after;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

/** 화면에 보이는 섹션 이름 — 랜딩평가.csv 의 `exit_section` 근거가 된다 */
async function visibleSections(page) {
  return page
    .evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('section, h1, h2')) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        const t = (el.tagName === 'SECTION' ? el.querySelector('h1,h2')?.textContent : el.textContent) ?? '';
        const s = t.trim().replace(/\s+/g, ' ').slice(0, 60);
        if (s && !out.includes(s)) out.push(s);
      }
      return out.slice(0, 4);
    })
    .catch(() => []);
}

/**
 * 스텝 1개 캡처. 절대 throw 하지 않는다 — 실패는 step.error 로 남기고 다음으로 넘어간다.
 * @returns {Promise<object>} manifest steps[] 한 행
 */
export async function captureStep(ctx, spec) {
  const started = Date.now();
  const step = {
    seq: spec.seq,
    id: spec.id,
    task: spec.task,
    label: spec.label,
    url: null,
    action: spec.action ?? 'goto',
    png: null,
    pngs: [],
    txt: null,
    elapsedMs: 0,
    consoleErrors: [],
    failedRequests: [],
    error: null,
    note: spec.note ?? null,
  };
  const { page, paths } = ctx;
  try {
    await settle(page);
    // URL 은 settle **뒤에** 읽는다 — Next.js 소프트 내비게이션은 클릭 직후엔 아직 이전 주소라,
    // 먼저 읽으면 화면은 새 페이지인데 기록만 옛 주소로 남는다(트랙 B 복원이 계속 /app 으로 돌아갔다)
    const u = new URL(page.url());
    step.url = u.pathname + u.search;
    if (spec.descent) await settleDescent(page);
    await page.addStyleTag({ content: CAPTURE_CSS }).catch(() => {});

    const i = spec.suffixIndex ?? 0;
    const file = screenName(spec.seq, spec.id, i);
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => VIEWPORT.height);
    // DSF 2 라 실제 픽셀은 뷰포트의 2배다. 축소 후 폭이 900px 밑으로 떨어지면 보관용으로 뺀다
    const shrunkWidth = (VIEWPORT.width * 2 * READ_LONG_EDGE) / Math.max(VIEWPORT.width * 2, docHeight * 2);
    const archival = spec.fullPage !== false && spec.tiles && shrunkWidth < READABLE_MIN_WIDTH;
    const target = archival ? path.join(paths.run, `${spec.id}-full.png`) : path.join(paths.screens, file);
    await page.screenshot({ path: target, fullPage: spec.fullPage !== false });
    if (archival) {
      // 타일이 페르소나가 보는 실물이 된다 — step.png 는 첫 타일이 채운다
      step.archival = `${spec.id}-full.png`;
      step.note = [
        step.note,
        `fullPage 는 축소 시 ${Math.round(shrunkWidth)}px 폭이라 판독 불가 — 런 루트에 보관만 하고 페르소나에게는 타일을 준다`,
      ]
        .filter(Boolean)
        .join(' · ');
    } else {
      step.png = `screens/${file}`;
      step.pngs.push(step.png);
    }

    if (spec.tiles) {
      const tiles = await captureTiles(ctx, spec);
      step.pngs.push(...tiles.files);
      step.tiles = tiles.meta;
      if (!step.png) step.png = tiles.files[0] ?? null;
    }

    if (spec.text !== 'none') {
      const scope = spec.text === 'body' ? 'body' : 'main';
      const text = await page
        .evaluate((sel) => {
          const root = document.querySelector(sel) ?? document.body;
          const body = root?.innerText ?? '';
          // innerText 는 input·textarea·select 의 **값을 포함하지 않는다.**
          // 그래서 페르소나가 자기가 입력한 값을 못 보고 "나는 이런 거 넣은 적 없다"고 반응한다.
          // 실제로는 넣었는데 자극물에 안 보였을 뿐이다 — 채워진 값을 따로 덧붙인다.
          const filled = [];
          for (const el of root.querySelectorAll('input, textarea, select')) {
            if (el.type === 'file' || el.type === 'hidden') continue;
            const label =
              el.labels?.[0]?.innerText?.trim() ||
              el.getAttribute('aria-label') ||
              el.getAttribute('placeholder') ||
              el.name ||
              el.id ||
              '(이름 없음)';
            const value = el.type === 'checkbox' || el.type === 'radio' ? (el.checked ? '체크됨' : '') : el.value;
            if (value && String(value).trim()) filled.push(`  ${label.replace(/\s+/g, ' ')}: ${String(value).trim()}`);
          }
          // 칩·토글은 aria-pressed / aria-checked 로 상태를 표현한다 — 선택한 것만 남긴다
          const chosen = [...root.querySelectorAll('[aria-pressed="true"], [aria-checked="true"]')]
            .map((el) => (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '))
            .filter(Boolean);
          const extra = [];
          if (filled.length) extra.push('', '── 내가 이 화면에 입력한 값 ──', ...filled);
          if (chosen.length) extra.push('', '── 내가 이 화면에서 선택한 것 ──', `  ${chosen.join(' · ')}`);
          return body + extra.join('\n');
        }, scope)
        .catch(() => '');
      const txtFile = screenName(spec.seq, spec.id, i, 'txt');
      writeFileSync(path.join(paths.screens, txtFile), text);
      step.txt = `screens/${txtFile}`;
    }
  } catch (err) {
    step.error = String(err?.message ?? err);
  }
  step.elapsedMs = Date.now() - started;
  step.consoleErrors = ctx.drainConsole();
  step.failedRequests = ctx.drainFailed();
  return step;
}

/** 뷰포트 단위 순차 캡처 — 마지막 타일은 문서 끝에 고정해 푸터가 잘리지 않게 한다 */
export async function captureTiles(ctx, spec) {
  const { page, paths } = ctx;
  const files = [];
  const meta = [];
  const stepPx = VIEWPORT.height - TILE_OVERLAP;
  let total = await page.evaluate(() => document.documentElement.scrollHeight);
  const max = spec.maxTiles ?? 24;
  for (let i = 0, y = 0; i < max; i += 1, y += stepPx) {
    const at = Math.max(0, Math.min(y, total - VIEWPORT.height));
    await page.evaluate((v) => window.scrollTo(0, v), at);
    await page.waitForTimeout(350);
    const file = screenName(spec.seq, spec.tileId ?? spec.id, i + 1);
    await page.screenshot({ path: path.join(paths.screens, file), fullPage: false });
    files.push(`screens/${file}`);
    meta.push({ file: `screens/${file}`, scrollY: at, sections: await visibleSections(page) });
    const grown = await page.evaluate(() => document.documentElement.scrollHeight);
    if (grown > total * 1.5) break; // 무한 스크롤 방어
    total = Math.max(total, grown);
    if (at >= total - VIEWPORT.height) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return { files, meta };
}

/**
 * /login 의 소셜 화면에서 이메일 로그인 폼까지 연다.
 * 하이드레이션 직후에는 클릭이 먹지 않는 창이 있어, 폼이 뜰 때까지 확인하고 한 번 더 누른다.
 * (콜드 스타트가 있는 배포본에서 간헐적으로 탭이 안 뜨는 사고가 있었다)
 */
export async function openEmailLogin(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await page.locator('#li-email').count()) return;
    const btn = page.getByRole('button', { name: '이메일로 계속하기' });
    if (await btn.count()) await btn.click().catch(() => {});
    const tab = page.getByRole('tab', { name: '로그인', exact: true });
    if (await tab.count()) await tab.click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  if (!(await page.locator('#li-email').count())) throw new Error('이메일 로그인 폼을 열지 못했다');
}
