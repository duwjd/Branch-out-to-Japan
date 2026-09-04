#!/usr/bin/env node
/**
 * GitHub 이슈 상태 → 스프린트 문서 §작업 보드 상태 열.
 *
 * 이 저장소에서 **정본 문서를 쓰는 유일한 스크립트**다. 그래서 범위를 좁게 잠근다:
 *
 *   - §작업 보드의 `| 태스크 | 상태 | 담당 | 이슈 |` 표만 본다
 *   - 그 표에서도 **2번째 열(상태)만** 바꾼다
 *   - 이슈 열이 `—` 인 행(커밋으로 끝난 것)은 건너뛴다
 *   - §사용자 작업 표는 열 구성이 달라 자동으로 제외된다 (정본은 이슈 #68 체크박스)
 *   - 목표·기간·리스크·일자별 기록·회고는 사람이 쓴 글이므로 손대지 않는다
 *   - 표 구조가 예상과 다르면 **아무것도 쓰지 않고** 실패한다
 *
 *   node scripts/sprint/doc-sync.mjs           대조만 (문서를 쓰지 않는다)
 *   node scripts/sprint/doc-sync.mjs --write   상태 열 갱신
 */
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  ROOT,
  readCache,
  statusOf,
  shortTitle,
  readSprintDoc,
  parseBoardRows,
  splitRow,
  tagsOf,
  EMOJI,
  STATUS_LABEL,
  today,
  hasFlag,
} from './lib.mjs';

const EMOJI_TO_STATUS = Object.fromEntries(Object.entries(EMOJI).map(([k, v]) => [v, k]));

/** 상태 열만 바꾼 새 줄. 나머지 셀과 이스케이프된 파이프는 그대로 복원된다. */
function withStatus(line, emoji) {
  const cells = splitRow(line);
  cells[2] = ` ${emoji} `;
  return cells.join('|');
}

/** 프론트매터 updated 를 오늘로. 실제로 행이 바뀐 경우에만 호출한다. */
function touchUpdated(text) {
  return text.replace(/^(---\n[\s\S]*?\nupdated:).*$/m, `$1 ${today()}`);
}

function main() {
  const write = hasFlag(process.argv.slice(2), '--write');
  const { issues } = readCache();
  const doc = readSprintDoc();

  if (!doc) {
    console.error('docs/sprints/ 에 스프린트 문서가 없습니다.');
    process.exit(1);
  }

  const rows = parseBoardRows(doc.text);
  if (rows.length === 0) {
    console.error(
      `§작업 보드에서 \`| 태스크 | 상태 | 담당 | 이슈 |\` 표를 찾지 못했습니다: ${relative(ROOT, doc.path)}\n` +
        '표 구조가 바뀌었다면 이 스크립트를 먼저 고쳐야 합니다. 문서는 건드리지 않았습니다.',
    );
    process.exit(1);
  }

  const byNumber = new Map(issues.map((i) => [i.number, i]));
  const linkedNumbers = new Set(rows.map((r) => r.issueNumber).filter(Boolean));

  const changes = [];
  const problems = [];
  const lines = doc.text.split('\n');

  for (const row of rows) {
    if (row.issueNumber === null) continue; // 이슈 없이 커밋으로 끝난 행
    const issue = byNumber.get(row.issueNumber);
    if (!issue) {
      problems.push(`#${row.issueNumber} — 문서가 가리키는 이슈가 캐시에 없습니다 (${row.task})`);
      continue;
    }
    if (!(row.status in EMOJI_TO_STATUS)) {
      problems.push(`#${row.issueNumber} — 상태 칸이 이모지 4종이 아닙니다: "${row.status}"`);
      continue;
    }
    const want = statusOf(issue);
    if (EMOJI_TO_STATUS[row.status] === want) continue;
    changes.push({ row, from: row.status, to: EMOJI[want], want, issue });
    lines[row.lineNo] = withStatus(lines[row.lineNo], EMOJI[want]);
  }

  // 문서에 없는 열린 이슈 — 지도에서 빠진 일감이다
  const missing = issues.filter(
    (i) => !linkedNumbers.has(i.number) && statusOf(i) !== 'done' && !tagsOf(i).includes('사용자작업'),
  );

  console.log(`§작업 보드 ↔ GitHub 이슈 대조 — ${relative(ROOT, doc.path)}`);
  console.log(
    `행 ${rows.length}개 (이슈 연결 ${linkedNumbers.size} · 커밋으로 끝난 행 ${rows.length - linkedNumbers.size})\n`,
  );

  if (changes.length === 0) {
    console.log('어긋난 행: 없음');
  } else {
    console.log(`어긋난 행 ${changes.length}건:`);
    for (const c of changes) {
      console.log(`  #${c.issue.number} ${shortTitle(c.issue, 40)}`);
      console.log(`      문서 ${c.from}  →  이슈 ${c.to} ${STATUS_LABEL[c.want]}`);
    }
  }

  if (missing.length) {
    console.log(`\n문서 §작업 보드에 없는 열린 이슈 ${missing.length}건:`);
    for (const issue of missing) console.log(`  #${issue.number} ${shortTitle(issue, 44)}`);
  }
  if (problems.length) {
    console.log(`\n확인이 필요한 행 ${problems.length}건:`);
    for (const p of problems) console.log(`  ${p}`);
  }

  if (!write) {
    if (changes.length) console.log('\n갱신하려면: npm run sprint:doc-sync -- --write');
    return;
  }

  if (changes.length === 0) {
    console.log('\n갱신할 것이 없어 문서를 쓰지 않았습니다.');
    return;
  }

  writeFileSync(doc.path, touchUpdated(lines.join('\n')));
  console.log(`\n${changes.length}행 갱신 · updated: ${today()}`);
  console.log(`git diff ${relative(ROOT, doc.path)} 로 확인하세요.`);
}

main();
