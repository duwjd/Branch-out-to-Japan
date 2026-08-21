/**
 * UT 집계 — manifest 에서 기계적으로 뽑히는 것만 만든다(01-산출물-형식.md §3).
 *
 * 여기서 만드는 것은 **페르소나 응답이 아니라 실측**이다: 생성 60건의 성공/실패와 이미지 콜 원장.
 * 점수·인용이 들어가는 CSV(scores-task·scores-persona·랜딩평가)는 사람이 응답을 읽고 채운다 —
 * 모델 응답을 기계로 파싱해 점수를 만들면 오독이 조용히 숫자가 되어 리포트로 흘러간다.
 *
 * 실행: node scripts/ut/aggregate.mjs [--out docs/research/ut-agent/results]
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { num, parseScores, validityFlags } from './lib/scores.mjs';

const log = (m) => process.stdout.write(`${m}\n`);

/** §2 아키타입·교차 렌즈 — 집계 컬럼의 정본 */
const ARCHETYPE = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    return [`P${String(n).padStart(2, '0')}`, n <= 8 ? 'A' : n <= 14 ? 'B' : n <= 18 ? 'C' : 'D'];
  }),
);
const LENS = {
  P05: ['ai_resist'], P13: ['ai_resist'], P19: ['ai_resist', 'no_jp'], P20: ['ai_resist', 'no_jp'],
  P08: ['approval'], P10: ['approval'], P14: ['approval'], P15: ['approval'],
  P17: ['approval', 'no_jp'], P12: ['no_jp'],
};

/** 에러 원문은 여러 줄짜리 Playwright 콜로그다 — CSV 에는 첫 줄만, 200자까지 */
const oneLine = (v) => (v ? String(v).split('\n')[0].trim().slice(0, 200) : '');

/** T0 는 만족도 대신 매력도를 쓴다 — 랜딩엔 성공 조건이 없어 "만족"을 물을 대상이 아니다 */
const t0Sat = (sc) => num(sc.landing_appeal);

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) => [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n') + '\n';

function loadManifests(runsDir) {
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .filter((d) => /^P\d{2}$/.test(d))
    .sort()
    .map((d) => path.join(runsDir, d, 'manifest.json'))
    .filter(existsSync)
    .map((p) => JSON.parse(readFileSync(p, 'utf8')));
}

function main() {
  const outIdx = process.argv.indexOf('--out');
  // resolve 여야 절대경로 --out 이 ROOT 밑으로 딸려 들어가지 않는다
  const outDir = path.resolve(ROOT, outIdx > -1 ? process.argv[outIdx + 1] : 'docs/research/ut-agent/results');
  const manifests = loadManifests(path.join(ROOT, '.ut/runs'));
  if (manifests.length === 0) throw new Error('.ut/runs/P** 에 manifest 가 없습니다.');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // ── 생성결과.csv — 페르소나 × 3종. 제품 안정성 데이터다
  const genRows = [];
  for (const m of manifests) {
    for (const kind of ['report', 'thumbnail', 'detail']) {
      const g = m.generations?.[kind];
      genRows.push([
        m.personaId,
        kind,
        g?.status ?? '미실행',
        kind === 'report' ? (g?.mode ?? '') : kind === 'thumbnail' ? (g?.styleId ?? '') : (g?.templateId ?? ''),
        g?.elapsedMs != null ? Math.round(g.elapsedMs / 1000) : '',
        kind === 'detail' ? (g?.aiCuts ?? '') : '',
        kind === 'detail' ? (g?.degradedCuts ?? '') : '',
        g?.attempts != null ? g.attempts - 1 : '',
        oneLine(m.outcome?.[`${kind === 'report' ? 'T3' : kind === 'thumbnail' ? 'T4' : 'T5'}_error`]),
      ]);
    }
  }
  writeFileSync(
    path.join(outDir, '생성결과.csv'),
    toCsv(['persona_id', 'kind', 'status', 'variant', 'elapsed_sec', 'ai_cuts', 'degraded_cuts', 'retry', 'error'], genRows),
  );

  // ── 비용측정.csv — 계기가 있을 때만 만든다. 없으면 만들지 않는 게 계약이다(§3)
  const costRows = [];
  for (const m of manifests) {
    for (const kind of ['thumbnail', 'detail']) {
      for (const img of m.generations?.[kind]?.images ?? []) {
        const d = img.usage?.input_tokens_details ?? {};
        costRows.push([
          m.personaId, kind, img.call, img.size, img.quality,
          img.usage?.input_tokens ?? '', d.image_tokens ?? '', d.text_tokens ?? '',
          img.usage?.output_tokens ?? '', img.usd ?? '', img.retry ?? 0,
        ]);
      }
    }
  }
  if (costRows.length > 0) {
    writeFileSync(
      path.join(outDir, '비용측정.csv'),
      toCsv(['persona_id', 'kind', 'call', 'size', 'quality', 'input_tokens', 'image_tokens', 'text_tokens', 'output_tokens', 'usd', 'retry'], costRows),
    );
    log(`  비용측정.csv — ${costRows.length}행`);
  } else {
    log('  비용측정.csv — 만들지 않음 (앱에 이미지 usage 계기가 없다. 추정치를 넣지 않는다)');
  }

  // ── 과업 실측(응답 점수는 사람이 채운다) — 소요·이탈 근거로 쓸 뼈대
  const taskRows = [];
  for (const m of manifests) {
    for (const t of ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']) {
      const steps = (m.steps ?? []).filter((s) => s.task === t);
      const elapsed = steps.reduce((s, x) => s + (x.elapsedMs ?? 0), 0);
      // T3 는 프로그램 차원에서 제외했다(results/P0-리포트-파이프라인-예산초과.md) —
      // "미실행"으로 두면 드라이버가 못 돈 것처럼 읽힌다. 제외는 결정이지 사고가 아니다
      const outcome = t === 'T3' ? '제외' : (m.outcome?.[t] ?? '미실행');
      taskRows.push([
        m.personaId, ARCHETYPE[m.personaId] ?? '', (LENS[m.personaId] ?? ['-']).join(';'), 'A', t,
        outcome, '', '', Math.round(elapsed / 1000),
        t === 'T3' ? '리포트 파이프라인 P0 로 과업 제외' : oneLine(m.outcome?.[`${t}_error`]),
      ]);
    }
  }
  writeFileSync(
    path.join(outDir, 'scores-task.csv'),
    toCsv(['persona_id', 'archetype', 'lens', 'track', 'task_id', 'outcome', 'satisfaction', 'dropoff_step', 'elapsed_sec', 'blocker'], taskRows),
  );

  // ── 응답 기반 CSV — 페르소나가 낸 ```scores 블록만 읽는다(산문에서 숫자를 긁지 않는다)
  const personaRows = [];
  const landingRows = [];
  let missing = 0;
  for (const m of manifests) {
    const rp = path.join(ROOT, '.ut/runs', m.personaId, 'response.md');
    if (!existsSync(rp)) { missing += 1; continue; }
    const md = readFileSync(rp, 'utf8');
    const sc = parseScores(md);
    if (!sc) { missing += 1; continue; }
    // 2차 세션(리포트 전용, 2026-08-22) 응답이 있으면 겹치는 값은 **나중 것으로 덮는다** —
    // 리포트까지 본 뒤의 지불 의향·NPS가 최신 판단이다. 1차만 있는 값(랜딩·T4·T5)은 그대로 남는다.
    const rp2 = path.join(ROOT, '.ut/runs', m.personaId, 'response-report.md');
    const md2 = existsSync(rp2) ? readFileSync(rp2, 'utf8') : '';
    const sc2 = md2 ? (parseScores(md2) ?? {}) : {};
    Object.assign(sc, Object.fromEntries(Object.entries(sc2).filter(([, v]) => String(v ?? '').trim() !== '')));
    const flags = validityFlags(m.personaId, sc, md).join(';');
    const a = ARCHETYPE[m.personaId] ?? '';
    const l = (LENS[m.personaId] ?? ['-']).join(';');
    personaRows.push([
      m.personaId, a, l,
      num(sc.rep_acc), num(sc.rep_act), num(sc.rep_dif), num(sc.rep_tru),
      num(sc.thu_acc), num(sc.thu_act), num(sc.thu_dif), num(sc.thu_tru),
      num(sc.det_acc), num(sc.det_act), num(sc.det_dif), num(sc.det_tru),
      sc.best_asset_of3 ?? sc.best_asset ?? '', sc.wtp ?? '', num(sc.wtp_krw), num(sc.nps), sc.revisit ?? '',
      sc.rep_act_on_it ?? '', sc.loop_felt ?? '', sc.loop_one_service ?? '',
      sc.slides_received ?? '', sc.slides_usable ?? '', sc.rep_new_insight ?? '', sc.changed_from_before ?? '',
      sc.rep_blocks_read ?? '', sc.rep_blocks_skipped ?? '',
      flags,
    ]);
    landingRows.push([
      m.personaId, a, l, num(sc.landing_appeal), num(sc.landing_interest), num(sc.landing_intent),
      sc.landing_scrolled_to_end ?? '', sc.landing_exit_section ?? '',
      sc.landing_hook_quote ?? '', sc.landing_friction_quote ?? '', flags,
    ]);
    // 과업 만족도·이탈을 scores-task 행에 채운다
    for (const row of taskRows) {
      if (row[0] !== m.personaId) continue;
      const t = row[4];
      if (sc[`sat_${t}`]) row[6] = num(sc[`sat_${t}`]);
      if (sc[`dropoff_${t}`]) row[7] = sc[`dropoff_${t}`];
    }
    if (t0Sat(sc) !== null) {
      const r = taskRows.find((x) => x[0] === m.personaId && x[4] === 'T0');
      if (r) r[6] = t0Sat(sc);
    }
  }
  writeFileSync(
    path.join(outDir, 'scores-persona.csv'),
    toCsv(['persona_id','archetype','lens','rep_acc','rep_act','rep_dif','rep_tru','thu_acc','thu_act','thu_dif','thu_tru','det_acc','det_act','det_dif','det_tru','best_asset','wtp','wtp_krw','nps','revisit','rep_act_on_it','loop_felt','loop_one_service','slides_received','slides_usable','rep_new_insight','changed_from_before','rep_blocks_read','rep_blocks_skipped','invalid_flags'], personaRows),
  );
  writeFileSync(
    path.join(outDir, '랜딩평가.csv'),
    toCsv(['persona_id','archetype','lens','appeal','interest','intent','scrolled_to_end','exit_section','hook_quote','friction_quote','invalid_flags'], landingRows),
  );
  // scores-task 를 만족도까지 채운 뒤 다시 쓴다
  writeFileSync(
    path.join(outDir, 'scores-task.csv'),
    toCsv(['persona_id','archetype','lens','track','task_id','outcome','satisfaction','dropoff_step','elapsed_sec','blocker'], taskRows),
  );

  log(`집계 대상 ${manifests.length}명 → ${path.relative(ROOT, outDir)}`);
  log(`  scores-persona.csv — ${personaRows.length}행 · 랜딩평가.csv — ${landingRows.length}행${missing ? ` (응답 없음 ${missing}명)` : ''}`);
  const invalid = personaRows.filter((r) => r[r.length - 1]).length;   // invalid_flags 는 항상 마지막 열이다
  if (invalid) log(`  ⚠ 타당성 가드에 걸린 행 ${invalid}건 — 평균에서 제외하고 리포트 §14 에 적는다`);
  log(`  생성결과.csv — ${genRows.length}행 (성공 ${genRows.filter((r) => r[2] === 'done' || r[2] === 'published').length})`);
  log(`  scores-task.csv — ${taskRows.length}행 (satisfaction·dropoff_step 은 응답에서 사람이 채운다)`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`\n✖ ${err?.message ?? err}\n`);
  process.exit(1);
}
