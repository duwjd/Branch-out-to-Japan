#!/usr/bin/env node
/**
 * GitHub Issues → .sprint/cache/ 단방향 동기화.
 *
 * 왜 캐시를 두나 — 세션 훅과 보드가 매번 네트워크를 왕복하면 세션 시작이 느려진다.
 * 캐시가 있으면 Claude 가 스프린트 상태를 공짜로 알고 있다. 대신 캐시는 오래되므로
 * 하루 시작에 이 명령을 돌리는 것이 리듬이다.
 *
 * 이 스크립트는 GitHub 에 아무것도 쓰지 않는다. 실패해도 기존 캐시를 지우지 않는다 —
 * 오래된 캐시가 빈 캐시보다 낫다.
 *
 *   node scripts/sprint/sync.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ROOT, CACHE_DIR, ISSUES_FILE, META_FILE } from './lib.mjs';

const FIELDS = 'number,title,state,labels,url,body,assignees,createdAt,updatedAt,closedAt';

/** 저장소를 origin 리모트에서 알아낸다. 설정 파일을 따로 두지 않기 위해서다. */
function detectRepo() {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
  if (!m) throw new Error(`origin 이 GitHub 저장소가 아닙니다: ${url}`);
  return m[1];
}

function main() {
  let repo;
  try {
    repo = detectRepo();
  } catch (e) {
    console.error(`저장소를 알 수 없습니다: ${e.message}`);
    process.exit(1);
  }

  let raw;
  try {
    raw = execFileSync('gh', ['issue', 'list', '--repo', repo, '--state', 'all', '--limit', '300', '--json', FIELDS], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const why =
      e.code === 'ENOENT'
        ? 'gh CLI 가 없습니다. https://cli.github.com 에서 설치하세요.'
        : `gh 호출 실패:\n${(e.stderr ?? '').toString().trim()}`;
    console.error(`${why}\n인증이 만료됐다면 \`gh auth login\` 이 필요합니다.`);
    console.error('기존 캐시는 그대로 두었습니다 — 오래됐을 수 있습니다.');
    process.exit(1);
  }

  const issues = JSON.parse(raw).sort((a, b) => a.number - b.number);

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(ISSUES_FILE, `${JSON.stringify(issues, null, 2)}\n`);
  writeFileSync(
    META_FILE,
    `${JSON.stringify({ repo, syncedAt: new Date().toISOString(), count: issues.length }, null, 2)}\n`,
  );

  const open = issues.filter((i) => i.state.toUpperCase() === 'OPEN').length;
  console.log(`${issues.length}건 동기화 (열림 ${open} · 닫힘 ${issues.length - open}) — ${repo}`);
}

main();
