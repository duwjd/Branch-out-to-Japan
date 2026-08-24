/**
 * API 조회·폴링·산출물 내려받기.
 *
 * 폴링은 `page.request`(APIRequestContext)로 한다 — 페이지 fetch 로 돌리면 일시적 5xx 가 전부
 * step.failedRequests 에 섞여 "관찰된 실패"처럼 보인다. 드라이버가 만든 트래픽과 화면이 만든
 * 트래픽을 섞지 않는 게 기록의 정직함을 지킨다.
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';

export async function apiJson(page, url) {
  const res = await page.request.get(url, { timeout: 60_000 });
  if (!res.ok()) throw new Error(`GET ${url} → ${res.status()}`);
  return res.json();
}

/**
 * 생성 대기 폴링 + 주기적 화면 캡처.
 * @param {object} ctx
 * @param {{ probe: () => Promise<{terminal:boolean, ok:boolean, status:string, progress:string|null, raw:any}>,
 *           shoot: (i:number) => Promise<object>, maxMs:number, intervalMs:number, interimMs:number }} o
 */
export async function pollWithShots(ctx, o) {
  const started = Date.now();
  const progress = [];
  const steps = [];
  let shots = 0;
  let lastShotAt = Date.now();
  steps.push(await o.shoot(shots));

  let failures = 0;
  let last = null;
  for (;;) {
    if (Date.now() - started > o.maxMs) {
      return {
        timeout: true,
        ok: false,
        status: last?.status ?? 'timeout',
        elapsedMs: Date.now() - started,
        progress,
        steps,
        raw: last?.raw ?? null,
      };
    }
    await ctx.page.waitForTimeout(o.intervalMs);
    try {
      last = await o.probe();
      failures = 0;
    } catch (err) {
      failures += 1;
      if (failures >= 10) {
        return {
          timeout: false,
          ok: false,
          status: 'poll-error',
          error: String(err?.message ?? err),
          elapsedMs: Date.now() - started,
          progress,
          steps,
          raw: null,
        };
      }
      continue;
    }
    if (last.progress && progress[progress.length - 1] !== last.progress) progress.push(last.progress);
    if (Date.now() - lastShotAt >= o.interimMs) {
      shots += 1;
      lastShotAt = Date.now();
      steps.push(await o.shoot(shots));
    }
    if (last.terminal) {
      await ctx.page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      await ctx.page.waitForTimeout(800);
      return {
        timeout: false,
        ok: last.ok,
        status: last.status,
        elapsedMs: Date.now() - started,
        progress,
        steps,
        raw: last.raw,
      };
    }
  }
}

const MAGIC = { png: [0x89, 0x50, 0x4e, 0x47], jpeg: [0xff, 0xd8, 0xff] };

/**
 * 산출물 원본을 artifacts/ 로 내려받는다. `/api/files/{id}` 는 `?download=1` 로 동일 출처 바이트를 받는다
 * (그러지 않으면 Supabase 서명 URL 로 302 되어 만료·CORS 에 걸린다).
 */
export async function downloadArtifact(ctx, { url, outFile, expect }) {
  // page.request 는 baseURL 을 모른다 — 상대 경로를 그대로 넘기면 Invalid URL 로 죽는다
  const withDownload = url.startsWith('/api/files/') ? `${url}${url.includes('?') ? '&' : '?'}download=1` : url;
  const full = withDownload.startsWith('http') ? withDownload : `${ctx.base}${withDownload}`;
  const res = await ctx.page.request.get(full, { timeout: 120_000 });
  if (!res.ok()) throw new Error(`다운로드 실패 ${full} → ${res.status()}`);
  const buf = Buffer.from(await res.body());
  if (expect && MAGIC[expect] && !MAGIC[expect].every((b, i) => buf[i] === b)) {
    throw new Error(`${outFile}: ${expect} 매직바이트 불일치 — 응답이 파일이 아니다`);
  }
  writeFileSync(path.join(ctx.paths.artifacts, outFile), buf);
  return `artifacts/${outFile}`;
}

export function writeArtifact(ctx, outFile, content) {
  writeFileSync(path.join(ctx.paths.artifacts, outFile), content);
  return `artifacts/${outFile}`;
}
