/**
 * 발표 덱용 수치 추출 — CSV·manifest 에서만 읽는다.
 *
 * 덱에 숫자를 손으로 옮겨 적지 않기 위한 스크립트다. 사람이 표를 보고 HTML 에 타이핑하면
 * 반드시 어긋난다(1차 덱에서 평균 만족도를 3.56 으로 잘못 적은 전례가 있다).
 * 여기서 뽑은 값을 그대로 붙인다.
 *
 * 실행: node scripts/ut/deck-data.mjs [--json]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';

const R = path.join(ROOT, 'docs/research/ut-agent/results');
const out = (m) => process.stdout.write(`${m}\n`);

/** 아주 단순한 CSV 파서 — 이 파일들은 따옴표 안에 줄바꿈이 없다 */
function readCsv(name) {
  const raw = readFileSync(path.join(R, name), 'utf8').trim();
  const [head, ...lines] = raw.split('\n');
  const cols = splitRow(head);
  return lines.map((l) => Object.fromEntries(splitRow(l).map((v, i) => [cols[i], v])));
}
function splitRow(line) {
  const cells = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null;
};
const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);
const col = (rows, k) => rows.map((r) => num(r[k])).filter((n) => n !== null);
const count = (rows, k) =>
  rows.reduce((m, r) => {
    const v = (r[k] ?? '').trim();
    if (v) m[v] = (m[v] ?? 0) + 1;
    return m;
  }, {});

const persona = readCsv('scores-persona.csv');
const landing = readCsv('랜딩평가.csv');
const task = readCsv('scores-task.csv');
const gen = readCsv('생성결과.csv');

/** manifest 에서 리포트 생성 실측을 모은다 — CSV 의 elapsed_sec 은 초 단위로 반올림돼 있다 */
function reportRuns() {
  const runs = [];
  const dir = path.join(ROOT, '.ut/runs');
  for (const d of readdirSync(dir)
    .filter((x) => /^P\d\d$/.test(x))
    .sort()) {
    const f = path.join(dir, d, 'manifest.json');
    if (!existsSync(f)) continue;
    const g = JSON.parse(readFileSync(f, 'utf8'))?.generations?.report;
    if (!g) continue;
    const blocks = path.join(dir, d, 'artifacts/report-blocks.json');
    const meta = existsSync(blocks) ? (JSON.parse(readFileSync(blocks, 'utf8'))?.meta ?? {}) : {};
    runs.push({
      pid: d,
      status: g.status,
      mode: g.mode,
      sec: g.elapsedMs != null ? Math.round(g.elapsedMs / 1000) : null,
      score: g.overallScore ?? null,
      precisionLimited: g.precisionLimited ?? null,
      slides: Boolean(g.slidesFetchedAt),
      humanizeSkipped: meta.humanizeSkipped ?? null,
      attachRerun: g.elapsedFrom != null,
    });
  }
  return runs;
}

const runs = reportRuns();
/** attach 재실행 건은 실측 시간이 아니다 — 시간 통계에서만 뺀다 */
const timed = runs.filter((r) => r.sec != null && !r.attachRerun);
const bp = timed
  .filter((r) => r.mode === 'brandProduct')
  .map((r) => r.sec)
  .sort((a, b) => a - b);
const br = timed
  .filter((r) => r.mode === 'brand')
  .map((r) => r.sec)
  .sort((a, b) => a - b);
const med = (xs) => (xs.length ? xs[Math.floor(xs.length / 2)] : null);

const withReport = persona.filter((r) => num(r.rep_acc) !== null);
const TASKS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const data = {
  n: { persona: persona.length, withReport: withReport.length, landing: landing.length },
  landing: {
    appeal: avg(col(landing, 'appeal')),
    interest: avg(col(landing, 'interest')),
    intent: avg(col(landing, 'intent')),
    dist: {
      appeal: tally(col(landing, 'appeal')),
      interest: tally(col(landing, 'interest')),
      intent: tally(col(landing, 'intent')),
    },
  },
  taskSat: Object.fromEntries(
    TASKS.map((t) => {
      const rows = task.filter((r) => r.task_id === t);
      return [
        t,
        {
          avg: avg(col(rows, 'satisfaction')),
          n: col(rows, 'satisfaction').length,
          dropoff: count(rows, 'dropoff_step'),
        },
      ];
    }),
  ),
  axes: {
    report: axis('rep'),
    thumbnail: axis('thu'),
    detail: axis('det'),
  },
  bestAsset: count(persona, 'best_asset'),
  wtp: {
    yes: persona.filter((r) => r.wtp === 'Y').length,
    total: persona.length,
    amounts: tally(col(persona, 'wtp_krw')),
    nps: { avg: avg(col(persona, 'nps')), dist: tally(col(persona, 'nps')) },
    revisit: persona.filter((r) => r.revisit === 'Y').length,
  },
  loop: {
    felt: count(withReport, 'loop_felt'),
    oneService: count(withReport, 'loop_one_service'),
    actOnIt: count(withReport, 'rep_act_on_it'),
    newInsight: count(withReport, 'rep_new_insight'),
    slidesReceived: count(withReport, 'slides_received'),
    slidesUsable: count(withReport, 'slides_usable'),
  },
  blocks: blockHeatmap(),
  generation: {
    byKind: Object.fromEntries(
      ['report', 'thumbnail', 'detail'].map((k) => {
        const rows = gen.filter((r) => r.kind === k);
        return [
          k,
          { total: rows.length, ok: rows.filter((r) => r.status === 'done' || r.status === 'published').length },
        ];
      }),
    ),
    reportSec: {
      brandProduct: { n: bp.length, min: bp[0] ?? null, med: med(bp), max: bp[bp.length - 1] ?? null },
      brand: { n: br.length, min: br[0] ?? null, med: med(br), max: br[br.length - 1] ?? null },
      budget: 270,
    },
    humanizeSkipped: runs.filter((r) => r.humanizeSkipped === true).length,
    precisionLimited: runs.filter((r) => r.precisionLimited === true).map((r) => r.pid),
    modes: count(
      runs.map((r) => ({ m: r.mode })),
      'm',
    ),
    slides: runs.filter((r) => r.slides).length,
    scores: runs
      .filter((r) => r.score != null)
      .map((r) => r.score)
      .sort((a, b) => a - b),
  },
  invalid: persona.filter((r) => (r.invalid_flags ?? '').trim()).length,
};

/** 4축 평균 */
function axis(prefix) {
  return {
    acc: avg(col(persona, `${prefix}_acc`)),
    act: avg(col(persona, `${prefix}_act`)),
    dif: avg(col(persona, `${prefix}_dif`)),
    tru: avg(col(persona, `${prefix}_tru`)),
    n: col(persona, `${prefix}_acc`).length,
  };
}
/** 값 → 개수 */
function tally(xs) {
  const m = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => Number(a[0]) - Number(b[0])));
}
/**
 * 블록 히트맵 — 응답의 rep_blocks_read / rep_blocks_skipped 를 블록 번호로 정규화한다.
 * 페르소나가 "블록5 A~E 루브릭" 처럼 이름을 붙여 적으므로 번호만 뽑는다.
 */
function blockHeatmap() {
  const read = {};
  const skip = {};
  for (const r of withReport) {
    for (const [key, bag] of [
      ['rep_blocks_read', read],
      ['rep_blocks_skipped', skip],
    ]) {
      const seen = new Set();
      for (const m of String(r[key] ?? '').matchAll(/블록\s*(\d)/g)) seen.add(m[1]);
      for (const b of seen) bag[b] = (bag[b] ?? 0) + 1;
    }
  }
  return { read, skip, n: withReport.length };
}

if (process.argv.includes('--json')) {
  out(JSON.stringify(data, null, 2));
  process.exit(0);
}

out(`■ 표본  페르소나 ${data.n.persona} · 리포트 평가 ${data.n.withReport} · 무효 ${data.invalid}`);
out('');
out(`■ 랜딩  매력 ${data.landing.appeal} · 흥미 ${data.landing.interest} · 의향 ${data.landing.intent}`);
out('');
out('■ 과업 만족도');
for (const t of TASKS) {
  const s = data.taskSat[t];
  if (s.n) out(`   ${t}  ${s.avg}  (n=${s.n})`);
}
out('');
out('■ 산출물 4축');
for (const [k, v] of Object.entries(data.axes)) {
  if (v.n) out(`   ${k.padEnd(10)} 정확 ${v.acc} · 실행 ${v.act} · 차별 ${v.dif} · 신뢰 ${v.tru}  (n=${v.n})`);
}
out(`   best_asset ${JSON.stringify(data.bestAsset)}`);
out('');
out(
  `■ 지불  WTP ${data.wtp.yes}/${data.wtp.total} · 금액 ${JSON.stringify(data.wtp.amounts)} · NPS ${data.wtp.nps.avg} ${JSON.stringify(data.wtp.nps.dist)}`,
);
out('');
out('■ 폐루프');
for (const [k, v] of Object.entries(data.loop)) out(`   ${k.padEnd(16)} ${JSON.stringify(v)}`);
out('');
out('■ 블록 히트맵 (읽음 / 스킵)');
for (let i = 0; i <= 9; i += 1) {
  const r = data.blocks.read[i] ?? 0;
  const s = data.blocks.skip[i] ?? 0;
  if (r || s) out(`   블록${i}  읽음 ${String(r).padStart(2)}  스킵 ${String(s).padStart(2)}   (n=${data.blocks.n})`);
}
out('');
out('■ 생성');
for (const [k, v] of Object.entries(data.generation.byKind)) out(`   ${k.padEnd(10)} ${v.ok}/${v.total}`);
const g = data.generation;
out(
  `   리포트 소요 brandProduct ${g.reportSec.brandProduct.min}~${g.reportSec.brandProduct.max}초 (중앙 ${g.reportSec.brandProduct.med}, n=${g.reportSec.brandProduct.n}) · brand ${g.reportSec.brand.min}~${g.reportSec.brand.max}초 (n=${g.reportSec.brand.n}) · 예산 ${g.reportSec.budget}초`,
);
out(`   humanizeSkipped ${g.humanizeSkipped} · 슬라이드 ${g.slides} · 모드 ${JSON.stringify(g.modes)}`);
out(`   정밀도 제한 ${g.precisionLimited.join(',') || '없음'}`);
out(`   종합점수 분포 ${JSON.stringify(g.scores)}`);
