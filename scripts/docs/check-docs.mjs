#!/usr/bin/env node
/**
 * 지식베이스 규약 검사 — docs/CONVENTIONS.md §9.
 *
 * 1) 모든 .md 에 프론트매터와 필수 키가 있는가
 * 2) status 가 허용값인가 · 이력·폐기에 superseded_by 가 있는가
 * 3) [[위키링크]] 와 상대경로 링크의 대상이 실재하는가
 * 4) 어느 영역 인덱스에도 등재되지 않은 고아 문서가 있는가
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, dirname, relative, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCAN_DIRS = ['docs', 'design'];
const ROOT_DOCS = ['README.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'PRODUCT.md'];
const REQUIRED = ['title', 'space', 'status', 'phase', 'updated'];
const STATUSES = ['정본', '초안', '이력', '폐기'];
const SPACES = [
  '프로젝트 기준',
  '전략·제품',
  '설계·개발',
  '화면 스펙',
  '의사결정',
  '리서치',
  '검증·실험',
  '디자인',
  '발표·공유',
];
/** 고아 판정 기준이 되는 인덱스. 여기 등재되지 않은 문서는 찾을 길이 없다. */
const INDEXES = [
  'docs/README.md',
  'docs/CONVENTIONS.md',
  'docs/specs/README.md',
  'docs/decisions/README.md',
  'docs/decisions/DECISIONS.md',
  'docs/research/README.md',
  'docs/research/archive/README.md',
  'docs/research/simulations/README.md',
  'docs/research/ut-agent/README.md',
  'docs/research/ut-agent/results/UT-리포트.md',
  'docs/experiments/README.md',
  'docs/sprints/README.md',
  'docs/presentation/README.md',
  'design/README.md',
];

const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

/** 디렉터리를 재귀 순회해 .md 파일 경로를 모은다. */
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(rel)));
    else if (extname(entry.name) === '.md') out.push(rel);
  }
  return out;
}

/** 프론트매터를 얕게 파싱한다 (한 줄 `키: 값` 만 — 중첩은 원본 메타라 건드리지 않는다). */
function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return null;
  const attrs = {};
  for (const line of text.slice(4, end + 1).split('\n')) {
    const m = /^([A-Za-z_]\w*): ?(.*)$/.exec(line);
    if (m) attrs[m[1]] = m[2].trim();
  }
  return { attrs, body: text.slice(end + 5) };
}

/** 링크 문자열을 저장소 상대 경로로 바꾼다. 폴더도 유효한 대상이다. 못 찾으면 null. */
function resolveTarget(fromFile, raw) {
  const clean = decodeURIComponent(raw.split('#')[0].trim());
  if (!clean) return 'ANCHOR_ONLY';
  const candidates = [];
  for (const base of [dirname(fromFile), 'docs', '.']) {
    const p = join(base, clean);
    candidates.push(p);
    if (!extname(p)) candidates.push(`${p}.md`, `${p}.html`);
  }
  for (const c of candidates) {
    const abs = join(ROOT, c);
    if (existsSync(abs)) return statSync(abs).isFile() ? relative(ROOT, abs) : 'DIRECTORY';
  }
  return null;
}

/** 인라인 코드(`...`)와 코드 블록을 지운다 — 예시로 적은 링크를 검사하지 않기 위해. */
function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

const files = [...(await Promise.all(SCAN_DIRS.map(walk))).flat(), ...ROOT_DOCS].sort();
const listed = new Set();

// 인덱스가 가리키는 문서를 모은다 (고아 판정용)
for (const idx of INDEXES) {
  if (!existsSync(join(ROOT, idx))) {
    fail(idx, '인덱스 파일이 없다');
    continue;
  }
  const text = readFileSync(join(ROOT, idx), 'utf8');
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const t = resolveTarget(idx, m[1]);
    if (t && !['ANCHOR_ONLY', 'DIRECTORY'].includes(t)) listed.add(t);
  }
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const t = resolveTarget(idx, m[1].split('|')[0]);
    if (t && !['ANCHOR_ONLY', 'DIRECTORY'].includes(t)) listed.add(t);
  }
}

for (const file of files) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const fm = parseFrontmatter(text);
  if (!fm) {
    fail(file, '프론트매터가 없다 (docs/CONVENTIONS.md §2)');
    continue;
  }
  const { attrs, body } = fm;

  for (const key of REQUIRED) if (!attrs[key]) fail(file, `필수 키 없음: ${key}`);
  if (attrs.status && !STATUSES.includes(attrs.status)) fail(file, `status 허용값 아님: ${attrs.status}`);
  if (attrs.space && !SPACES.includes(attrs.space)) fail(file, `space 허용값 아님: ${attrs.space}`);
  if (attrs.updated && !/^\d{4}-\d{2}-\d{2}$/.test(attrs.updated)) fail(file, `updated 형식 아님: ${attrs.updated}`);
  if (['이력', '폐기'].includes(attrs.status) && !attrs.superseded_by)
    fail(file, `status: ${attrs.status} 인데 superseded_by 가 없다`);

  const h1 = /^# (.+)$/m.exec(body);
  if (h1 && attrs.title && h1[1].trim() !== attrs.title.replace(/^"|"$/g, ''))
    warn(file, `title 이 본문 h1 과 다르다 — 속성 "${attrs.title}" / 본문 "${h1[1].trim()}"`);

  const prose = stripCode(body);
  const headings = new Set([...prose.matchAll(/^#{1,6} +(.+)$/gm)].map((m) => m[1].trim()));
  for (const m of prose.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = m[1].split('|')[0];
    if (headings.has(target.trim())) continue; // 같은 문서의 절을 가리키는 위키링크
    if (resolveTarget(file, target) === null) fail(file, `깨진 위키링크: [[${target}]]`);
  }
  for (const m of prose.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(href)) continue;
    if (resolveTarget(file, href) === null) fail(file, `깨진 링크: ${href}`);
  }

  if (!INDEXES.includes(file) && !listed.has(file)) warn(file, '고아 문서 — 어느 인덱스에도 등재되지 않았다');
}

const label = (n, s) => `${n}${s}`;
console.log(`문서 ${files.length}편 검사`);
for (const w of warnings) console.log(`  ⚠  ${w}`);
for (const e of errors) console.log(`  ✖  ${e}`);
console.log(`\n오류 ${label(errors.length, '건')} · 경고 ${label(warnings.length, '건')}`);
process.exit(errors.length ? 1 : 0);
