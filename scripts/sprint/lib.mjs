#!/usr/bin/env node
/**
 * 스프린트 도구 공통부.
 *
 * 정본 관계를 코드로 고정한다 — GitHub Issues 가 상태의 정본이고,
 * .sprint/cache/ 는 그 캐시이며, docs/sprints/ 문서는 계획·회고의 정본이다.
 * 여기 있는 함수는 캐시를 읽고 해석만 한다. GitHub 에 쓰지 않는다.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE_DIR = join(ROOT, '.sprint', 'cache');
export const ISSUES_FILE = join(CACHE_DIR, 'issues.json');
export const META_FILE = join(CACHE_DIR, 'meta.json');
export const SPRINT_DOC_DIR = join(ROOT, 'docs', 'sprints');

/** 문서 §작업 보드 범례와 1:1 대응한다. 이 매핑이 doc-sync 의 기준이다. */
export const EMOJI = { done: '✅', blocked: '⛔', doing: '🔵', todo: '⬜' };
export const STATUS_LABEL = { done: '완료', blocked: '차단', doing: '진행', todo: '대기' };
/** 보드·칸반에서 이 순서로 보여준다 — 손이 가야 하는 것부터. */
export const STATUS_ORDER = ['doing', 'blocked', 'todo', 'done'];

/** 마일스톤 라벨(M13·M14…)을 뽑는 규칙. GitHub Milestones 는 쓰지 않는다. */
const MILESTONE_RE = /^M\d+$/;
/** 마일스톤 라벨이 없는 이슈가 모이는 곳. 문서 §운영 표와 짝이다. */
export const NO_MILESTONE = '운영';
/**
 * 일감이 아닌 이슈. 스탠드업 이슈는 자동 코멘트를 받는 게시판이지 태스크가 아니라서
 * 보드·스탠드업·문서 대조 어디에도 나오면 안 된다.
 */
const META_LABELS = ['스탠드업'];

// ---------------------------------------------------------------- 캐시

/** 캐시가 있는지. 없으면 훅은 조용히 빠지고, 명령은 sync 를 안내한다. */
export function hasCache() {
  return existsSync(ISSUES_FILE);
}

/**
 * 캐시를 읽는다.
 * @returns {{issues: object[], meta: {syncedAt: string, repo: string}}}
 */
export function readCache() {
  if (!hasCache()) {
    throw new Error('캐시가 없습니다. 먼저 동기화하세요:\n  npm run sprint:sync');
  }
  const issues = JSON.parse(readFileSync(ISSUES_FILE, 'utf8')).filter(
    (i) => !(i.labels ?? []).some((l) => META_LABELS.includes(l.name)),
  );
  const meta = existsSync(META_FILE) ? JSON.parse(readFileSync(META_FILE, 'utf8')) : { syncedAt: null, repo: '' };
  return { issues, meta };
}

/** 캐시가 몇 시간 전 것인지. 훅이 "오래됐다"고 알릴 때 쓴다. */
export function cacheAgeHours(meta) {
  if (!meta?.syncedAt) return null;
  return (Date.now() - new Date(meta.syncedAt).getTime()) / 36e5;
}

// ---------------------------------------------------------------- 이슈 해석

export const labelNames = (issue) => (issue.labels ?? []).map((l) => l.name);

/**
 * 이슈 하나의 상태를 문서 이모지 4종 중 하나로 판정한다.
 * closed 가 최우선 — 닫힌 이슈에 blocked 라벨이 남아 있어도 완료다.
 */
export function statusOf(issue) {
  if ((issue.state ?? '').toUpperCase() === 'CLOSED') return 'done';
  const names = labelNames(issue);
  if (names.includes('blocked')) return 'blocked';
  if (names.includes('진행')) return 'doing';
  return 'todo';
}

/** 이슈가 속한 마일스톤. 라벨 M13·M14·M15 로만 판정한다. */
export function milestoneOf(issue) {
  return labelNames(issue).find((n) => MILESTONE_RE.test(n)) ?? NO_MILESTONE;
}

/** 카드에 붙일 성격 태그 (마일스톤·상태 라벨을 뺀 나머지). */
export function tagsOf(issue) {
  return labelNames(issue).filter((n) => !MILESTONE_RE.test(n) && n !== 'blocked' && n !== '진행');
}

/** 마일스톤 이름순. 운영이 먼저, 그다음 M13·M14·M15. */
export function sortMilestones(names) {
  return [...names].sort((a, b) => {
    if (a === NO_MILESTONE) return -1;
    if (b === NO_MILESTONE) return 1;
    return Number(a.slice(1)) - Number(b.slice(1));
  });
}

/** 보드 한 줄에 넣을 짧은 제목. 이모지 머리글자는 떼어낸다. */
export function shortTitle(issue, max = 44) {
  const t = (issue.title ?? '').replace(/^[\p{Emoji_Presentation}️]\s*/u, '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// ---------------------------------------------------------------- 스프린트 문서

/**
 * 스프린트 문서 파일명 규칙 (docs/sprints/README.md §규칙) — `YYYY-MM-{phase}.md`.
 * 이 패턴으로 좁히지 않으면 폴더에 같이 사는 가이드·회고 문서가 스프린트로 오인된다.
 * (한글 파일명은 숫자보다 뒤로 정렬돼 이름순 마지막을 가로챈다.)
 */
const SPRINT_DOC_RE = /^\d{4}-\d{2}-.+\.md$/;

/**
 * 현재 스프린트 문서를 찾는다 — 파일명 규칙에 맞는 것 중 이름순 마지막.
 * 파일명이 YYYY-MM-{phase}.md 라 이름순이 곧 시간순이다.
 * @returns {{path: string, text: string, name: string} | null}
 */
export function readSprintDoc() {
  if (!existsSync(SPRINT_DOC_DIR)) return null;
  const names = readdirSync(SPRINT_DOC_DIR)
    .filter((n) => SPRINT_DOC_RE.test(n))
    .sort();
  if (names.length === 0) return null;
  const name = names[names.length - 1];
  const path = join(SPRINT_DOC_DIR, name);
  return { path, name, text: readFileSync(path, 'utf8') };
}

/** 프론트매터 한 키의 값. 없으면 빈 문자열. */
export function frontmatterValue(text, key) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return '';
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0 && line.slice(0, i).trim() === key) return line.slice(i + 1).trim();
  }
  return '';
}

/**
 * 표 행을 셀로 쪼갠다.
 * 이스케이프된 파이프(`devlink\|gmail\|resend`)를 열 구분자로 보면 안 되므로
 * 앞에 역슬래시가 없는 `|` 에서만 자른다. 되붙이면 원문이 그대로 복원된다.
 */
export function splitRow(line) {
  return line.split(/(?<!\\)\|/);
}

/** §작업 보드 표의 헤더. 이 형태가 아니면 대상이 아니다. */
const BOARD_HEADER = ['태스크', '상태', '담당', '이슈'];

/**
 * §작업 보드 안의 표 행만 골라낸다.
 *
 * §사용자 작업 표는 열 구성이 달라(`# / 무엇 / 왜 / 언제까지 / 상태`) 자동으로
 * 걸러진다 — 헤더가 BOARD_HEADER 와 다르기 때문이다. U1~U7 의 정본은 이슈 #68 이다.
 *
 * @returns {{lineNo: number, issueNumber: number|null, task: string, status: string}[]}
 */
export function parseBoardRows(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## 작업 보드');
  if (start === -1) return [];

  const rows = [];
  let inBoardTable = false;

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^## /.test(line)) break; // 다음 대제목에서 §작업 보드가 끝난다

    if (!line.trimStart().startsWith('|')) {
      inBoardTable = false;
      continue;
    }

    const cells = splitRow(line);
    const inner = cells.slice(1, -1).map((c) => c.trim());

    // 헤더 행이면 이 표가 대상인지 판정한다
    if (inner.length === BOARD_HEADER.length && inner.every((c, j) => c === BOARD_HEADER[j])) {
      inBoardTable = true;
      continue;
    }
    // 구분선(|---|---|)은 건너뛴다
    if (inner.every((c) => /^:?-+:?$/.test(c))) continue;
    if (!inBoardTable || inner.length !== BOARD_HEADER.length) continue;

    const issueMatch = /\[#(\d+)\]/.exec(inner[3]);
    rows.push({
      lineNo: i,
      task: inner[0],
      status: inner[1],
      issueNumber: issueMatch ? Number(issueMatch[1]) : null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------- 출력 보조

/** 오늘 날짜 YYYY-MM-DD (로컬). 프론트매터 updated 와 스탠드업 제목에 쓴다. */
export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 인자 배열에 플래그가 있는지. */
export const hasFlag = (argv, flag) => argv.includes(flag);

/** `--key=value` 형태의 값. 없으면 fallback. */
export function optionValue(argv, key, fallback = null) {
  const hit = argv.find((a) => a.startsWith(`${key}=`));
  return hit ? hit.slice(key.length + 1) : fallback;
}
