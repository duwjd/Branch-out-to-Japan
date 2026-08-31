/**
 * 과업 T0~T7 — 00-ut-plan.md §6 시나리오를 Playwright 조작으로 옮긴 것.
 * 각 run() 은 { steps, outcome, generation? } 를 돌려주고, 실패는 예외 대신 outcome 으로 표현한다.
 */

import { SEQ_BASE } from './manifest.mjs';
import { captureStep, openEmailLogin, safeClick, settle, VIEWPORT } from './shot.mjs';
import { apiJson, downloadArtifact, pollWithShots, writeArtifact } from './net.mjs';
import {
  CATEGORY_CHIP,
  DETAIL_CATEGORY,
  DETAIL_TEMPLATE,
  JP_CHANNEL,
  PLATFORM_DETAIL,
  PLATFORM_THUMB,
  POSITIONING_TAGS,
  PRODUCT_CLASS_CHIP,
  REPORT_TAB_LABELS,
  STAGE_LABEL,
  THUMB_STYLE,
} from './selectors.mjs';

/**
 * 폴링 상한 — 계획서 §P4 는 일괄 6분이지만, 잡마다 사는 시간이 다르다.
 * 앱 자신이 10분 무갱신을 죽은 잡으로 판정하므로(STALE_JOB_MS) 그게 자연스러운 천장이다.
 * 리포트는 실측에서 6분을 넘겨 끝나지 않은 사례가 있어 10분까지 본다 — 6분에서 끊으면
 * "우리가 안 기다린 것"과 "잡이 죽은 것"을 구분할 수 없다.
 */
const POLL = { maxMs: 360_000, intervalMs: 2500, interimMs: 30_000 };
const POLL_REPORT = { ...POLL, maxMs: 600_000 };
const POLL_DETAIL = { ...POLL, maxMs: 480_000 };

/** 값이 채워질 때까지 짧게 되돌아본다 — 이벤트 훅이 채우는 값을 기다릴 때 쓴다 */
async function waitFor(read, timeoutMs, stepMs) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = read();
    if (v) return v;
    if (Date.now() > until) return null;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

/** attach 로 다시 붙을 때, 실제 생성에 걸린 시간을 폴링 재측정값으로 덮지 않는다(§10 성능 실측이 이 값을 쓴다) */
function carryElapsed(ctx, kind, gen) {
  const prev = ctx.manifest.generations?.[kind];
  if (prev?.elapsedMs) {
    gen.elapsedMs = prev.elapsedMs;
    gen.elapsedFrom = 'attach 이전 실행의 실측';
  }
}

/** aria-pressed 를 읽고 원하는 상태와 다를 때만 누른다 — 블라인드 클릭은 선택을 뒤집는다 */
async function setPressed(locator, want) {
  const on = (await locator.getAttribute('aria-pressed')) === 'true';
  if (on !== want) await locator.click();
}

/**
 * 파일을 올리고 **React 가 받았는지**까지 확인한다.
 * 하이드레이션 직후에는 input.files 만 채워지고 상태가 안 바뀌는 창이 있어, 확인 후 1회 재시도한다.
 * @param {import('playwright').Locator} input
 * @param {() => Promise<boolean>} accepted 화면이 파일을 받아들였는지 판정
 */
async function uploadFile(page, input, filePath, accepted) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await input.setInputFiles(filePath);
    for (let i = 0; i < 20; i += 1) {
      if (await accepted()) return;
      await page.waitForTimeout(500);
    }
  }
  throw new Error('제품컷 업로드가 화면에 반영되지 않았다 — 하이드레이션 또는 선택자 문제');
}

/** `<p>라벨</p>` 다음 형제 div 안의 칩 — 상세 폼 칩은 role 도 aria-pressed 도 없다 */
const chipAfter = (page, label, text) =>
  page.locator(`p:text-is("${label}") + div`).getByRole('button', { name: text, exact: true });

// ── T0 랜딩 (비로그인) ───────────────────────────────────────────────────────
export const T0 = {
  id: 'T0',
  needsSession: false,
  budgetMs: 300_000,
  async run(ctx) {
    const seq = SEQ_BASE.T0;
    const steps = [];
    // 세션 쿠키가 섞이면 자극물 자체가 달라진다 — 먼저 단언한다
    const cookies = await ctx.page.context().cookies(ctx.base);
    if (cookies.some((c) => c.name === 'yoake_session')) {
      return { steps, outcome: '실패', error: '비로그인 전제 위반 — 세션 쿠키가 있다' };
    }
    await ctx.goto('/', { first: true });
    steps.push(
      await captureStep(ctx, {
        seq,
        id: 'landing',
        task: 'T0',
        label: '랜딩 전체(비로그인)',
        action: 'goto',
        descent: true,
        fullPage: true,
        text: 'body',
        tiles: true,
        tileId: 'landing',
        maxTiles: 24,
      }),
    );
    const ok = steps.every((s) => !s.error);
    return { steps, outcome: ok ? '완료' : '부분완료' };
  },
};

// ── T1 로그인 · 첫 진입 ─────────────────────────────────────────────────────
export const T1 = {
  id: 'T1',
  needsSession: false,
  budgetMs: 240_000,
  async run(ctx) {
    const steps = [];
    try {
      await ctx.goto('/login', { first: true });
      if (new URL(ctx.page.url()).pathname.startsWith('/app')) {
        steps.push(
          await captureStep(ctx, {
            seq: SEQ_BASE.T1 + 1,
            id: 'app-home',
            task: 'T1',
            label: '앱 홈',
            note: '세션 유지 — 로그인 화면 미노출',
          }),
        );
        return { steps, outcome: '완료' };
      }
      steps.push(
        await captureStep(ctx, { seq: SEQ_BASE.T1, id: 'login', task: 'T1', label: '로그인 화면(소셜 기본)' }),
      );

      await openEmailLogin(ctx.page);
      await ctx.page.locator('#li-email').fill(ctx.account.email);
      await ctx.page.locator('#li-pw').fill(ctx.account.password);
      // 라벨이 input 을 감싸고 있다 — getByText 는 텍스트 노드를 잡아 형제 input 을 못 찾는다
      await ctx.page.locator('label:has-text("로그인 상태 유지") input[type="checkbox"]').check();
      steps.push(
        await captureStep(ctx, {
          seq: SEQ_BASE.T1,
          id: 'login',
          task: 'T1',
          label: '로그인 입력 완료',
          suffixIndex: 1,
        }),
      );

      await Promise.all([
        ctx.page.waitForURL(/\/app(\/|$)/, { timeout: ctx.navTimeout }),
        ctx.page.locator('form:has(#li-email) button[type="submit"]').click(),
      ]);
      await ctx.page.waitForSelector('main', { timeout: ctx.navTimeout });
      await ctx.saveState();
      steps.push(
        await captureStep(ctx, {
          seq: SEQ_BASE.T1 + 1,
          id: 'app-home',
          task: 'T1',
          label: '앱 홈(브랜드 미등록 온보딩)',
          tiles: true,
        }),
      );
      return { steps, outcome: '완료' };
    } catch (err) {
      const shown = await ctx.page
        .locator('#li-err')
        .innerText()
        .catch(() => '');
      steps.push(
        await captureStep(ctx, {
          seq: SEQ_BASE.T1,
          id: 'login',
          task: 'T1',
          label: '로그인 실패 화면',
          suffixIndex: 2,
        }),
      );
      return { steps, outcome: '실패', error: `${err?.message ?? err}${shown ? ` / 화면: ${shown}` : ''}` };
    }
  },
};

// ── T2 브랜드 등록 (온보딩 → 브랜드 킷) ─────────────────────────────────────
export const T2 = {
  id: 'T2',
  needsSession: true,
  budgetMs: 240_000,
  async run(ctx) {
    const seq = SEQ_BASE.T2;
    const steps = [];
    const b = ctx.fixture.brand;
    try {
      // 1단계 — /app 온보딩. /app/brand 는 브랜드가 없으면 /app 으로 redirect 한다
      await ctx.goto('/app');
      const onboarding = ctx.page.locator('#obBrandName');
      if (await onboarding.count()) {
        await onboarding.fill(b.brandName);
        await ctx.page
          .locator('[role="radiogroup"][aria-labelledby="obCatLabel"] [role="radio"]')
          .filter({ hasText: CATEGORY_CHIP[b.category] })
          .first()
          .click();
        await ctx.page.locator('#obClass').selectOption(b.productClass);
        steps.push(await captureStep(ctx, { seq, id: 'brand-onboarding', task: 'T2', label: '브랜드 온보딩 입력' }));
        await safeClick(ctx.page.getByRole('button', { name: /진단 준비 시작/ }));
        await onboarding.waitFor({ state: 'detached', timeout: 60_000 }).catch(() => {});
      } else {
        steps.push(
          await captureStep(ctx, {
            seq,
            id: 'brand-onboarding',
            task: 'T2',
            label: '앱 홈(브랜드 기존재)',
            note: '온보딩 건너뜀',
          }),
        );
      }

      // 2단계 — /app/brand 전체 폼
      await ctx.goto('/app/brand');
      if (new URL(ctx.page.url()).pathname === '/app') throw new Error('브랜드 미등록 — 온보딩 실패로 /app 리다이렉트');
      steps.push(
        await captureStep(ctx, { seq: seq + 1, id: 'brand-form', task: 'T2', label: '브랜드 관리 진입', tiles: true }),
      );

      await ctx.page.locator('#brandName').fill(b.brandName);
      await ctx.page.locator('#category').selectOption(b.category);
      await ctx.page.locator('#productClass').selectOption(b.productClass);

      const tagBox = ctx.page.locator('fieldset:has(legend:has-text("포지셔닝 태그"))');
      for (const [value, label] of POSITIONING_TAGS) {
        await setPressed(tagBox.getByRole('button', { name: label, exact: true }), b.positioningTags.includes(value));
      }
      await ctx.page.locator('#targetMemo').fill(b.targetMemo ?? '');
      await ctx.page.locator('#productInfoMemo').fill(b.productInfoMemo ?? '');
      await ctx.page.locator('#krUrl').fill(b.channels?.krUrl ?? '');

      const chBox = ctx.page.locator('fieldset:has(legend:has-text("JP 채널"))');
      for (const { channel, url } of b.channels?.jp ?? []) {
        await setPressed(chBox.getByRole('button', { name: JP_CHANNEL[channel], exact: true }), true);
        if (channel !== 'undecided' && url) await ctx.page.locator(`#jpUrl-${channel}`).fill(url);
      }
      await ctx.page.locator('#toneGuide').fill(b.toneGuide ?? '');
      steps.push(
        await captureStep(ctx, {
          seq: seq + 1,
          id: 'brand-form',
          task: 'T2',
          label: '브랜드 킷 입력 완료',
          suffixIndex: 1,
          tiles: true,
        }),
      );

      await safeClick(ctx.page.getByRole('button', { name: '저장', exact: true }));
      await ctx.page.locator('p[role="status"]:has-text("저장되었습니다")').waitFor({ timeout: 60_000 });
      steps.push(await captureStep(ctx, { seq: seq + 2, id: 'brand-saved', task: 'T2', label: '브랜드 저장 완료' }));
      return { steps, outcome: '완료' };
    } catch (err) {
      steps.push(
        await captureStep(ctx, {
          seq: seq + 2,
          id: 'brand-saved',
          task: 'T2',
          label: '브랜드 저장 실패',
          suffixIndex: 1,
        }),
      );
      return { steps, outcome: steps.some((s) => !s.error) ? '부분완료' : '실패', error: String(err?.message ?? err) };
    }
  },
};

// ── T3 진단 리포트 ──────────────────────────────────────────────────────────
export const T3 = {
  id: 'T3',
  needsSession: true,
  budgetMs: 900_000,
  async run(ctx) {
    const seq = SEQ_BASE.T3;
    const steps = [];
    const { brand: b, report: r } = ctx.fixture;
    const gen = {
      status: 'failed',
      id: null,
      mode: null,
      elapsedMs: 0,
      artifact: null,
      artifacts: [],
      images: [],
      imagesInstrumented: false,
    };
    try {
      if (ctx.attach?.report) {
        // 이미 돌고 있는 리포트에 다시 붙는다 — 새로 제출하면 같은 입력으로 두 건이 생긴다.
        // 이미 찍어 둔 입력폼 캡처는 실제로 일어난 화면이므로 그대로 이어받는다(잃으면 T3 관찰이 빈다)
        steps.push(...(ctx.manifest.steps ?? []).filter((st) => st.task === 'T3' && st.seq <= seq + 1));
        gen.id = ctx.attach.report;
        await ctx.goto(`/app/report/${gen.id}`);
        carryElapsed(ctx, 'report', gen);
        return await followReport(ctx, gen, steps, seq);
      }
      await ctx.goto('/app/report/new');
      // 브랜드 프리필이 GET /api/brand 응답 뒤에 태그를 채운다 — 먼저 앉히고 나서 조정한다
      await ctx.page
        .waitForResponse((res) => res.url().includes('/api/brand') && res.request().method() === 'GET', {
          timeout: 20_000,
        })
        .catch(() => {});
      await ctx.page.waitForTimeout(500);
      steps.push(await captureStep(ctx, { seq, id: 'report-new', task: 'T3', label: '진단 입력폼 진입', tiles: true }));

      await ctx.page.locator('#brandName').fill(b.brandName);
      const tagBox = ctx.page.locator('[role="group"][aria-labelledby="positioning-label"]');
      for (const [value, label] of POSITIONING_TAGS) {
        await setPressed(tagBox.getByRole('button', { name: label, exact: true }), b.positioningTags.includes(value));
      }
      await ctx.page.locator('#positioningNote').fill(b.positioningNote ?? '');
      await ctx.page
        .locator('[role="radiogroup"][aria-labelledby="category-label"] [role="radio"]')
        .filter({ hasText: CATEGORY_CHIP[b.category] })
        .first()
        .click();
      await ctx.page.locator('#targetMemo').fill(b.targetMemo ?? '');
      await ctx.page
        .locator('[role="radiogroup"][aria-labelledby="class-label"] [role="radio"]')
        .filter({ hasText: PRODUCT_CLASS_CHIP[r.productClass] })
        .first()
        .click();
      await ctx.page.locator('#productName').fill(r.productName ?? '');
      await ctx.page.locator('#priceJpy').fill(String(r.price ?? ''));
      await ctx.page.locator('#keyIngredients').fill((r.ingredients ?? []).join(', '));
      if (r.detailContent) {
        await ctx.page.getByRole('button', { name: '텍스트 붙여넣기' }).click();
        await ctx.page.locator('#sourceText').fill(r.detailContent);
      }
      steps.push(
        await captureStep(ctx, {
          seq,
          id: 'report-new',
          task: 'T3',
          label: '진단 입력 완료',
          suffixIndex: 1,
          tiles: true,
        }),
      );

      const submit = ctx.page.getByRole('button', { name: '진단 리포트 생성' });
      if (await submit.isDisabled()) throw new Error('제출 불가 — 하드게이트 또는 필수 항목 미충족');
      ctx.submittedReportId = null;
      await submit.click();
      // id 는 URL 이 아니라 제출 응답에서 받는다(폼 경로 `/app/report/new` 가 URL 정규식에 걸린 적 있다)
      const reportId = await waitFor(() => ctx.submittedReportId, 90_000, 500);
      if (!reportId) {
        const shown = await ctx.page
          .locator('p[role="alert"]')
          .first()
          .innerText()
          .catch(() => '');
        throw new Error(`제출 응답에서 리포트 id 를 받지 못했다${shown ? ` — 화면: ${shown}` : ''}`);
      }
      gen.id = reportId;
      await ctx.page.waitForURL(new RegExp(`/app/report/${reportId}$`), { timeout: 30_000 }).catch(() => {});
      steps.push(await captureStep(ctx, { seq: seq + 1, id: 'report-submitted', task: 'T3', label: '진단 제출 직후' }));
      return await followReport(ctx, gen, steps, seq);
    } catch (err) {
      return {
        steps,
        outcome: steps.length ? '부분완료' : '실패',
        error: String(err?.message ?? err),
        generation: { kind: 'report', data: gen },
      };
    }
  },
};

/** 제출 이후 — 폴링 · 탭 3개 캡처 · 산출물 저장. attach 경로와 정상 경로가 같은 코드를 쓴다 */
async function followReport(ctx, gen, steps, seq) {
  const reportId = gen.id;
  try {
    const res = await pollWithShots(ctx, {
      ...POLL_REPORT,
      probe: async () => {
        const j = await apiJson(ctx.page, `${ctx.base}/api/report/${reportId}/status`);
        return {
          terminal: j.status === 'published' || j.status === 'failed',
          ok: j.status === 'published',
          status: j.status,
          progress: STAGE_LABEL[j.stage] ?? j.stage ?? null,
          raw: j,
        };
      },
      shoot: (i) =>
        captureStep(ctx, {
          seq: seq + 2,
          id: 'report-processing',
          task: 'T3',
          label: '리포트 생성 대기',
          action: 'poll',
          suffixIndex: i,
        }),
    });
    steps.push(...res.steps.map((s) => ({ ...s, progress: res.progress })));
    gen.status = res.timeout ? 'timeout' : res.ok ? 'published' : (res.raw?.status ?? 'failed');
    gen.elapsedMs = res.elapsedMs;
    gen.precisionLimited = res.raw?.precisionLimited ?? null;
    if (!res.ok) return { steps, outcome: '부분완료', generation: { kind: 'report', data: gen } };

    // 탭 3개를 각각 찍는다 — ReportView 는 활성 탭만 렌더해서 한 장이면 2/3 를 잃는다
    await ctx.page.reload({ waitUntil: 'domcontentloaded' });
    await ctx.page.locator('[role="tablist"]').first().waitFor({ timeout: 30_000 });
    const tabHtml = [];
    const tabText = [];
    for (let i = 0; i < REPORT_TAB_LABELS.length; i += 1) {
      await ctx.page.locator(`#report-tab-${i}`).click();
      await ctx.page.locator(`#report-tabpanel-${i}`).waitFor({ timeout: 20_000 });
      await ctx.page.waitForTimeout(800);
      steps.push(
        await captureStep(ctx, {
          seq: seq + 3 + i,
          id: `report-${['market', 'diagnosis', 'prescription'][i]}`,
          task: 'T3',
          label: `리포트 · ${REPORT_TAB_LABELS[i]} 탭`,
          tiles: true,
        }),
      );
      tabHtml.push(
        `<section data-tab="${REPORT_TAB_LABELS[i]}">${await ctx.page.locator('main').innerHTML()}</section>`,
      );
      tabText.push(`─── ${REPORT_TAB_LABELS[i]} ───\n${await ctx.page.locator('main').innerText()}`);
    }
    gen.mode = res.raw?.report?.blocksJson?.meta?.mode ?? null;
    gen.overallScore = res.raw?.report?.overallScore ?? null;
    gen.artifacts.push(writeArtifact(ctx, 'report.html', await buildReportHtml(ctx, tabHtml)));
    gen.artifacts.push(writeArtifact(ctx, 'report.txt', tabText.join('\n\n')));
    gen.artifacts.push(
      writeArtifact(ctx, 'report-blocks.json', `${JSON.stringify(res.raw?.report?.blocksJson ?? null, null, 2)}\n`),
    );
    gen.artifact = 'artifacts/report.html';

    // 슬라이드는 호출할 때마다 LLM 콜⑤를 다시 돌리고 다시 과금한다 — 정확히 1회만
    try {
      const btn = ctx.page.getByRole('button', { name: '보고용 슬라이드 만들기' }).first();
      const [dl] = await Promise.all([ctx.page.waitForEvent('download', { timeout: 180_000 }), btn.click()]);
      steps.push(
        await captureStep(ctx, {
          seq: seq + 5,
          id: 'report-prescription',
          task: 'T3',
          label: '슬라이드 생성 대기',
          suffixIndex: 9,
        }),
      );
      await dl.saveAs(`${ctx.paths.artifacts}/slides.html`);
      gen.artifacts.push('artifacts/slides.html');
      gen.slidesFetchedAt = new Date().toISOString();
    } catch (err) {
      gen.slidesError = String(err?.message ?? err);
    }
    return { steps, outcome: '완료', generation: { kind: 'report', data: gen } };
  } catch (err) {
    return {
      steps,
      outcome: steps.length ? '부분완료' : '실패',
      error: String(err?.message ?? err),
      generation: { kind: 'report', data: gen },
    };
  }
}

/** 탭 3개 HTML + 스타일시트 인라인 — 페르소나가 Read 로 열어도 문장이 그대로 보이게 */
async function buildReportHtml(ctx, sections) {
  const css = await ctx.page
    .evaluate(async () => {
      const parts = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '');
      for (const link of document.querySelectorAll('link[rel=stylesheet]')) {
        try {
          parts.push(await (await fetch(link.href)).text());
        } catch {
          /* 못 받으면 그냥 뺀다 */
        }
      }
      return parts.join('\n');
    })
    .catch(() => '');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>진단 리포트</title><base href="${ctx.base}/"><style>${css}</style></head><body>${sections.join('\n')}</body></html>\n`;
}

// ── T4 썸네일 ───────────────────────────────────────────────────────────────
export const T4 = {
  id: 'T4',
  needsSession: true,
  budgetMs: 720_000,
  async run(ctx) {
    const seq = SEQ_BASE.T4;
    const steps = [];
    const t = ctx.fixture.thumbnail;
    const gen = {
      status: 'failed',
      id: null,
      styleId: t.styleId,
      proofBadge: false,
      elapsedMs: 0,
      artifact: null,
      images: [],
      imagesInstrumented: false,
    };
    try {
      if (ctx.attach?.thumbnail) {
        gen.id = ctx.attach.thumbnail;
        steps.push(...(ctx.manifest.steps ?? []).filter((st) => st.task === 'T4' && st.seq <= seq + 1));
        await ctx.goto(`/app/studio/thumbnail/${gen.id}`);
        carryElapsed(ctx, 'thumbnail', gen);
        return await followThumbnail(ctx, gen, steps, seq);
      }
      await ctx.goto('/app/studio/thumbnail');
      // 등록 제품이 있으면 기본 탭이 '브랜드 자산'으로 바뀌어 업로드 칸이 사라진다 — 명시적으로 되돌린다
      await ctx.page
        .locator('[role="tablist"][aria-label="제품컷 소스"] [role="tab"]', { hasText: '직접 업로드' })
        .click()
        .catch(() => {});
      await uploadFile(
        ctx.page,
        ctx.page.locator('input[type="file"]').first(),
        ctx.productImage,
        async () => (await ctx.page.locator('img[alt="업로드한 원본 이미지 미리보기"]').count()) > 0,
      );
      await ctx.page
        .locator('[role="radiogroup"][aria-label="타깃 플랫폼"] [role="radio"]')
        .filter({ hasText: PLATFORM_THUMB[t.platform] })
        .first()
        .click();

      const card = ctx.page
        .locator('[role="radiogroup"][aria-label="템플릿 8종"] [role="radio"]')
        .nth('ABCDEFGH'.indexOf(t.styleId));
      const cardText = await card.innerText();
      if (!cardText.includes(THUMB_STYLE[t.styleId]))
        throw new Error(`템플릿 순서 불일치 — ${t.styleId} 카드가 "${THUMB_STYLE[t.styleId]}" 가 아니다`);
      await card.click();

      if (t.proof) {
        await ctx.page.getByLabel('실적명').fill(t.proof.rankTitle);
        await ctx.page.getByLabel('부문, 장르').fill(t.proof.genre);
        await ctx.page.getByLabel('수상일').fill(t.proof.aggregationDate);
      }
      if (t.promo) {
        await ctx.page.getByLabel('프로모션 이름').fill(t.promo.setTitle);
        await ctx.page.getByLabel('할인 가격 (엔)').fill(t.promo.salePrice);
        if (t.promo.normalPriceVerified) {
          await ctx.page.locator('label:has-text("취소선 가격 이미지 만들기") input[type="checkbox"]').check();
          await ctx.page.getByLabel('정가 (엔)').fill(t.promo.normalPrice ?? '');
        }
      }
      steps.push(
        await captureStep(ctx, { seq, id: 'thumbnail-new', task: 'T4', label: '썸네일 입력 완료', tiles: true }),
      );

      ctx.submittedThumbnailId = null;
      await Promise.all([
        ctx.page.waitForURL(/\/app\/studio\/thumbnail\/[^/]+$/, { timeout: 120_000 }),
        ctx.page.getByRole('button', { name: '생성하기' }).click(),
      ]);
      // 제출 응답 id 가 정본, URL 은 폴백 — 폼 경로가 정규식에 걸리는 사고를 T3 에서 겪었다
      const id = ctx.submittedThumbnailId ?? ctx.page.url().split('/').pop();
      gen.id = id;
      steps.push(
        await captureStep(ctx, { seq: seq + 1, id: 'thumbnail-submitted', task: 'T4', label: '썸네일 제출 직후' }),
      );
      return await followThumbnail(ctx, gen, steps, seq);
    } catch (err) {
      return {
        steps,
        outcome: steps.length ? '부분완료' : '실패',
        error: String(err?.message ?? err),
        generation: { kind: 'thumbnail', data: gen },
      };
    }
  },
};

/** 제출 이후 — 폴링·결과 캡처·다운로드. attach 경로와 정상 경로가 같은 코드를 쓴다 */
async function followThumbnail(ctx, gen, steps, seq) {
  const id = gen.id;
  try {
    const res = await pollWithShots(ctx, {
      ...POLL,
      probe: async () => {
        const j = await apiJson(ctx.page, `${ctx.base}/api/studio/thumbnail/${id}`);
        return {
          terminal: j.status !== 'generating',
          ok: j.status === 'done',
          status: j.status,
          progress: STAGE_LABEL[j.stage] ?? j.stage ?? null,
          raw: j,
        };
      },
      shoot: (i) =>
        captureStep(ctx, {
          seq: seq + 2,
          id: 'thumbnail-generating',
          task: 'T4',
          label: '썸네일 생성 대기',
          action: 'poll',
          suffixIndex: i,
        }),
    });
    steps.push(...res.steps.map((s) => ({ ...s, progress: res.progress })));
    gen.status = res.timeout ? 'timeout' : res.ok ? 'done' : (res.raw?.status ?? 'failed');
    gen.elapsedMs = res.elapsedMs;
    if (res.ok) {
      const a = res.raw;
      gen.styleId = a.styleCategory ?? t.styleId;
      gen.proofBadge = Boolean(a.proof);
      gen.gatePassed = a.gateResult?.passed ?? null;
      applyImageUsage(gen, a.imageUsage);
      steps.push(
        await captureStep(ctx, { seq: seq + 3, id: 'thumbnail-done', task: 'T4', label: '썸네일 결과', tiles: true }),
      );
      if (a.imageUrl)
        gen.artifact = await downloadArtifact(ctx, { url: a.imageUrl, outFile: 'thumbnail.png', expect: 'png' });
      writeArtifact(ctx, 'thumbnail.json', `${JSON.stringify(a, null, 2)}\n`);
    }
    return { steps, outcome: res.ok ? '완료' : '부분완료', generation: { kind: 'thumbnail', data: gen } };
  } catch (err) {
    return {
      steps,
      outcome: steps.length ? '부분완료' : '실패',
      error: String(err?.message ?? err),
      generation: { kind: 'thumbnail', data: gen },
    };
  }
}

/** 앱이 내려준 이미지 원장을 manifest 모양으로 옮긴다. 없으면 계기 없음으로 남긴다(추정 금지) */
function applyImageUsage(gen, imageUsage) {
  if (!imageUsage || !Array.isArray(imageUsage.calls)) {
    gen.imagesInstrumented = false;
    gen.images = [];
    return;
  }
  gen.imagesInstrumented = true;
  gen.images = imageUsage.calls.map((c) => ({
    call: c.call,
    size: c.size,
    quality: c.quality,
    usage: c.usage ?? null,
    usd: c.usd ?? null,
    blockType: c.blockType ?? null,
    retry: c.retry ?? 0,
  }));
  gen.imageUsd = imageUsage.usd ?? null;
}

// ── T5 상세페이지 ───────────────────────────────────────────────────────────
export const T5 = {
  id: 'T5',
  needsSession: true,
  budgetMs: 900_000,
  async run(ctx) {
    const seq = SEQ_BASE.T5;
    const steps = [];
    const d = ctx.fixture.detail;
    const gen = {
      status: 'failed',
      id: null,
      templateId: d.templateId,
      blocks: 0,
      aiCuts: 0,
      degradedCuts: 0,
      skippedBlocks: [],
      elapsedMs: 0,
      artifact: null,
      artifacts: [],
      images: [],
      imagesInstrumented: false,
    };
    try {
      if (ctx.attach?.detail) {
        gen.id = ctx.attach.detail;
        steps.push(...(ctx.manifest.steps ?? []).filter((st) => st.task === 'T5' && st.seq <= seq + 2));
        await ctx.goto(`/app/studio/detail/${gen.id}`);
        carryElapsed(ctx, 'detail', gen);
        return await followDetail(ctx, gen, steps, seq);
      }
      const meta = await apiJson(ctx.page, `${ctx.base}/api/studio/detail`);
      if (!meta.readiness?.ready)
        throw new Error(`프리플라이트 미통과: ${JSON.stringify(meta.readiness?.checks?.filter((c) => !c.ok) ?? [])}`);

      await ctx.goto('/app/studio/detail');
      await uploadFile(
        ctx.page,
        ctx.page.locator('input[name="productImage"]'),
        ctx.productImage,
        async () => (await ctx.page.getByRole('button', { name: '제품컷 바꾸기' }).count()) > 0,
      );
      await chipAfter(ctx.page, '상품 종류', DETAIL_CATEGORY[d.productCategory]).click();
      await chipAfter(ctx.page, '타깃 플랫폼', PLATFORM_DETAIL[d.platform]).click();

      const tpl = ctx.page.locator('ul li button[aria-pressed]').nth(Number(d.templateId.slice(1)) - 1);
      const tplText = await tpl.innerText();
      if (!tplText.includes(DETAIL_TEMPLATE[d.templateId]))
        throw new Error(`템플릿 순서 불일치 — ${d.templateId} 카드가 "${DETAIL_TEMPLATE[d.templateId]}" 가 아니다`);
      await tpl.click();

      await ctx.page.locator('input[name="specVolume"]').fill(d.specVolume);
      await ctx.page.locator('input[name="specCategory"]').fill(d.specCategory);
      await ctx.page.locator('input[name="specManufacturer"]').fill(d.specManufacturer);
      await ctx.page.locator('input[name="specOrigin"]').fill(d.specOrigin ?? '');
      await ctx.page.locator('textarea[name="specFullIngredients"]').fill(d.specFullIngredients ?? '');
      // 성분·무첨가·사용법·주의사항 — 브랜드가 이미 갖고 있는 정보다. 비우면 근거 미충족으로
      // 블록이 무더기로 빠져, "빠진 블록 안내"가 브랜드 차이가 아니라 드라이버 아티팩트가 된다(§8-2 3군 차등)
      for (const [name, value] of [
        ['ingredientRows', d.ingredientRows],
        ['freeOf', d.freeOf],
        ['howToSteps', d.howToSteps],
        ['cautions', d.cautions],
        ['specRows', d.specRows],
      ]) {
        if (!value) continue;
        const field = ctx.page.locator(`textarea[name="${name}"]`);
        if (await field.count()) await field.fill(value);
      }
      steps.push(await captureStep(ctx, { seq, id: 'detail-new', task: 'T5', label: '상세 입력 완료', tiles: true }));

      await safeClick(ctx.page.getByRole('button', { name: '블록 구성 확인' }));
      await ctx.page.getByRole('heading', { name: '블록 구성 확인' }).waitFor({ timeout: 180_000 });
      steps.push(
        await captureStep(ctx, {
          seq: seq + 1,
          id: 'detail-plan',
          task: 'T5',
          label: '블록 구성 확인(빠진 블록 사유)',
          tiles: true,
        }),
      );
      if (ctx.planPayload) {
        gen.planAiBlockCount = ctx.planPayload.aiBlockCount ?? null;
        gen.skippedBlocks = (ctx.planPayload.excluded ?? []).map((e) => e.blockId ?? e.code ?? String(e));
      }

      ctx.submittedDetailId = null;
      await Promise.all([
        ctx.page.waitForURL(/\/app\/studio\/detail\/[^/]+$/, { timeout: 240_000 }),
        ctx.page.getByRole('button', { name: '생성하기' }).click(),
      ]);
      const id = ctx.submittedDetailId ?? ctx.page.url().split('/').pop();
      gen.id = id;
      steps.push(await captureStep(ctx, { seq: seq + 2, id: 'detail-submitted', task: 'T5', label: '상세 제출 직후' }));
      return await followDetail(ctx, gen, steps, seq);
    } catch (err) {
      return {
        steps,
        outcome: steps.length ? '부분완료' : '실패',
        error: String(err?.message ?? err),
        generation: { kind: 'detail', data: gen },
      };
    }
  },
};

/** 제출 이후 — 폴링·강등 집계·결합본/분할본 회수 */
async function followDetail(ctx, gen, steps, seq) {
  const id = gen.id;
  try {
    const res = await pollWithShots(ctx, {
      ...POLL_DETAIL,
      probe: async () => {
        const j = await apiJson(ctx.page, `${ctx.base}/api/studio/detail/${id}/status`);
        const prog = [
          STAGE_LABEL[j.stage] ?? j.stage,
          j.stage === 'blocks' && j.blockTotal ? `블록 ${j.blockDone}/${j.blockTotal}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return {
          terminal: j.status === 'done' || j.status === 'failed',
          ok: j.status === 'done',
          status: j.status,
          progress: prog || null,
          raw: j,
        };
      },
      shoot: (i) =>
        captureStep(ctx, {
          seq: seq + 3,
          id: 'detail-processing',
          task: 'T5',
          label: '상세 생성 대기',
          action: 'poll',
          suffixIndex: i,
        }),
    });
    steps.push(...res.steps.map((s) => ({ ...s, progress: res.progress })));
    gen.status = res.timeout ? 'timeout' : res.ok ? 'done' : (res.raw?.status ?? 'failed');
    gen.elapsedMs = res.elapsedMs;

    if (res.ok) {
      const full = await apiJson(ctx.page, `${ctx.base}/api/studio/detail/${id}`);
      writeArtifact(ctx, 'detail.json', `${JSON.stringify(full, null, 2)}\n`);
      const checks = full.gateResult?.checks ?? [];
      const namesOf = (key) => {
        const note = checks.find((c) => c.key === key)?.note;
        return note
          ? note
              .split(' — ')[0]
              .split(/[·,]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      };
      const degradedNames = namesOf('degradedBlocks');
      gen.blocks = (full.blocks ?? []).length;
      gen.degradedCuts = degradedNames.length;
      gen.degradedNames = degradedNames;
      gen.droppedBlocks = namesOf('droppedBlocks');
      gen.aiCuts = (full.blocks ?? []).filter(
        (b) => b.renderKind !== 'text' && b.status === 'done' && !degradedNames.includes(b.nameKo),
      ).length;
      gen.gatePassed = full.gateResult?.passed ?? null;
      applyImageUsage(gen, full.imageUsage);
      steps.push(
        await captureStep(ctx, {
          seq: seq + 4,
          id: 'detail-done',
          task: 'T5',
          label: '상세 결과(결합본·분할본)',
          tiles: true,
        }),
      );
      if (full.imageUrl)
        gen.artifact = await downloadArtifact(ctx, {
          url: full.imageUrl,
          outFile: 'detail-master.jpg',
          expect: 'jpeg',
        });
      if (gen.artifact) gen.artifacts.push(gen.artifact);
      const slices = full.sliceUrls ?? [];
      for (let i = 0; i < slices.length; i += 1) {
        gen.artifacts.push(
          await downloadArtifact(ctx, {
            url: slices[i],
            outFile: `detail-slice-${String(i + 1).padStart(2, '0')}.jpg`,
            expect: 'jpeg',
          }),
        );
      }
    }
    return { steps, outcome: res.ok ? '완료' : '부분완료', generation: { kind: 'detail', data: gen } };
  } catch (err) {
    return {
      steps,
      outcome: steps.length ? '부분완료' : '실패',
      error: String(err?.message ?? err),
      generation: { kind: 'detail', data: gen },
    };
  }
}

// ── T6 운영 3화면 (열람만) ──────────────────────────────────────────────────
export const T6 = {
  id: 'T6',
  needsSession: true,
  budgetMs: 300_000,
  async run(ctx) {
    const seq = SEQ_BASE.T6;
    const steps = [];
    const targets = [
      ['library-report', '/app/library?tab=report', '라이브러리 · 리포트'],
      ['library-thumbnail', '/app/library?tab=thumbnail', '라이브러리 · 썸네일'],
      ['library-detail', '/app/library?tab=detail', '라이브러리 · 상세페이지'],
    ];
    for (let i = 0; i < targets.length; i += 1) {
      const [id, url, label] = targets[i];
      try {
        await ctx.goto(url);
        steps.push(await captureStep(ctx, { seq: seq + i, id, task: 'T6', label, tiles: true }));
      } catch (err) {
        steps.push({
          seq: seq + i,
          id,
          task: 'T6',
          label,
          error: String(err?.message ?? err),
          elapsedMs: 0,
          consoleErrors: [],
          failedRequests: [],
        });
      }
    }
    const assetId = ctx.manifest.generations?.thumbnail?.id ?? ctx.manifest.generations?.detail?.id ?? null;
    const rest = [
      ['library-asset', assetId ? `/app/library/${assetId}` : '/app/library', '자산 상세'],
      ['season', '/app/season', '시즌 캘린더'],
      ['matching', '/app/matching', '기업 매칭(열람만)'],
    ];
    for (let i = 0; i < rest.length; i += 1) {
      const [id, url, label] = rest[i];
      try {
        await ctx.goto(url);
        steps.push(await captureStep(ctx, { seq: seq + 3 + i, id, task: 'T6', label, tiles: true }));
      } catch (err) {
        steps.push({
          seq: seq + 3 + i,
          id,
          task: 'T6',
          label,
          error: String(err?.message ?? err),
          elapsedMs: 0,
          consoleErrors: [],
          failedRequests: [],
        });
      }
    }
    const bad = steps.filter((s) => s.error).length;
    return { steps, outcome: bad === 0 ? '완료' : bad < steps.length ? '부분완료' : '실패' };
  },
};

// ── T7 마이페이지 ───────────────────────────────────────────────────────────
export const T7 = {
  id: 'T7',
  needsSession: true,
  budgetMs: 240_000,
  async run(ctx) {
    const steps = [];
    try {
      await ctx.goto('/app/account');
      steps.push(
        await captureStep(ctx, { seq: SEQ_BASE.T7, id: 'account', task: 'T7', label: '마이페이지', tiles: true }),
      );
      return { steps, outcome: steps[0].error ? '실패' : '완료' };
    } catch (err) {
      return { steps, outcome: '실패', error: String(err?.message ?? err) };
    }
  },
};

export const TASKS = { T0, T1, T2, T3, T4, T5, T6, T7 };
