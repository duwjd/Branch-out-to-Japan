/**
 * 페르소나에게 넘길 **파일 목록** 생성.
 *
 * 왜 필요한가: 페르소나 에이전트는 도구가 `Read` 하나뿐이라 디렉터리를 나열할 수 없다.
 * "screens/ 를 전부 읽어라"라고만 하면 파일명을 추측하다 실패하고, 최악의 경우
 * "화면이 백지였다"고 반응해 버린다 — 자극물이 아니라 도구 한계를 평가하게 된다.
 * 그래서 실제 파일명을 프롬프트에 그대로 박아 넣는다.
 */

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** 사람이 읽는 순서대로 — 숫자 접두사 오름차순, 같은 번호면 접미사 순 */
function sortScreens(files) {
  const key = (f) => {
    const m = /^(\d+)([a-z]*)-/.exec(f);
    return m ? [Number(m[1]), m[2] || ''] : [Number.MAX_SAFE_INTEGER, f];
  };
  return [...files].sort((a, b) => {
    const [na, sa] = key(a);
    const [nb, sb] = key(b);
    return na - nb || String(sa).localeCompare(String(sb)) || a.localeCompare(b);
  });
}

/**
 * 한 폴더의 파일 목록을 프롬프트용 줄들로 만든다.
 * @param {string} dir 절대 경로
 * @param {string} prefix 프롬프트에 쓸 상대 경로 접두사
 * @param {(f: string) => boolean} keep
 */
export function listForPrompt(dir, prefix, keep = () => true) {
  if (!existsSync(dir)) return [];
  return sortScreens(readdirSync(dir).filter(keep)).map((f) => `  ${prefix}${f}`);
}

/** 트랙 A 한 페르소나의 화면·산출물 목록 */
export function personaFileList(runDir) {
  const screens = listForPrompt(path.join(runDir, 'screens'), 'screens/', (f) => /\.(png|txt)$/.test(f));
  const artifacts = listForPrompt(path.join(runDir, 'artifacts'), 'artifacts/', (f) =>
    /\.(png|jpg|jpeg|html|txt)$/.test(f),
  );
  return { screens, artifacts };
}

/** 트랙 B 한 턴의 화면 목록 */
export function turnFileList(runDir, turn) {
  const dir = path.join(runDir, 'turns', String(turn).padStart(2, '0'));
  return listForPrompt(dir, '', (f) => /\.(png|txt)$/.test(f));
}

/**
 * 트랙 A — manifest 기준 **큐레이션** 목록.
 *
 * 전부 주면 100장이 넘어 페르소나 컨텍스트를 넘긴다. 그렇다고 임의로 자르면 관찰 대상이 빠진다.
 * 그래서 규칙을 둔다:
 *  - T0 랜딩은 **타일 전부** — 스크롤 구간마다 다른 섹션이고, 그게 T0 의 자극물 자체다.
 *  - 나머지 스텝은 **대표 1장**. 폴링처럼 여러 장인 스텝은 처음과 마지막 2장(대기 시작·끝).
 *  - `.txt` 는 전부 — 싸고, 인용의 정답지다.
 * @param {string} runDir
 * @param {object} manifest
 */
export function curatedFileList(runDir, manifest, opts = {}) {
  const pngs = [];
  const txts = [];
  const onlyTasks = opts.tasks ?? null;
  for (const step of [...(manifest.steps ?? [])].sort((a, b) => a.seq - b.seq)) {
    if (onlyTasks && !onlyTasks.includes(step.task)) continue;
    const shots = step.pngs ?? (step.png ? [step.png] : []);
    if (step.task === 'T0') pngs.push(...shots);
    else if (shots.length <= 2) pngs.push(...shots);
    else pngs.push(shots[0], shots[shots.length - 1]);
    if (step.txt) txts.push(step.txt);
  }
  const artifactFilter = opts.artifactFilter ?? ((f) => /\.(png|jpg|jpeg|html)$/.test(f) && !f.endsWith('.json'));
  const artifacts = listForPrompt(path.join(runDir, 'artifacts'), 'artifacts/', artifactFilter);
  const seen = new Set();
  const screens = [...pngs, ...txts].filter((f) => f && !seen.has(f) && seen.add(f));
  return { screens: sortScreens(screens).map((f) => `  ${f}`), artifacts };
}
