#!/usr/bin/env node
/**
 * 칸반 HTML 생성 → .sprint/board.html
 *
 * 색은 app/globals.css 의 브랜드 토큰을 그대로 옮겼다(크림 #faf8f5 · 잉크 #182333 ·
 * 일출 코랄 #ff6f61). 면에는 원색을, 소형 텍스트에는 coral-strong #c93f2e 을 쓴다 —
 * 원색은 크림 위 2.6:1 이라 글자색으로 못 쓴다. 일출 그라디언트는 로고 전용이라 안 쓴다.
 *
 * 생성물이다. 직접 편집하면 다음 실행에 날아간다.
 *
 *   node scripts/sprint/kanban.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ROOT,
  readCache,
  statusOf,
  milestoneOf,
  tagsOf,
  readSprintDoc,
  frontmatterValue,
  EMOJI,
  STATUS_LABEL,
  STATUS_ORDER,
  sortMilestones,
  optionValue,
} from './lib.mjs';

const OUT_DEFAULT = join(ROOT, '.sprint', 'board.html');

/** 상태별 강조색 — 면에 쓰는 원색. */
const ACCENT = {
  doing: '#ff6f61',
  blocked: '#d94848',
  todo: '#b1b6be',
  done: '#2d8c6b',
};

const escape = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const CSS = `
*{box-sizing:border-box}
body{margin:0;padding:28px 24px;background:#faf8f5;color:#3d4655;
 font:14px/1.55 var(--font-pretendard),"Pretendard Variable",Pretendard,
 -apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
h1{font-size:20px;margin:0 0 5px;color:#182333;letter-spacing:-.01em}
.sub{color:#6e7686;font-size:13px}
.bar{height:6px;background:#e9e7e3;border-radius:4px;overflow:hidden;max-width:540px;margin:14px 0 6px}
.bar>i{display:block;height:100%;background:#ff6f61;border-radius:4px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 22px}
.chip{border:1px solid #e9e7e3;background:#fff;border-radius:999px;padding:4px 12px;font-size:12px;color:#3d4655}
.chip b{color:#182333;font-weight:600}
.chip.zero{color:#78818f}
.cols{display:grid;grid-template-columns:repeat(4,minmax(210px,1fr));gap:14px;align-items:start}
.col{background:#f2f1ed;border-radius:12px;padding:11px}
.col h2{font-size:11px;letter-spacing:.08em;margin:3px 2px 11px;display:flex;
 justify-content:space-between;align-items:center;font-weight:600}
.n{background:#fff;border-radius:999px;padding:1px 9px;font-size:11px;color:#6e7686;letter-spacing:0;font-weight:500}
.card{background:#fff;border-radius:9px;padding:11px;margin-bottom:8px;
 border-left:3px solid #b1b6be;box-shadow:0 1px 2px rgba(24,35,51,.06)}
.card .id{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#78818f}
.card .ms{float:right;font-size:11px;color:#c93f2e;font-weight:600}
.t{margin:5px 0 8px;font-size:13px;color:#182333;line-height:1.45}
.meta{display:flex;flex-wrap:wrap;gap:5px;font-size:11px}
.tag{background:#f2f1ed;border-radius:4px;padding:1px 7px;color:#6e7686}
.tag.hot{background:#fff1ee;color:#c93f2e;font-weight:600}
.empty{color:#b1b6be;font-size:12px;padding:6px 2px}
footer{margin-top:26px;color:#78818f;font-size:11px;line-height:1.8;
 border-top:1px solid #e9e7e3;padding-top:14px}
footer code{background:#f2f1ed;padding:1px 5px;border-radius:3px}
@media(max-width:880px){.cols{grid-template-columns:1fr 1fr}}
`;

function card(issue) {
  const tags = tagsOf(issue).map((t) => `<span class="tag${t === '사용자작업' ? ' hot' : ''}">${escape(t)}</span>`);
  const ms = milestoneOf(issue);
  return (
    `<div class="card" style="border-left-color:${ACCENT[statusOf(issue)]}">` +
    `<span class="id">#${issue.number}</span><span class="ms">${escape(ms)}</span>` +
    `<div class="t"><a href="${escape(issue.url)}" style="color:inherit;text-decoration:none">${escape(issue.title)}</a></div>` +
    `<div class="meta">${tags.join('')}</div></div>`
  );
}

function main() {
  const out = optionValue(process.argv.slice(2), '--out', OUT_DEFAULT);
  const { issues, meta } = readCache();
  const doc = readSprintDoc();
  const title = doc ? frontmatterValue(doc.text, 'title') : '스프린트';

  const byStatus = new Map(STATUS_ORDER.map((s) => [s, []]));
  for (const issue of issues) byStatus.get(statusOf(issue)).push(issue);
  for (const list of byStatus.values()) list.sort((a, b) => a.number - b.number);

  const done = byStatus.get('done').length;
  const pct = issues.length ? Math.round((done / issues.length) * 100) : 0;

  const openByMilestone = new Map();
  for (const issue of issues) {
    if (statusOf(issue) === 'done') continue;
    const key = milestoneOf(issue);
    openByMilestone.set(key, (openByMilestone.get(key) ?? 0) + 1);
  }
  const chips = sortMilestones([...openByMilestone.keys()])
    .map((k) => `<span class="chip"><b>${escape(k)}</b> 잔여 ${openByMilestone.get(k)}건</span>`)
    .join('');

  const cols = STATUS_ORDER.map((status) => {
    const list = byStatus.get(status);
    const body = list.length ? list.map(card).join('') : '<div class="empty">없음</div>';
    return (
      `<div class="col"><h2 style="color:${ACCENT[status]}">${EMOJI[status]} ${STATUS_LABEL[status]}` +
      `<span class="n">${list.length}</span></h2>${body}</div>`
    );
  }).join('');

  const synced = meta.syncedAt
    ? new Date(meta.syncedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
    : '알 수 없음';

  const html = `<!doctype html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} · 칸반</title><style>${CSS}</style>
<h1>${escape(title)}</h1>
<div class="sub">이슈 ${done} / ${issues.length} 완료</div>
<div class="bar"><i style="width:${pct}%"></i></div>
<div class="sub">${pct}%</div>
<div class="chips">${chips}</div>
<div class="cols">${cols}</div>
<footer>
상태 정본은 <a href="https://github.com/${escape(meta.repo)}/issues" style="color:#c93f2e">GitHub Issues</a> ·
계획과 회고는 <code>docs/sprints/</code><br>
동기화 ${escape(synced)} — 갱신은 <code>npm run sprint:sync</code><br>
이 파일은 생성물입니다. 직접 편집하면 다음 실행에 사라집니다.
</footer>
</html>`;

  mkdirSync(join(ROOT, '.sprint'), { recursive: true });
  writeFileSync(out, html);
  console.log(relative(ROOT, out));
}

main();
