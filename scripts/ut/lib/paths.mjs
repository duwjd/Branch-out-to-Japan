/** UT 런타임 경로 규약 — 부록A(.ut/runs/{PID}/{screens,artifacts}) 를 한 곳에서 만든다. */

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();

/** @returns {{ run: string, screens: string, artifacts: string, manifest: string, state: string, lock: string }} */
export function runPaths(personaId, outBase = '.ut/runs') {
  const run = path.join(ROOT, outBase, personaId);
  return {
    run,
    screens: path.join(run, 'screens'),
    artifacts: path.join(run, 'artifacts'),
    manifest: path.join(run, 'manifest.json'),
    state: path.join(run, 'state.json'),
    lock: path.join(run, '.lock'),
  };
}

export function ensureRunDirs(p) {
  for (const dir of [p.run, p.screens, p.artifacts]) if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export const pad2 = (n) => String(n).padStart(2, '0');

/** 스텝 내 반복 캡처의 접미사 — 0 은 접미사 없음, 1='a', 2='b' … 정수 seq 를 잡아먹지 않는다 */
export const suffixOf = (i) => (i <= 0 ? '' : String.fromCharCode(96 + i));

export const screenName = (seq, id, i = 0, ext = 'png') => `${pad2(seq)}${suffixOf(i)}-${id}.${ext}`;
