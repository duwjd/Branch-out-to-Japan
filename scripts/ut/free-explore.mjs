/**
 * 트랙 B 자유 탐색 드라이버 — 턴제(§5).
 *
 * 왜 별도 스크립트인가: 트랙 A 는 정해진 스텝을 끝까지 밀지만, 트랙 B 는 **매 턴 페르소나가 다음
 * 행동 1개를 정한다.** 즉 한 번의 실행이 한 턴이고, 턴 사이에 모더레이터(메인 세션)가 끼어
 * 에이전트를 부른다. 브라우저 상태는 storageState 로 이어 붙인다.
 *
 * 실행:
 *   node scripts/ut/free-explore.mjs --persona P03 --init
 *   node scripts/ut/free-explore.mjs --persona P03 --turn 2 --action 'click "진단 리포트 만들기"'
 *   node scripts/ut/free-explore.mjs --persona P03 --turn 3 --action 'goto /app/studio'
 *   node scripts/ut/free-explore.mjs --persona P03 --turn 4 --action 'fill 브랜드명 "하루온"'
 *
 * 행동 문법(페르소나가 마지막 줄에 쓰는 그대로):
 *   click "화면에 쓰인 글자"  ·  fill 필드이름 "값"  ·  goto /경로  ·  stop
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from './lib/paths.mjs';
import { captureStep, openEmailLogin, safeClick, VIEWPORT } from './lib/shot.mjs';

const DEFAULT_BASE = 'https://branch-out-to-japan.vercel.app';
const log = (m) => process.stdout.write(`${m}\n`);
const warn = (m) => process.stderr.write(`${m}\n`);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? fallback) : fallback;
}
const flag = (n) => process.argv.includes(`--${n}`);
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * 행동 1개를 페이지에 집행한다. 재생(replay)과 실집행이 같은 코드를 쓴다.
 * @param {import('playwright').Page} page
 * @param {{kind:string, target?:string, value?:string}} action
 * @param {string} base
 */
async function applyAction(page, action, base) {
  if (action.kind === 'goto') {
    await page.goto(action.target.startsWith('http') ? action.target : `${base}${action.target}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(500);
    return;
  }
  if (action.kind === 'click') {
    const byRole = page.getByRole('button', { name: action.target, exact: false }).first();
    const byLink = page.getByRole('link', { name: action.target, exact: false }).first();
    const byText = page.getByText(action.target, { exact: false }).first();
    const found = (await byRole.count())
      ? byRole
      : (await byLink.count())
        ? byLink
        : (await byText.count())
          ? byText
          : null;
    if (!found) throw new Error(`화면에 "${action.target}" 이(가) 없습니다.`);
    const before = page.url();
    await safeClick(found);
    // 소프트 내비게이션은 새 document 가 없어 domcontentloaded 가 즉시 끝난다 — 주소가 바뀌길 잠깐 본다
    await page.waitForFunction((u) => location.href !== u, before, { timeout: 8000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    return;
  }
  // 페르소나는 화면에 보이는 이름으로 말한다 — 라벨 → placeholder → id 순으로 찾는다
  const candidates = [
    page.getByLabel(action.target, { exact: false }).first(),
    page.getByPlaceholder(action.target, { exact: false }).first(),
    page.locator(`#${action.target.replace(/[^\w-]/g, '')}`).first(),
  ];
  for (const c of candidates) {
    if (await c.count().catch(() => 0)) {
      await c.fill(action.value ?? '');
      return;
    }
  }
  throw new Error(`화면에서 "${action.target}" 입력칸을 찾지 못했습니다.`);
}

/**
 * 페르소나가 쓴 한 줄을 행동으로 판다.
 * @returns {{kind:'click'|'fill'|'goto'|'stop', target?:string, value?:string}}
 */
export function parseAction(line) {
  const s = String(line ?? '')
    .replace(/^NEXT:\s*/i, '')
    .trim();
  if (/^stop\b/i.test(s)) return { kind: 'stop' };
  let m = /^click\s+["“](.+?)["”]\s*$/i.exec(s);
  if (m) return { kind: 'click', target: m[1] };
  m = /^goto\s+(\S+)\s*$/i.exec(s);
  if (m) return { kind: 'goto', target: m[1] };
  m = /^fill\s+(.+?)\s+["“](.*?)["”]\s*$/i.exec(s);
  if (m) return { kind: 'fill', target: m[1].trim(), value: m[2] };
  throw new Error(`행동 문법을 알아볼 수 없습니다: "${s}"`);
}

async function main() {
  const personaId = arg('persona');
  if (!personaId) throw new Error('--persona P03 이 필요합니다.');
  const base = arg('base', process.env.UT_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const init = flag('init');
  const turn = Number(arg('turn', init ? 1 : 0));
  if (!init && !turn) throw new Error('--init 또는 --turn N 이 필요합니다.');
  const actionLine = arg('action');
  if (!init && !actionLine) throw new Error('--action \'click "..."\' 이 필요합니다.');

  const runDir = path.join(ROOT, '.ut/runs', `${personaId}-free`);
  const turnDir = path.join(runDir, 'turns', pad2(turn));
  const statePath = path.join(runDir, 'state.json');
  const logPath = path.join(runDir, 'turns.json');
  for (const d of [runDir, path.join(runDir, 'turns'), turnDir]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

  const registry = JSON.parse(readFileSync(path.join(ROOT, '.ut/accounts.json'), 'utf8'));
  const acc = registry.accounts.find((a) => a.personaId === personaId);
  if (!acc) throw new Error(`.ut/accounts.json 에 ${personaId} 가 없습니다.`);
  const password = acc.password ?? registry.password;

  const browser = await chromium.launch({ headless: !flag('headed') });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    acceptDownloads: true,
    storageState: !init && existsSync(statePath) ? statePath : undefined,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  page.setDefaultNavigationTimeout(60_000);
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
  });

  const ctx = {
    page,
    base,
    paths: { run: runDir, screens: turnDir, artifacts: turnDir },
    drainConsole: () => consoleErrors.splice(0, consoleErrors.length),
    drainFailed: () => [],
  };

  let note = null;
  const urlBeforeRef = { value: null };
  try {
    if (init) {
      // 로그인만 시켜 놓고 /app 홈에서 멈춘다 — 아무도 뭘 하라고 알려주지 않는 상태가 자극물이다
      await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await openEmailLogin(page);
      await page.locator('#li-email').fill(acc.email);
      await page.locator('#li-pw').fill(password);
      await page.locator('label:has-text("로그인 상태 유지") input[type="checkbox"]').check();
      await Promise.all([
        page.waitForURL(/\/app(\/|$)/, { timeout: 60_000 }),
        page.locator('form:has(#li-email) button[type="submit"]').click(),
      ]);
      note = '로그인 직후 앱 홈';
    } else {
      // 턴마다 브라우저를 새로 띄우므로 about:blank 에서 시작한다 — 직전 턴의 화면을 먼저 복원해야
      // click·fill 이 대상 화면 위에서 실행된다(storageState 는 쿠키만 이어 준다)
      const prev = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : { turns: [], stateActions: [] };
      const lastUrl = [...prev.turns].sort((a, b) => b.turn - a.turn).find((t) => t.url)?.url ?? '/app';
      await page.goto(`${base}${lastUrl}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(500);

      // 새 로드는 React 상태를 비운다 — 같은 화면에서 이미 한 입력·선택을 다시 얹어 준다.
      // 이걸 안 하면 페르소나 눈에는 "카테고리를 눌렀더니 브랜드명이 사라졌다"는 없는 버그가 보인다.
      for (const line of prev.stateActions ?? []) {
        await applyAction(page, parseAction(line), base).catch(() => {});
      }
      if ((prev.stateActions ?? []).length > 0) await page.waitForTimeout(400);

      const action = parseAction(actionLine);
      if (action.kind === 'stop') {
        log(`${personaId} 턴 ${turn}: stop — 종료`);
        await browser.close();
        return;
      }
      urlBeforeRef.value = new URL(page.url()).pathname;
      await applyAction(page, action, base);
      note = `${action.kind} ${action.target ?? ''}`.trim();
    }

    const step = await captureStep(ctx, {
      seq: turn,
      id: 'screen',
      task: 'B',
      label: note,
      action: 'goto',
      tiles: true,
      maxTiles: 8,
      text: 'main',
    });
    await context.storageState({ path: statePath });

    const history = existsSync(logPath)
      ? JSON.parse(readFileSync(logPath, 'utf8'))
      : { personaId, base, turns: [], stateActions: [] };
    // 같은 화면에서 한 입력·선택만 쌓는다. 화면이 바뀌면 비운다(새 화면엔 재생할 상태가 없다)
    history.stateActions = init
      ? []
      : new URL(page.url()).pathname === urlBeforeRef.value
        ? [...(history.stateActions ?? []), actionLine]
        : [];
    history.turns = history.turns.filter((t) => t.turn !== turn);
    history.turns.push({
      turn,
      at: new Date().toISOString(),
      action: init ? '(초기 진입)' : actionLine,
      url: step.url,
      dir: `turns/${pad2(turn)}`,
      pngs: step.pngs,
      txt: step.txt,
      consoleErrors: step.consoleErrors,
      error: step.error,
    });
    history.turns.sort((a, b) => a.turn - b.turn);
    writeFileSync(logPath, `${JSON.stringify(history, null, 2)}\n`);

    log(
      `${personaId} 턴 ${turn} · ${step.url} · ${step.pngs.length}장 캡처${step.error ? ` · 오류 ${step.error}` : ''}`,
    );
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  warn(`\n✖ ${err?.message ?? err}`);
  process.exit(1);
});
