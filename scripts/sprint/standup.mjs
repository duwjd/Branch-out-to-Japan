#!/usr/bin/env node
/**
 * 스탠드업 — 어제 / 오늘 / 블로커.
 *
 * 커밋과 이슈를 잇는 근거는 **커밋 본문의 `#NN`** 이다. 이 저장소에 이미 있는 관례라
 * 새 컨벤션(제목 접두어 등)을 만들지 않는다.
 *
 * `--all` 로 모든 브랜치를 본다 — 작업은 dev-{이름} 에서 일어나는데 GitHub Actions 는
 * main 에서 돌기 때문이다. main 의 커밋만 보면 매일 "어제 한 일 없음"이 된다.
 *
 *   node scripts/sprint/standup.mjs
 *   node scripts/sprint/standup.mjs --format=markdown   # Actions 코멘트 본문
 */
import { execFileSync } from 'node:child_process';
import {
  ROOT,
  readCache,
  statusOf,
  milestoneOf,
  tagsOf,
  shortTitle,
  readSprintDoc,
  EMOJI,
  optionValue,
} from './lib.mjs';

const SEP_FIELD = '\x1f';
const SEP_RECORD = '\x1e';

/**
 * 어제 범위. 월요일이면 금요일 작업이 "어제"이므로 72시간을 본다.
 * @returns {{hours: number, label: string}}
 */
function lookback() {
  const now = new Date();
  const hours = now.getDay() === 1 ? 72 : 24;
  const from = new Date(now.getTime() - hours * 36e5);
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  return { hours, label: `${fmt(from)}~${fmt(now)}` };
}

/** 최근 커밋을 모든 브랜치에서 읽는다. 히스토리가 없으면 빈 배열. */
function recentCommits(hours) {
  let raw;
  try {
    raw = execFileSync(
      'git',
      [
        'log',
        '--all',
        `--since=${hours} hours ago`,
        '--no-merges',
        `--pretty=format:%h${SEP_FIELD}%an${SEP_FIELD}%s${SEP_FIELD}%b${SEP_RECORD}`,
      ],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch {
    return [];
  }
  const seen = new Set();
  return raw
    .split(SEP_RECORD)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, author, subject, body = ''] = record.split(SEP_FIELD);
      // "이슈 12건(#56~#67) 생성" 같은 범위 표기는 개별 이슈 작업이 아니다 — 먼저 지운다
      const text = `${subject}\n${body}`.replace(/#\d+\s*[~\-–]\s*#?\d+/g, '');
      const issues = [...new Set([...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1])))];
      return { hash, author, subject, issues };
    })
    .filter((c) => (seen.has(c.hash) ? false : seen.add(c.hash)));
}

/** 기획 이슈를 먼저 — 구현의 선행이다. 그다음 번호순. */
function todoPriority(a, b) {
  const planA = tagsOf(a).includes('기획') ? 0 : 1;
  const planB = tagsOf(b).includes('기획') ? 0 : 1;
  return planA - planB || a.number - b.number;
}

/** §사용자 작업 표에서 미완료 행을 뽑는다. 여기가 막히면 마일스톤이 멈춘다. */
function pendingUserWork() {
  const doc = readSprintDoc();
  if (!doc) return [];
  const lines = doc.text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## 사용자 작업'));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length && !/^## /.test(lines[i]); i += 1) {
    const m = /^\|\s*\*\*(U\d+)\*\*\s*\|\s*(.+?)\s*\|.*\|\s*(.+?)\s*\|\s*([⬜🔵⛔✅])\s*\|\s*$/.exec(lines[i]);
    if (m && m[4] !== EMOJI.done) {
      // "무엇"과 "언제까지" 모두 설명이 — 뒤에 붙어 있다. 앞머리만 쓴다
      const head = (s) => s.replace(/\*\*/g, '').split('—')[0].trim();
      out.push({ id: m[1], what: head(m[2]), due: head(m[3]) });
    }
  }
  return out;
}

function main() {
  const markdown = optionValue(process.argv.slice(2), '--format') === 'markdown';
  const { issues } = readCache();
  const byNumber = new Map(issues.map((i) => [i.number, i]));
  const { hours, label } = lookback();
  const commits = recentCommits(hours);

  const doing = issues.filter((i) => statusOf(i) === 'doing');
  const blocked = issues.filter((i) => statusOf(i) === 'blocked');
  const todo = issues.filter((i) => statusOf(i) === 'todo' && !tagsOf(i).includes('사용자작업'));
  const userWork = pendingUserWork();

  const lines = [];
  const h = (text) => {
    if (lines.length) lines.push('');
    lines.push(`## ${text}`);
  };
  const li = (text) => lines.push(markdown ? `- ${text}` : `  ${text}`);
  const ref = (n) => {
    const issue = byNumber.get(n);
    return issue ? `#${n} ${shortTitle(issue, 36)}` : `#${n}`;
  };
  /** 스탠드업은 짧아야 읽힌다. 넘치는 건 세어서 한 줄로 접는다. */
  const capped = (items, max, render, noun) => {
    for (const item of items.slice(0, max)) li(render(item));
    if (items.length > max) li(`…외 ${items.length - max}${noun}`);
  };
  const subject = (c) => (c.subject.length > 52 ? `${c.subject.slice(0, 51)}…` : c.subject);

  // ---- 어제
  h(`어제 (${label})`);
  if (commits.length === 0) {
    li('커밋 없음.');
  } else {
    const linked = new Map();
    const loose = [];
    for (const c of commits) {
      const known = c.issues.filter((n) => byNumber.has(n));
      if (known.length === 0) loose.push(c);
      for (const n of known) {
        if (!linked.has(n)) linked.set(n, []);
        linked.get(n).push(c);
      }
    }
    capped(
      [...linked].sort((a, b) => a[0] - b[0]),
      4,
      ([n, list]) => `${ref(n)} — ${list.map((c) => `\`${c.hash}\` ${subject(c)}`).join(' · ')}`,
      '건',
    );
    capped(loose, 3, (c) => `(이슈 미연결) \`${c.hash}\` ${subject(c)}`, '건');
  }

  // ---- 오늘
  h('오늘');
  if (doing.length) {
    for (const issue of doing) li(`**${ref(issue.number)}** — 진행 중`);
  }
  const suggestions = todo.sort(todoPriority).slice(0, doing.length ? 1 : 3);
  for (const issue of suggestions) {
    li(`${ref(issue.number)} — ${milestoneOf(issue)} 착수 가능${tagsOf(issue).includes('기획') ? ' (구현 선행)' : ''}`);
  }
  if (doing.length === 0 && suggestions.length === 0) li('열린 이슈가 없습니다.');

  // ---- 블로커
  h('블로커');
  if (blocked.length === 0 && userWork.length === 0) {
    li('없음.');
  } else {
    for (const issue of blocked) li(`${EMOJI.blocked} ${ref(issue.number)}`);
    // 사용자 작업은 위에서부터 급한 순서로 적혀 있다 — 앞 3건만 매일 상기시킨다
    capped(userWork, 3, (u) => `${u.id} ${u.what} — 기한 ${u.due}`, '건');
  }

  if (markdown) {
    lines.push(
      '',
      `> 자동 생성 · 상태 정본은 [Issues](https://github.com/duwjd/Branch-out-to-Japan/issues) · 맥락은 \`docs/sprints/\``,
    );
  }
  console.log(lines.join('\n').trim());
}

main();
