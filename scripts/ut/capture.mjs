/**
 * AI 에이전트 UT 드라이버 — 배포본을 조작해 페르소나가 볼 화면과 산출물을 파일로 물질화한다.
 *
 * 근거: docs/research/ut-agent/00-ut-plan.md §3(역할) · §6(과업 T0~T7) · 부록A(디렉터리 규약),
 *       01-산출물-형식.md §1(manifest 스키마).
 *
 * 왜 과업을 나눠 부를 수 있게 만들었나: §4-4 가 과업 티어마다 동시성을 다르게 요구한다
 * (T0~T2 4명 동시 / T3·T4 2명 / **T5 순차**). 한 프로세스가 T0~T7 을 통으로 돌면 T5 가 겹치고,
 * 그러면 budget.ts 가 남은 시간을 재서 배경컷을 텍스트로 강등한다 — 평가 대상이 조용히 오염된다.
 * 그래서 로그인 상태(storageState)와 manifest 를 이어받아 여러 번 나눠 실행할 수 있게 했다.
 *
 * 실행:
 *   node scripts/ut/capture.mjs --persona P01 --tasks T0,T1,T2
 *   node scripts/ut/capture.mjs --persona P01 --tasks T5 --base https://branch-out-to-japan.vercel.app
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, ensureRunDirs, runPaths } from './lib/paths.mjs';
import { beginRun, finishRun, loadManifest, mergeTask, saveManifest } from './lib/manifest.mjs';
import { VIEWPORT } from './lib/shot.mjs';
import { TASKS } from './lib/tasks.mjs';

const DEFAULT_BASE = 'https://branch-out-to-japan.vercel.app';
const ALL_TASKS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
/**
 * 기본 과업 — T3 복귀(2026-08-22).
 * 리포트 파이프라인 예산 가드가 배포되어(`c1f3d30` 잡 시간 예산 + 콜⑩ 청크 병렬) 발행이 회복됐다.
 * 2026-08-20 의 T3 제외 결정은 해제한다(경위: results/P0-리포트-파이프라인-예산초과.md).
 */
const DEFAULT_TASKS = ALL_TASKS;

const log = (msg) => process.stdout.write(`${msg}\n`);
const warn = (msg) => process.stderr.write(`${msg}\n`);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? fallback) : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

/** fixture 가 서버에서 400/버튼잠금으로 죽을 조합을 브라우저 띄우기 전에 잡는다 */
function preflightFixture(fx, productImage) {
  const bad = [];
  const tags = fx.brand?.positioningTags ?? [];
  if (tags.length < 1 || tags.length > 5) bad.push(`포지셔닝 태그 ${tags.length}개 — 1~5개여야 저장 버튼이 열린다`);
  if (!existsSync(productImage)) bad.push(`제품컷 없음: ${productImage}`);
  const t = fx.thumbnail ?? {};
  if (t.styleId === 'E' && !t.proof) bad.push('styleId E 인데 실적 3항이 없다 — 제출 버튼이 영원히 잠긴다');
  if (t.styleId === 'F') bad.push('styleId F 는 모델컷·동의가 필요해 이번 UT 범위 밖이다');
  if (t.styleId === 'G' && !t.promo) bad.push('styleId G 인데 프로모션 입력이 없다');
  const d = fx.detail ?? {};
  for (const k of ['specVolume', 'specCategory', 'specManufacturer']) if (!d[k]) bad.push(`${k} 공란 — 표시 의무 3항은 서버 400`);
  if (d.platform === 'amazon-jp' && d.promo) bad.push('아마존JP + 프로모션 = 규정상 400');
  const content = fx.report?.detailContent ?? '';
  const chars = content.replace(/\s/g, '').length;
  if (chars > 0 && chars < 50) bad.push(`콘텐츠 공백제외 ${chars}자 — 50자 하드게이트에 걸려 제출 불가`);
  return bad;
}

async function main() {
  const personaId = arg('persona');
  if (!personaId) throw new Error('--persona P01 이 필요합니다.');
  const base = (arg('base', process.env.UT_BASE_URL ?? DEFAULT_BASE)).replace(/\/$/, '');
  const tasks = (arg('tasks', DEFAULT_TASKS.join(','))).split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = tasks.filter((t) => !TASKS[t]);
  if (unknown.length) throw new Error(`알 수 없는 과업: ${unknown.join(',')}`);
  const force = flag('force');
  const navTimeout = Number(arg('nav-timeout-ms', 45_000));
  const firstNavTimeout = Number(arg('first-nav-timeout-ms', 120_000));

  const registry = JSON.parse(readFileSync(path.join(ROOT, '.ut/accounts.json'), 'utf8'));
  const acc = registry.accounts.find((a) => a.personaId === personaId);
  if (!acc) throw new Error(`.ut/accounts.json 에 ${personaId} 가 없습니다.`);
  const account = { email: acc.email, password: acc.password ?? registry.password };

  const fixtures = JSON.parse(readFileSync(path.join(ROOT, arg('fixtures', 'docs/research/ut-agent/fixtures/personas-input.json')), 'utf8'));
  const fixture = fixtures.personas.find((p) => p.personaId === personaId);
  if (!fixture) throw new Error(`personas-input.json 에 ${personaId} 가 없습니다.`);
  const productImage = path.join(ROOT, fixture.productImage);

  const bad = preflightFixture(fixture, productImage);
  if (bad.length) {
    warn(`\n✖ fixture 프리플라이트 실패 (${personaId})`);
    for (const b of bad) warn(`   - ${b}`);
    process.exit(2);
  }

  const paths = runPaths(personaId, arg('out', '.ut/runs'));
  ensureRunDirs(paths);
  if (existsSync(paths.lock)) {
    const held = JSON.parse(readFileSync(paths.lock, 'utf8'));
    const alive = (() => { try { process.kill(held.pid, 0); return true; } catch { return false; } })();
    if (alive) throw new Error(`${personaId} 이미 실행 중(pid ${held.pid}) — 같은 폴더를 두 프로세스가 쓰면 manifest 가 깨집니다.`);
  }
  writeFileSync(paths.lock, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), tasks })}\n`);

  const manifest = loadManifest(paths, {
    personaId,
    account: account.email,
    brand: fixture.brand.brandName,
    startedAt: new Date().toISOString(),
  });
  const runStarted = Date.now();
  const run = beginRun(manifest, {
    tasks, baseUrl: base, peers: Number(arg('peers', 1)),
    startedAt: new Date().toISOString(), skipped: [], sessionSource: null,
  });

  log(`▶ ${personaId} · ${fixture.brand.brandName} · ${account.email}`);
  log(`  대상 ${base} · 과업 ${tasks.join(',')}`);

  const browser = await chromium.launch({ headless: !flag('headed'), slowMo: Number(arg('slowmo', 0)) });
  const ctx = {
    base, account, fixture, productImage, paths, manifest, navTimeout,
    // 드라이버가 생성 도중 죽었을 때 이미 돌고 있는 잡에 다시 붙는다(중복 생성·중복 과금 방지)
    attach: { report: arg('attach-report'), thumbnail: arg('attach-thumbnail'), detail: arg('attach-detail') },
    planPayload: null, page: null, context: null,
    consoleErrors: [], failedRequests: [],
    drainConsole() { const v = this.consoleErrors; this.consoleErrors = []; return v; },
    drainFailed() { const v = this.failedRequests; this.failedRequests = []; return v; },
    async saveState() { await this.context.storageState({ path: paths.state }); },
    async goto(url, { first = false } = {}) {
      const target = url.startsWith('http') ? url : `${base}${url}`;
      await this.page.goto(target, { waitUntil: 'domcontentloaded', timeout: first ? firstNavTimeout : navTimeout });
      // 하이드레이션 전에 조작하면 DOM 은 바뀌는데 React 상태는 안 바뀐다 — setInputFiles 가 조용히 무시되고
      // "제품컷 1장을 올려 주세요" 안내가 그대로 남는 사고를 T4·T5 에서 겪었다.
      await this.page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    },
  };

  /** 컨텍스트 하나 — needsSession 이면 storageState 를 얹는다 */
  async function makeContext({ withSession }) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      acceptDownloads: true,
      storageState: withSession && existsSync(paths.state) ? paths.state : undefined,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(25_000);
    page.setDefaultNavigationTimeout(navTimeout);
    page.on('console', (m) => { if (m.type() === 'error') ctx.consoleErrors.push(m.text().slice(0, 400)); });
    page.on('requestfailed', (r) => ctx.failedRequests.push(`${r.method()} ${r.url().slice(0, 200)} — ${r.failure()?.errorText ?? ''}`));
    page.on('response', async (r) => {
      if (r.url().includes('/api/studio/detail/plan') && r.ok()) ctx.planPayload = await r.json().catch(() => null);
      // 폼 경로(/app/report/new)가 URL 정규식에 걸려 id 를 "new" 로 읽는 사고가 있었다 —
      // 생성 id 는 URL 이 아니라 **제출 응답**에서 받는 게 유일하게 확실하다
      if (r.request().method() === 'POST' && /\/api\/report\/?$/.test(new URL(r.url()).pathname) && r.ok()) {
        ctx.submittedReportId = (await r.json().catch(() => null))?.id ?? null;
      }
      if (r.request().method() === 'POST' && /\/api\/studio\/thumbnail\/?$/.test(new URL(r.url()).pathname) && r.ok()) {
        ctx.submittedThumbnailId = (await r.json().catch(() => null))?.id ?? null;
      }
      if (r.request().method() === 'POST' && /\/api\/studio\/detail\/?$/.test(new URL(r.url()).pathname) && r.ok()) {
        ctx.submittedDetailId = (await r.json().catch(() => null))?.id ?? null;
      }
      if (r.status() >= 500) ctx.failedRequests.push(`${r.request().method()} ${r.url().slice(0, 200)} — HTTP ${r.status()}`);
    });
    return { context, page };
  }

  /** 세션 확보 — storageState 복원 → 살아 있는지 확인 → 죽었으면 조용히 재로그인 */
  async function ensureSession() {
    const res = await ctx.page.request.get(`${base}/api/brand`, { timeout: 60_000 }).catch(() => null);
    if (res?.ok()) { run.sessionSource = run.sessionSource ?? 'restored'; return true; }
    const r = await TASKS.T1.run(ctx);
    run.sessionSource = 'relogin';
    if (r.outcome === '실패') { warn(`  ✖ 재로그인 실패: ${r.error}`); return false; }
    return true;
  }

  let sessionCtx = null;
  try {
    for (const task of tasks) {
      const def = TASKS[task];
      if (manifest.outcome[task] === '완료' && !force) {
        run.skipped.push(task);
        log(`  · ${task} 건너뜀 (이미 완료 · --force 로 재실행)`);
        continue;
      }

      // T0 은 비로그인 전용 컨텍스트를 새로 판다(세션이 섞이면 자극물이 달라진다)
      const needsFresh = !def.needsSession && task === 'T0';
      if (needsFresh) {
        const c = await makeContext({ withSession: false });
        ctx.context = c.context; ctx.page = c.page;
      } else if (!sessionCtx) {
        sessionCtx = await makeContext({ withSession: true });
        ctx.context = sessionCtx.context; ctx.page = sessionCtx.page;
        if (def.needsSession && !(await ensureSession())) {
          mergeTask(manifest, task, { steps: [], outcome: '실패' });
          saveManifest(paths, manifest);
          break;
        }
      } else {
        ctx.context = sessionCtx.context; ctx.page = sessionCtx.page;
        if (def.needsSession && !(await ensureSession())) break;
      }

      const t0 = Date.now();
      const result = await Promise.race([
        def.run(ctx).catch((err) => ({ steps: [], outcome: '실패', error: String(err?.message ?? err) })),
        new Promise((r) => setTimeout(() => r({ steps: [], outcome: '실패', error: `과업 예산 ${def.budgetMs}ms 초과` }), def.budgetMs)),
      ]);
      mergeTask(manifest, task, result);
      if (result.error) manifest.outcome[`${task}_error`] = result.error;
      saveManifest(paths, manifest);
      log(`  ${result.outcome === '완료' ? '✔' : result.outcome === '부분완료' ? '△' : '✘'} ${task} ${result.outcome} (${Math.round((Date.now() - t0) / 1000)}초)${result.error ? ` — ${result.error}` : ''}`);

      if (needsFresh) { await ctx.context.close(); ctx.context = null; ctx.page = null; }
      else if (def.needsSession) await ctx.saveState();
    }

    // env 메타 — 실행 모드가 목이면 산출물 평가가 통째로 무효라 반드시 남긴다
    if (sessionCtx) {
      ctx.page = sessionCtx.page;
      const meta = await ctx.page.request.get(`${base}/api/studio/detail`, { timeout: 60_000 }).then((r) => r.json()).catch(() => null);
      if (meta) {
        manifest.env = {
          baseUrl: base, llmMode: meta.llmMode, imageMode: meta.imageMode, imageModel: meta.imageModel,
          imageQuality: arg('image-quality', 'medium'), imageQualitySource: 'cli 기본값(앱 미노출)',
          store: meta.storeKind, detailReady: meta.readiness?.ready ?? null, capturedAt: new Date().toISOString(),
        };
        if (meta.llmMode === 'mock' || meta.imageMode === 'mock') {
          manifest.env.invalidatesOutputEvaluation = true;
          warn('  ⚠ 목 모드 감지 — 산출물 평가가 무효가 됩니다(§4-1 6번).');
        }
      }
    }
  } finally {
    finishRun(manifest, run, runStarted);
    saveManifest(paths, manifest);
    await browser.close().catch(() => {});
    rmSync(paths.lock, { force: true });
  }

  log('');
  log(`  결과: ${ALL_TASKS.map((t) => `${t}=${manifest.outcome[t] ?? '-'}`).join(' ')}`);
  const g = manifest.generations;
  log(`  생성: report=${g.report?.status ?? '-'} thumbnail=${g.thumbnail?.status ?? '-'} detail=${g.detail?.status ?? '-'}`);
  log(`  이미지: ${manifest.imageCost.calls ?? '계기없음'}콜 · ${manifest.imageCost.usd != null ? `$${manifest.imageCost.usd}` : 'usd 없음'}`);
  const failed = tasks.filter((t) => manifest.outcome[t] === '실패');
  process.exit(failed.length ? 1 : 0);
}

process.on('unhandledRejection', (e) => { warn(`\n✖ unhandledRejection: ${e}`); process.exit(1); });
main().catch((err) => { warn(`\n✖ ${err?.message ?? err}`); process.exit(1); });
