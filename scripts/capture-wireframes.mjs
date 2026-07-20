/**
 * 와이어프레임 캡처 — docs/specs/00-main·01-report·02-studio·03-account 의 프로토타입 HTML을
 * 실제 브라우저로 열고 상태를 구동한 뒤 PNG로 떠서 docs/presentation/shots/ 에 저장한다.
 * 발표 덱(docs/presentation/ui-deck.html)이 이 이미지를 참조한다.
 *
 * 원본 HTML은 수정하지 않는다 — 상태 구동은 전부 런타임 클릭/평가로 처리한다.
 *
 * 실행: node scripts/capture-wireframes.mjs [shotId ...]
 *   인자를 주면 해당 shot만 다시 뜬다. (예: node scripts/capture-wireframes.mjs r-tab3)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const specs = path.join(root, 'docs/specs');
const outDir = path.join(root, 'docs/presentation/shots');

/** 프로토타입 전용 크롬(비배포 고지 스트립·상태 스위처)을 숨긴다 — 제품 UI가 아니라 발표에서 오해를 부른다. */
const HIDE_PROTOTYPE_CHROME = `.wf-strip{display:none!important}`;

/** 캡처 대상. act()는 캡처 직전 페이지 상태를 만든다. clip을 주면 해당 셀렉터 영역만 자른다. */
const SHOTS = [
  // ── ⓪ 메인(앱 홈) ──────────────────────────────────
  {
    id: 'idx-main', file: '00-main/index.html', vw: 1180,
    clip: 'main > section:nth-of-type(1)',
  },
  ...['first', 'default'].map((st) => ({
    id: `m-home-${st}`, file: '00-main/1-home.html', vw: 1280, full: true,
    act: async (p) => {
      await p.click(`.st-btn[data-st="${st}"]`);
      await p.mouse.move(8, 300); // 스트립 숨김 후 마우스가 내비 위에 남아 hover가 찍히는 것 방지
      await p.waitForTimeout(400);
    },
  })),
  {
    id: 'm-home-generating', file: '00-main/1-home.html', vw: 1280, full: true, motion: true,
    act: async (p) => {
      await p.click('.st-btn[data-st="generating"]');
      await p.mouse.move(8, 300);
      await p.waitForTimeout(3000); // 5단계 중 중간 단계 문구가 떠 있을 때
    },
  },
  {
    id: 'm-home-toast', file: '00-main/1-home.html', vw: 1280,
    // 생성 완료 → 최근 자산 crossfade + 플로팅 패널 완료 행(축 횡단 서사). 8초 뒤 자동 소멸.
    act: async (p) => {
      await p.click('.st-btn[data-st="generating"]');
      await p.mouse.move(8, 300);
      await p.waitForSelector('#jobDone', { state: 'visible', timeout: 20000 });
      await p.waitForTimeout(500);
    },
  },
  {
    id: 'm-home-switcher', file: '00-main/1-home.html', vw: 1280,
    // 브랜드 프로필 스위처 드롭다운 열림 — 사이드바 상단(#swWrap) + 메뉴 영역만 세로로 자른다.
    act: async (p) => { await p.click('#swBtn'); await p.waitForTimeout(300); },
    clip: '#swWrap',
    pad: { top: 10, bottom: 250, left: 16, right: 16 },
  },

  // ── ① 진단 리포트 ──────────────────────────────────
  {
    id: 'idx-report', file: '01-report/index.html', vw: 1180,
    clip: 'main > section:nth-of-type(1)',
  },
  { id: 'r-input-empty', file: '01-report/1-input.html', vw: 1260, full: true },
  {
    id: 'r-input-filled', file: '01-report/1-input.html', vw: 1260, full: true,
    act: async (p) => { await p.click('#fillExample'); await p.waitForTimeout(300); },
  },
  {
    id: 'r-input-gate', file: '01-report/1-input.html', vw: 1260,
    // 50자 미만 → 적색 게이트 + 제출 잠금. 폼 하단 콘텐츠 영역만 잘라 게이트를 크게 보인다.
    act: async (p) => {
      await p.fill('#contentText', '민감 피부를 위한 시카 앰플입니다.');
      await p.waitForTimeout(300);
      await p.locator('#contentText').scrollIntoViewIfNeeded();
      await p.waitForTimeout(200);
    },
    clip: '#contentText',
    pad: { top: 90, bottom: 320, left: 40, right: 40 },
  },
  {
    id: 'r-process', file: '01-report/2-process.html', vw: 1080, motion: true,
    // 진행 중 상태가 이 화면의 본질 — 애니메이션을 살리고 중간 단계에서 찍는다.
    act: async (p) => { await p.waitForTimeout(2600); },
  },
  ...[0, 1, 2, 3, 4].map((i) => ({
    id: `r-tab${i + 1}`, file: '01-report/3-report.html', vw: 1460, full: true,
    act: async (p) => {
      await p.click(`#tabBtn${i}`);
      await p.waitForTimeout(900); // 점수 카운트업·차트 트윈 안착 대기
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(250);
    },
  })),
  {
    // 탭1 상단(점수 도넛 + 스탯 타일)만 확대용으로 따로.
    id: 'r-tab1-score', file: '01-report/3-report.html', vw: 1460,
    act: async (p) => { await p.click('#tabBtn0'); await p.waitForTimeout(1100); },
    clip: '#tabPanel0 > *:nth-child(1)',
  },
  {
    id: 'r-tabnav', file: '01-report/3-report.html', vw: 1460,
    act: async (p) => { await p.click('#tabBtn0'); await p.waitForTimeout(400); },
    clip: '#tabBtn0',
    pad: { top: 18, bottom: 18, left: 0, right: 1200 },
  },
  {
    // 오버레이 상단바(파일명 + 고지)가 좁으면 겹쳐 렌더되므로 넓게 잡는다.
    id: 'r-slides', file: '01-report/3-report.html', vw: 1760,
    act: async (p) => {
      await p.locator('.js-slide-btn').first().click();
      await p.waitForSelector('#slideModal', { state: 'visible' });
      await p.waitForTimeout(2200); // "만드는 중…" 이 끝나고 1장이 뜰 때까지
    },
  },

  // ── ② 마케팅 스튜디오 ───────────────────────────────
  {
    id: 'idx-studio', file: '02-studio/index.html', vw: 1180,
    clip: 'main > section:nth-of-type(1)',
  },
  ...['empty', 'default', 'failed'].map((st) => ({
    id: `s-home-${st}`, file: '02-studio/1-home.html', vw: 1540, full: true,
    act: async (p) => {
      await p.click(`.st-btn[data-st="${st}"]`);
      await p.waitForTimeout(400);
    },
  })),
  {
    id: 's-home-generating', file: '02-studio/1-home.html', vw: 1540, motion: true,
    act: async (p) => {
      await p.click('.st-btn[data-st="generating"]');
      await p.waitForTimeout(3000); // 5단계 중 중간 단계 문구가 떠 있을 때
    },
  },
  {
    id: 's-home-toast', file: '02-studio/1-home.html', vw: 1540,
    // 생성 완료 → 타일 전환 + 토스트. 토스트는 5초 뒤 사라지므로 타이밍이 좁다.
    act: async (p) => {
      await p.click('.st-btn[data-st="generating"]');
      await p.waitForSelector('#toast', { state: 'visible', timeout: 20000 });
      await p.waitForTimeout(700);
    },
  },
  {
    id: 's-create', file: '02-studio/2-create.html', vw: 1260, full: true,
    act: async (p) => { await p.click('#fillExample'); await p.waitForTimeout(500); },
  },
  {
    id: 's-create-tpl', file: '02-studio/2-create.html', vw: 1260,
    // 템플릿 그리드의 선택/추천/부적합 3상태가 함께 보이도록:
    // 플랫폼을 고르면 추천 배지와 △ 부적합 딤이 칠해지고, 카드 하나를 눌러 선택 상태를 만든다.
    act: async (p) => {
      await p.click('#fillExample');
      await p.waitForTimeout(400);
      // '미정'이 아니라 실제 플랫폼(아마존JP)을 골라야 추천·부적합 판정이 칠해진다.
      await p.locator('#pfChips button').nth(1).click();
      await p.waitForTimeout(300);
      await p.locator('#tplGrid button, #tplGrid [role="radio"]').first().click();
      await p.waitForTimeout(400);
    },
    clip: '#tplGrid',
    pad: { top: 70, bottom: 20, left: 24, right: 24 },
  },
  {
    id: 's-create-proof', file: '02-studio/2-create.html', vw: 1260,
    act: async (p) => {
      await p.click('#fillExample');
      await p.waitForTimeout(400);
      await p.evaluate(() => {
        const d = document.querySelector('#proofBox') || document.querySelector('details');
        if (d && d.tagName === 'DETAILS') d.open = true;
      });
      await p.waitForTimeout(300);
    },
    clip: '#proofBox',
    pad: { top: 20, bottom: 20, left: 24, right: 24 },
  },
  { id: 's-result', file: '02-studio/3-result.html', vw: 1540, full: true },
  {
    id: 's-result-copy', file: '02-studio/3-result.html', vw: 1540,
    // 카피 재설계 슬롯(KR 원문 → 의도 → JP 재설계) 확대.
    clip: 'main',
    pad: { top: 0, bottom: 0, left: 0, right: 0 },
    crop: (box) => ({
      // 우측 해설 컬럼만 — 좌측 이미지 컬럼이 가장자리에 물리지 않게 36px 안쪽에서 시작한다.
      x: box.x + box.width * 0.5 + 36,
      y: box.y + 260,
      width: box.width * 0.5 - 36,
      height: 620,
    }),
  },

  // ── 03 계정(로그인·마이페이지) ───────────────────────
  {
    id: 'idx-account', file: '03-account/index.html', vw: 1180,
    clip: 'main > section:nth-of-type(1)',
  },
  {
    id: 'a-login', file: '03-account/1-login.html', vw: 1180,
    // 셸 없는 센터 카드 — 카드 주변 여백까지 보이도록 전폭 뷰포트 그대로 찍는다.
    act: async (p) => { await p.mouse.move(8, 8); await p.waitForTimeout(300); },
  },
  {
    id: 'a-login-fail', file: '03-account/1-login.html', vw: 1180,
    act: async (p) => {
      await p.click('.st-btn[data-st="fail"]');
      await p.click('.social-btn[data-provider="kakao"]');
      await p.waitForSelector('#toast', { state: 'visible', timeout: 10000 });
      await p.mouse.move(8, 8);
      await p.waitForTimeout(300);
    },
  },
  ...['default', 'free', 'failed'].map((st) => ({
    id: `a-mypage-${st}`, file: '03-account/2-mypage.html', vw: 1280, full: true,
    act: async (p) => {
      await p.click(`.st-btn[data-st="${st}"]`);
      await p.mouse.move(8, 300); // 스트립 숨김 후 마우스가 내비 위에 남아 hover가 찍히는 것 방지
      await p.waitForTimeout(400);
    },
  })),
  {
    id: 'a-mypage-withdraw', file: '03-account/2-mypage.html', vw: 1280,
    // 탈퇴 확인 모달 — 위험 액션의 확인 게이트가 이 화면의 핵심 상태 중 하나.
    act: async (p) => {
      await p.click('#withdrawBtn');
      await p.waitForSelector('#withdrawModal', { state: 'visible' });
      await p.waitForTimeout(400);
    },
  },
];

const only = process.argv.slice(2);
const targets = only.length ? SHOTS.filter((s) => only.includes(s.id)) : SHOTS;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const shot of targets) {
  const ctx = await browser.newContext({
    viewport: { width: shot.vw, height: 900 },
    deviceScaleFactor: 2,
    // 모션이 본질인 화면(처리·생성중)만 애니메이션을 살린다.
    reducedMotion: shot.motion ? 'no-preference' : 'reduce',
  });
  const page = await ctx.newPage();
  try {
    await page.goto(pathToFileURL(path.join(specs, shot.file)).href, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    // 상태 구동이 먼저 — 데모 스위처가 검토 스트립 안에 있어서, 먼저 숨기면 클릭할 수 없다.
    if (shot.act) await shot.act(page);
    await page.addStyleTag({ content: HIDE_PROTOTYPE_CHROME });
    await page.waitForTimeout(150);

    const out = path.join(outDir, `${shot.id}.png`);
    if (shot.clip) {
      const raw0 = await page.locator(shot.clip).first().boundingBox();
      if (!raw0) throw new Error(`clip 대상을 찾지 못함: ${shot.clip}`);
      // boundingBox()는 뷰포트 기준, fullPage 스크린샷의 clip은 문서 기준이다.
      // act()에서 클릭·스크롤이 일어나면 둘이 어긋나므로 스크롤량을 더해 문서 좌표로 맞춘다.
      const sc = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
      const box = { ...raw0, x: raw0.x + sc.x, y: raw0.y + sc.y };
      const pad = shot.pad || { top: 0, bottom: 0, left: 0, right: 0 };
      const raw = shot.crop
        ? shot.crop(box)
        : {
            x: box.x - pad.left,
            y: box.y - pad.top,
            width: box.width + pad.left + pad.right,
            height: box.height + pad.top + pad.bottom,
          };
      const full = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
      }));
      const clip = {
        x: Math.max(0, raw.x),
        y: Math.max(0, raw.y),
        width: Math.min(raw.width, full.w - Math.max(0, raw.x)),
        height: Math.min(raw.height, full.h - Math.max(0, raw.y)),
      };
      // clip 좌표는 문서 기준이므로 fullPage로 떠야 뷰포트 밖 영역도 잡힌다.
      await page.screenshot({ path: out, clip, fullPage: true });
    } else {
      await page.screenshot({ path: out, fullPage: !!shot.full });
    }
    results.push({ id: shot.id, ok: true });
  } catch (err) {
    results.push({ id: shot.id, ok: false, err: err.message });
  }
  await ctx.close();
}

await browser.close();

for (const r of results) {
  process.stdout.write(`${r.ok ? '  ok ' : ' FAIL'}  ${r.id}${r.ok ? '' : `  — ${r.err}`}\n`);
}
const failed = results.filter((r) => !r.ok).length;
process.stdout.write(`\n${results.length - failed}/${results.length} 캡처 완료 → docs/presentation/shots/\n`);
process.exit(failed ? 1 : 0);
