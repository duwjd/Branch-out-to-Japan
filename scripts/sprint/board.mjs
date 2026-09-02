#!/usr/bin/env node
/**
 * 스프린트 보드 (텍스트).
 *
 * 상태로 묶어 보여준다 — "지금 무엇에 손이 가야 하는가"가 질문이기 때문이다.
 * 마일스톤 지도는 스프린트 문서 §작업 보드가 이미 맡고 있으므로 여기서 반복하지 않고
 * 각 줄의 태그로만 표시한다.
 *
 *   node scripts/sprint/board.mjs              전체
 *   node scripts/sprint/board.mjs --compact    세션 훅 주입용 축약
 */
import {
  readCache,
  cacheAgeHours,
  statusOf,
  milestoneOf,
  tagsOf,
  shortTitle,
  readSprintDoc,
  frontmatterValue,
  EMOJI,
  STATUS_LABEL,
  STATUS_ORDER,
  sortMilestones,
  hasFlag,
} from './lib.mjs';

/** 라벨 설명에서 마일스톤 한 줄 설명을 모은다 (M13 → "상세페이지 시간 예산"). */
function milestoneDescriptions(issues) {
  const map = new Map();
  for (const issue of issues) {
    for (const label of issue.labels ?? []) {
      if (/^M\d+$/.test(label.name) && label.description) map.set(label.name, label.description);
    }
  }
  return map;
}

/** 문서 제목에서 기간만 뽑는다 — "스프린트 · Phase 1 (2026-08-31 ~ 09-11)" → 뒤 괄호. */
function sprintHeading() {
  const doc = readSprintDoc();
  if (!doc) return { title: '스프린트', period: '' };
  const title = frontmatterValue(doc.text, 'title') || '스프린트';
  const m = /\(([^)]+)\)\s*$/.exec(title);
  return { title: title.replace(/\s*\([^)]*\)\s*$/, ''), period: m ? m[1] : '' };
}

function main() {
  const compact = hasFlag(process.argv.slice(2), '--compact');
  const { issues, meta } = readCache();
  const { title, period } = sprintHeading();
  const descriptions = milestoneDescriptions(issues);

  const byStatus = new Map(STATUS_ORDER.map((s) => [s, []]));
  for (const issue of issues) byStatus.get(statusOf(issue)).push(issue);
  for (const list of byStatus.values()) list.sort((a, b) => a.number - b.number);

  const done = byStatus.get('done').length;
  const age = cacheAgeHours(meta);
  const ageText = age === null ? '' : age < 1 ? '방금' : `${Math.round(age)}시간 전`;

  if (compact) {
    console.log(`=== ${title}${period ? ` (~${period.split('~').pop().trim()})` : ''} ===`);
    console.log(`이슈 ${done}/${issues.length} 완료${ageText ? ` · 캐시 ${ageText}` : ''}`);
    for (const status of STATUS_ORDER) {
      const list = byStatus.get(status);
      if (list.length === 0 || status === 'done') continue;
      const head = list
        .slice(0, 4)
        .map((i) => `#${i.number}`)
        .join(' ');
      const more = list.length > 4 ? ` 외 ${list.length - 4}` : '';
      console.log(`${EMOJI[status]} ${STATUS_LABEL[status]} ${list.length}: ${head}${more}`);
    }
    // 손이 가야 할 것 하나는 제목까지 보여준다
    const focus = [...byStatus.get('doing'), ...byStatus.get('blocked')][0];
    if (focus) console.log(`지금: #${focus.number} ${shortTitle(focus)}`);
    // 사용자 작업은 따로 짚는다 — 다만 이미 위에 나온 이슈를 두 번 적지 않는다
    const userWork = issues.filter(
      (i) => tagsOf(i).includes('사용자작업') && statusOf(i) !== 'done' && i.number !== focus?.number,
    );
    for (const issue of userWork) console.log(`사용자 작업: #${issue.number} ${shortTitle(issue)}`);
    return;
  }

  console.log(`# ${title}${period ? ` · ${period}` : ''}`);
  console.log(
    `이슈 ${done}/${issues.length} 완료 (${issues.length ? Math.round((done / issues.length) * 100) : 0}%)${ageText ? ` · 캐시 ${ageText}` : ''}`,
  );

  for (const status of STATUS_ORDER) {
    const list = byStatus.get(status);
    if (list.length === 0) continue;
    console.log(`\n## ${EMOJI[status]} ${STATUS_LABEL[status]} (${list.length})`);
    for (const issue of list) {
      const tags = tagsOf(issue);
      const suffix = tags.length ? `  [${tags.join('·')}]` : '';
      console.log(`  #${String(issue.number).padEnd(4)} ${milestoneOf(issue).padEnd(4)} ${shortTitle(issue)}${suffix}`);
    }
  }

  const open = issues.filter((i) => statusOf(i) !== 'done');
  if (open.length) {
    console.log('\n## 마일스톤별 잔여');
    const counts = new Map();
    for (const issue of open) {
      const key = milestoneOf(issue);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const key of sortMilestones([...counts.keys()])) {
      const desc = descriptions.get(key);
      console.log(`  ${key.padEnd(4)} ${counts.get(key)}건${desc ? ` — ${desc}` : ''}`);
    }
  }
}

main();
