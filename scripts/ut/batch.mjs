/**
 * 트랙 A 배치 러너 — §4-4 동시 실행 정책을 코드로 강제한다.
 *
 * 왜 페르소나별이 아니라 **과업 단계별**로 도는가: 한 프로세스가 T0~T7 을 통으로 돌면 T5 가 서로
 * 겹친다. 상세 잡 하나가 이미지 6장을 동시성 6으로 굽기 때문에, 두 건이 겹치면 429 위험이 오르고
 * 무엇보다 budget.ts 가 남은 시간을 재서 배경컷을 텍스트로 강등한다. 즉 동시 실행이 **평가 대상인
 * 산출물의 품질을 조용히 떨어뜨린다.** 그래서 단계마다 동시성을 따로 건다.
 *
 * 실행:
 *   node scripts/ut/batch.mjs --phase 1              # T0,T1,T2 · 동시 4
 *   node scripts/ut/batch.mjs --phase 3 --from P06   # T5 · 순차, P06부터
 *   node scripts/ut/batch.mjs --phase 2 --only P03,P05
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, runPaths } from './lib/paths.mjs';

const PHASES = {
  1: { tasks: 'T0,T1,T2', concurrency: 4, label: '랜딩·로그인·브랜드 등록 (생성 호출 없음)' },
  // T3 복귀(2026-08-22) — 예산 가드 배포(c1f3d30)로 발행이 회복됐다. 콜 10개짜리라 동시 2를 지킨다
  2: { tasks: 'T3,T4', concurrency: 2, label: '진단 리포트 · 썸네일' },
  '2r': { tasks: 'T3', concurrency: 2, label: '진단 리포트만 (재실행)' },
  3: { tasks: 'T5', concurrency: 1, label: '상세페이지 — 순차 (동시 실행 시 배경컷이 강등된다)' },
  4: { tasks: 'T6,T7', concurrency: 4, label: '운영 화면·마이페이지' },
};

const log = (m) => process.stdout.write(`${m}\n`);
const warn = (m) => process.stderr.write(`${m}\n`);
const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? (process.argv[i + 1] ?? d) : d;
};

/** capture.mjs 한 번. 출력은 삼키고 요약만 돌려준다 — 4개가 동시에 떠들면 읽을 수 없다 */
function runOne(personaId, tasks, base) {
  return new Promise((resolve) => {
    const args = ['scripts/ut/capture.mjs', '--persona', personaId, '--tasks', tasks, '--base', base];
    const child = spawn(process.execPath, args, { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (b) => {
      out += b.toString();
    });
    child.stderr.on('data', (b) => {
      out += b.toString();
    });
    child.on('close', (code) => resolve({ personaId, code, out }));
  });
}

/** 동시성 n 으로 큐를 흘린다 */
async function pool(items, n, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

/** 그 페르소나의 현재 상태를 manifest 에서 한 줄로 읽는다 */
function summarize(personaId) {
  const p = runPaths(personaId);
  if (!existsSync(p.manifest)) return '(manifest 없음)';
  const m = JSON.parse(readFileSync(p.manifest, 'utf8'));
  const tasks = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    .map((t) => `${t}:${(m.outcome[t] ?? '-').slice(0, 2)}`)
    .join(' ');
  const g = m.generations ?? {};
  const d = g.detail;
  const degraded = d?.degradedCuts ? ` ⚠강등 ${d.degradedCuts}컷` : '';
  return `${tasks} | rep=${g.report?.status ?? '-'} thu=${g.thumbnail?.status ?? '-'} det=${d?.status ?? '-'}${degraded} | $${m.imageCost?.usd ?? '계기없음'}`;
}

async function main() {
  const phaseArg = arg('phase');
  const phase = PHASES[phaseArg] ? phaseArg : Number(phaseArg);
  if (!PHASES[phase]) throw new Error('--phase 1|2|2r|3|4 가 필요합니다.');
  const base = arg('base', process.env.UT_BASE_URL ?? 'https://branch-out-to-japan.vercel.app').replace(/\/$/, '');
  const registry = JSON.parse(readFileSync(path.join(ROOT, '.ut/accounts.json'), 'utf8'));

  let ids = registry.accounts.map((a) => a.personaId);
  const only = arg('only');
  if (only) ids = only.split(',').map((s) => s.trim());
  const from = arg('from');
  if (from) ids = ids.slice(ids.indexOf(from) >= 0 ? ids.indexOf(from) : 0);

  const { tasks, concurrency, label } = PHASES[phase];
  log(`■ 단계 ${phase} — ${label}`);
  log(`  과업 ${tasks} · 동시 ${concurrency} · 대상 ${ids.length}명 (${ids[0]}~${ids[ids.length - 1]})`);
  log('');

  const started = Date.now();
  let done = 0;
  const results = await pool(ids, concurrency, async (pid) => {
    const r = await runOne(pid, tasks, base);
    done += 1;
    const mark = r.code === 0 ? '✔' : '✘';
    log(`  ${mark} [${String(done).padStart(2)}/${ids.length}] ${pid}  ${summarize(pid)}`);
    if (r.code !== 0) {
      for (const line of r.out
        .split('\n')
        .filter((l) => /✘|✖|⚠/.test(l))
        .slice(0, 3))
        warn(`        ${line.trim()}`);
    }
    return r;
  });

  log('');
  log(
    `단계 ${phase} 완료 — ${Math.round((Date.now() - started) / 60_000)}분 · 실패 ${results.filter((r) => r.code !== 0).length}건`,
  );
}

main().catch((err) => {
  warn(`\n✖ ${err?.message ?? err}`);
  process.exit(1);
});
