#!/usr/bin/env node
/**
 * SessionStart 훅 — 세션이 열릴 때 스프린트 보드를 컨텍스트에 넣는다.
 *
 * 왜 — 세션마다 "지금 뭐 하던 중인지"를 사람이 다시 설명하지 않게 하려는 것이다.
 * 캐시(.sprint/cache/)만 읽고 **네트워크를 타지 않는다.** 세션 시작이 느려지면 안 된다.
 * 캐시가 없으면 조용히 아무것도 하지 않는다 — 이 도구를 안 쓰는 세션을 방해하지 않는다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.CLAUDE_PROJECT_DIR
  || resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const META = join(ROOT, '.sprint', 'cache', 'meta.json');

/** 조용히 빠진다. 훅 실패로 세션을 막지 않는다. */
const bail = () => process.exit(0);

const run = (cmd, args) => execFileSync(cmd, args, {
  cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
}).trim();

if (!existsSync(META)) bail();

let board;
try {
  board = run('node', ['scripts/sprint/board.mjs', '--compact']);
} catch {
  bail();
}
if (!board) bail();

let branch = 'unknown';
try {
  branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
} catch { /* git 이 없어도 보드는 쓸모 있다 */ }

// 캐시가 오래되면 그 사실을 알린다. 여기서 직접 동기화하지는 않는다.
let staleNote = '';
try {
  const { syncedAt } = JSON.parse(readFileSync(META, 'utf8'));
  const hours = (Date.now() - new Date(syncedAt).getTime()) / 36e5;
  if (hours > 12) staleNote = `\n캐시가 ${Math.round(hours)}시간 지났다 — /sprint-sync 로 갱신할 것.`;
} catch { /* meta 를 못 읽어도 보드는 이미 나왔다 */ }

const context = `${board}
브랜치: ${branch}${staleNote}

[스프린트 규칙]
- 일감의 **상태 정본은 GitHub Issues**다. docs/sprints/ 문서는 계획·회고의 정본이고, §작업 보드는 이슈로 잇는 지도다. 두 곳에 같은 내용을 쓰지 않는다.
- 상태를 바꿀 때는 이슈 쪽을 바꾼다(라벨 \`진행\`·\`blocked\` 부착/제거, 완료는 close). 그다음 \`npm run sprint:doc-sync -- --write\` 로 문서 상태 열을 맞춘다.
- 스프린트 문서의 목표·리스크·일자별 기록·회고는 **사람이 쓰는 글**이다. 스크립트도 Claude도 임의로 고치지 않는다.
- U1~U7(사용자 작업)은 사람만 할 수 있는 일이다. 대신 수행하려 하지 말고 무엇이 막혔는지만 짚는다.

/sprint-board 보드 · /sprint-standup 스탠드업 · /sprint-kanban 칸반 · /sprint-sync 동기화`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: context,
  },
}));
