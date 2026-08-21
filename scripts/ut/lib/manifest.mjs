/**
 * manifest.json 병합·저장 — 01-산출물-형식.md §1 스키마를 그대로 따른다.
 *
 * 왜 병합인가: §4-4 동시 실행 정책이 과업 티어마다 동시성을 다르게 요구해서(T0~T2 4명 / T3·T4 2명
 * / T5 순차), 한 페르소나를 여러 번에 나눠 실행해야 한다. 그때마다 manifest 를 새로 쓰면 앞 단계
 * 기록이 날아간다. 그래서 **과업 단위 교체 병합**을 한다 — 같은 task 의 기존 steps 를 걷어내고
 * 새 steps 를 붙인다(둘 다 남기면 페르소나가 같은 화면을 두 번 보게 된다).
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

/** 과업별 seq 베이스 — 전역 카운터를 쓰면 재실행 때 파일명이 통째로 밀린다 */
export const SEQ_BASE = { T0: 0, T1: 1, T2: 3, T3: 6, T4: 12, T5: 17, T6: 24, T7: 30 };

export function loadManifest(p, seed) {
  if (existsSync(p.manifest)) {
    try {
      return JSON.parse(readFileSync(p.manifest, 'utf8'));
    } catch {
      /* 깨진 파일은 새로 시작한다 — 백업은 남기지 않는다(런타임 산출물이라 재생성 가능) */
    }
  }
  return {
    personaId: seed.personaId,
    account: seed.account,
    brand: seed.brand,
    track: 'A',
    env: {},
    startedAt: seed.startedAt,
    steps: [],
    generations: {},
    imageCost: { calls: null, usd: null, instrument: 'none' },
    outcome: {},
    runs: [],
    totalElapsedMs: 0,
  };
}

/** 원자적 저장 — 중간에 죽어도 반쯤 쓰인 JSON 이 남지 않는다 */
export function saveManifest(p, m) {
  const tmp = `${p.manifest}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(m, null, 2)}\n`);
  renameSync(tmp, p.manifest);
}

/**
 * 한 과업의 결과를 manifest 에 접어 넣는다.
 * @param {object} m
 * @param {string} task 'T0'…'T7'
 * @param {{ steps: object[], outcome: string, generation?: {kind: string, data: object}, error?: string|null }} result
 */
export function mergeTask(m, task, result) {
  m.steps = m.steps.filter((s) => s.task !== task).concat(result.steps);
  m.steps.sort((a, b) => a.seq - b.seq || String(a.png ?? '').localeCompare(String(b.png ?? '')));
  m.outcome[task] = result.outcome;
  if (result.generation) mergeGeneration(m, result.generation.kind, result.generation.data);
  recomputeImageCost(m);
}

/**
 * 생성 결과 병합 — 이미 터미널 성공한 기록을 비터미널 재실행이 덮지 못하게 막는다.
 * 재실행 횟수는 `attempts` 로 남는다(생성결과.csv 의 retry = attempts - 1).
 */
export function mergeGeneration(m, kind, next) {
  const prev = m.generations[kind];
  const prevOk = prev && (prev.status === 'published' || prev.status === 'done');
  const nextTerminal = ['published', 'done', 'failed'].includes(next.status);
  if (prevOk && !nextTerminal) {
    prev.reruns = (prev.reruns ?? 0) + 1;
    prev.lastRerunNote = `재실행이 터미널에 도달하지 못함(${next.status}) — 기존 결과를 보존했다`;
    return;
  }
  m.generations[kind] = { ...next, attempts: (prev?.attempts ?? 0) + 1 };
}

/**
 * 이미지 비용은 **누산이 아니라 부분에서 재계산**한다 — 재실행해도 중복 합산되지 않는다.
 * 계기(앱의 imageUsage)가 없으면 usd 를 null 로 두고 그 사실을 명시한다. 추정치로 채우지 않는다.
 */
export function recomputeImageCost(m) {
  const kinds = ['report', 'thumbnail', 'detail'];
  const all = kinds.flatMap((k) => m.generations[k]?.images ?? []);
  const generated = kinds.filter((k) => m.generations[k]).map((k) => m.generations[k]);
  const anyInstrumented = generated.some((g) => g.imagesInstrumented);
  if (!anyInstrumented || all.length === 0) {
    m.imageCost = {
      calls: null,
      usd: null,
      instrument: 'none',
      note: '계기 없음 — 앱 응답에 imageUsage 가 없다. 추정치를 넣지 않는다(01-산출물-형식.md §1).',
    };
    return;
  }
  const complete = all.every((i) => typeof i.usd === 'number');
  m.imageCost = {
    calls: all.length,
    usd: complete ? Number(all.reduce((s, i) => s + i.usd, 0).toFixed(6)) : null,
    instrument: 'app',
  };
}

/** 실행 1회분 메타 — 어느 단계가 어떤 스텝을 만들었는지 나중에 되짚기 위한 기록 */
export function beginRun(m, info) {
  const run = { runId: `r${m.runs.length + 1}`, ...info, finishedAt: null, elapsedMs: 0 };
  m.runs.push(run);
  return run;
}

export function finishRun(m, run, startedMs) {
  run.finishedAt = new Date().toISOString();
  run.elapsedMs = Date.now() - startedMs;
  m.totalElapsedMs = m.runs.reduce((s, r) => s + (r.elapsedMs ?? 0), 0);
}
