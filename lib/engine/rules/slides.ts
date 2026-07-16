/**
 * 보고용 슬라이드 렌더러 (스펙 §10) — 덱 spec + blocksJson → 단일 self-contained HTML.
 *
 * 규칙 세 가지가 이 파일의 존재 이유다:
 *  1. **숫자는 여기서만 나온다.** 모든 수치를 blocksJson에서 직접 인용한다. spec(LLM 카피)의
 *     숫자는 쓰지 않는다 → 가짜 수치가 구조적으로 불가능(AC-10.3 · 증거 원칙).
 *  2. **무의존.** 외부 CSS/JS/폰트/이미지를 참조하지 않는다. CDN 금지(AC-10.2).
 *  3. **순수 함수.** I/O·LLM·Date.now() 없음 → 같은 입력이면 같은 바이트(AC-10.5).
 *
 * 문자열은 예외 없이 escapeHtml을 거친다 — brandName은 사용자 입력이다(AC-10.4).
 */

import type { BlocksJson, DeckSpec, RubricGroup, SlideCopy, SlideKey } from '../types';
import { slideKeysFor } from '../types';

/** design/DESIGN.md 코랄 시스템 — 로고색이 아니라 DS 토큰 */
const T = {
  primary: '#ff6464',
  primaryStrong: '#d93636',
  tint: '#fff8f8',
  ink: '#202124',
  body: '#414245',
  mute: '#5f6165',
  line: '#e4e7ec',
  canvas: '#ffffff',
  error: '#b3271d',
  errorBg: '#fdeceb',
  warn: '#7a5200',
  warnBg: '#fff6e5',
  safe: '#036c4a',
  safeBg: '#e6f7f0',
} as const;

const GROUP_LABELS: Record<RubricGroup, string> = {
  A: 'A 신뢰 구축',
  B: 'B 무첨가·안전',
  C: 'C 서사 구조',
  D: 'D 성분 프레이밍',
  E: 'E 카테고리 적합성',
};

/** HTML 특수문자 이스케이프 — 모든 동적 문자열의 유일한 출구 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 카피 불릿 목록 — 비어 있으면 통째로 생략 */
function bulletsHtml(copy: SlideCopy): string {
  if (!copy.bullets.length) return '';
  const items = copy.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
  return `<ul class="b">${items}</ul>`;
}

/** 슬라이드 공통 껍데기 */
function slide(copy: SlideCopy, bodyHtml: string): string {
  return [
    '<section class="s">',
    '<div class="in">',
    `<h2>${escapeHtml(copy.heading)}</h2>`,
    `<p class="lead">${escapeHtml(copy.lead)}</p>`,
    bodyHtml,
    bulletsHtml(copy),
    '</div>',
    '</section>',
  ].join('');
}

/**
 * 풀 모드 전용 블록 좁히기 — 브랜드 진단 덱의 키셋에는 이 렌더러들이 아예 없으므로
 * 여기 도달했는데 블록이 없다면 조립 계약 위반이다(없는 수치를 0으로 렌더하지 않는다).
 */
function requireScored(b: BlocksJson): Extract<BlocksJson['block1'], { scored: true }> {
  if (!b.block1.scored) throw new Error('점수 슬라이드는 브랜드+제품 덱에서만 렌더된다(block1 미채점).');
  return b.block1;
}
function requireBlock<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`${name} 슬라이드는 브랜드+제품 덱에서만 렌더된다(블록 null).`);
  return value;
}

/** 표지 — 수치는 blocksJson.block0 */
function coverSlide(copy: SlideCopy, b: BlocksJson): string {
  const meta = [
    ['브랜드', b.block0.brandName],
    ['제품', b.block0.productName],
    ['카테고리', b.block0.categoryLabel],
    ['제품 분류', b.block0.productClassLabel],
    ['가격', b.block0.priceLabel],
    ['발행일', b.block0.issuedAt],
  ]
    .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join('');
  return [
    '<section class="s cover">',
    '<div class="in">',
    `<p class="eyebrow">${escapeHtml(b.block0.categoryLabel)}</p>`,
    `<h1>${escapeHtml(copy.heading)}</h1>`,
    `<p class="lead">${escapeHtml(copy.lead)}</p>`,
    `<dl class="meta">${meta}</dl>`,
    bulletsHtml(copy),
    '</div>',
    '</section>',
  ].join('');
}

/** 결론 — 종합점수는 blocksJson.block1.overallScore */
function conclusionSlide(copy: SlideCopy, b: BlocksJson): string {
  const b1 = requireScored(b);
  const body = [
    '<div class="score">',
    `<span class="n">${b1.overallScore}</span><span class="d">/ 100</span>`,
    '<span class="cap">일본 상세 관례 충족도 · 성과 예측 아님</span>',
    '</div>',
  ].join('');
  return slide(copy, body);
}

/** 점수·Top3 — 막대와 항목은 blocksJson.block5 / block1.top3 */
function scoreSlide(copy: SlideCopy, b: BlocksJson): string {
  const b1 = requireScored(b);
  const b5 = requireBlock(b.block5, '점수');
  const bars = (Object.keys(GROUP_LABELS) as RubricGroup[])
    .map((g) => {
      const pct = b5.groupScores[g] ?? 0;
      return [
        '<div class="bar">',
        `<span class="lb">${escapeHtml(GROUP_LABELS[g])}</span>`,
        `<span class="tr"><i style="width:${pct}%"></i></span>`,
        `<span class="pc">${pct}%</span>`,
        '</div>',
      ].join('');
    })
    .join('');
  const top3 = b1.top3
    .map((t, i) => `<li><b>${i + 1}. ${escapeHtml(t.itemId)}</b> ${escapeHtml(t.title)} — ${t.score}점</li>`)
    .join('');
  const body = [
    `<div class="bars">${bars}</div>`,
    top3 ? `<p class="h3">최우선 재설계 Top 3</p><ol class="top3">${top3}</ol>` : '',
  ].join('');
  return slide(copy, body);
}

/** 포지셔닝·USP 재정의(브랜드 덱 전용) — 표는 blocksJson.block2.uspTable */
function positioningSlide(copy: SlideCopy, b: BlocksJson): string {
  const rows = b.block2.uspTable
    .slice(0, 4)
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.krAppeal)}</td><td>${escapeHtml(r.jpReading)}</td><td class="pr">${escapeHtml(r.redefinedUsp)}</td></tr>`,
    )
    .join('');
  const body = rows
    ? [
        '<table class="t">',
        '<thead><tr><th>현재(KR) 소구</th><th>일본 고객에게 읽히는 방식</th><th>재정의된 구매 이유</th></tr></thead>',
        `<tbody>${rows}</tbody>`,
        '</table>',
      ].join('')
    : '';
  return slide(copy, body);
}

/** 약기법 리스크 — 건수는 blocksJson.block3.summary */
function riskSlide(copy: SlideCopy, b: BlocksJson): string {
  const b3 = requireBlock(b.block3, '약기법 리스크');
  const s = b3.summary;
  const total = b3.sentences.length;
  const stats = [
    `<div class="st ng"><span class="n">${s.ngCount}</span><span class="l">불가</span></div>`,
    `<div class="st cd"><span class="n">${s.conditionalCount}</span><span class="l">조건부</span></div>`,
    `<div class="st ok"><span class="n">${s.okCount}</span><span class="l">가능</span></div>`,
  ].join('');
  const worst = b3.sentences.find((x) => x.sentenceId === s.highestRiskId);
  const body = [
    `<p class="h3">총 ${total}개 문장</p>`,
    `<div class="stats">${stats}</div>`,
    worst
      ? [
          '<div class="quote">',
          `<span class="tag">최고위험 ${escapeHtml(worst.sentenceId)}</span>`,
          `<p>${escapeHtml(worst.originalText)}</p>`,
          worst.altTextJa ? `<p class="alt" lang="ja">${escapeHtml(worst.altTextJa)}</p>` : '',
          '</div>',
        ].join('')
      : '',
    `<p class="fine">${escapeHtml(b3.disclaimer)}</p>`,
  ].join('');
  return slide(copy, body);
}

/** 벤치마크 — 표본 수·대비행은 blocksJson.block4. 브랜드 덱에서는 "내 콘텐츠" 칸이 전부 '미확인' */
function benchmarkSlide(copy: SlideCopy, b: BlocksJson): string {
  const rows = b.block4.comparisonRows
    .slice(0, 5)
    .map((r) => {
      // 3분기: 관찰됨(녹) / 미관찰(적 — 찾아봤는데 없었다) / 미확인(중립 — 찾아본 적 없다)
      const cls = r.customerStatus === '관찰됨' ? 'ok' : r.customerStatus === '미확인' ? 'na' : 'ng';
      return [
        '<tr>',
        `<td>${escapeHtml(r.device)}</td>`,
        `<td lang="ja">${escapeHtml(r.corpusExample)}</td>`,
        `<td class="${cls}">${escapeHtml(r.customerStatus)}</td>`,
        '</tr>',
      ].join('');
    })
    .join('');
  const caption =
    b.meta.mode === 'brand'
      ? `라쿠텐 상세 ${b.block4.sampleCount}건 실측 — 고객 콘텐츠 대비는 콘텐츠 제출 후 산출`
      : `라쿠텐 상세 ${b.block4.sampleCount}건 실측 대비`;
  const body = [
    `<p class="h3">${escapeHtml(caption)}</p>`,
    rows
      ? [
          '<table class="t">',
          '<thead><tr><th>신뢰 장치</th><th>일본 상위 제품</th><th>내 콘텐츠</th></tr></thead>',
          `<tbody>${rows}</tbody>`,
          '</table>',
        ].join('')
      : '',
  ].join('');
  return slide(copy, body);
}

/** 비포·애프터 — 문장은 blocksJson.block7.rewrites[0] */
function beforeAfterSlide(copy: SlideCopy, b: BlocksJson): string {
  const rw = requireBlock(b.block7, '비포·애프터').rewrites[0];
  const body = rw
    ? [
        '<div class="ba">',
        `<div class="be"><span class="k">Before</span><p>${escapeHtml(rw.beforeKr)}</p></div>`,
        `<div class="af"><span class="k">After</span><p lang="ja">${escapeHtml(rw.afterJa)}</p>`,
        `<p class="kr">${escapeHtml(rw.afterKr)}</p></div>`,
        '</div>',
      ].join('')
    : '<p class="fine">재작성 결과가 없습니다.</p>';
  return slide(copy, body);
}

/** 다음 단계 — 가격표는 blocksJson.block9.funnel */
function nextStepSlide(copy: SlideCopy, b: BlocksJson): string {
  const rows = b.block9.funnel
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.step)}</td><td class="pr">${escapeHtml(f.price)}</td><td>${escapeHtml(f.note)}</td></tr>`,
    )
    .join('');
  const body = rows
    ? `<table class="t"><thead><tr><th>단계</th><th>가격</th><th>내용</th></tr></thead><tbody>${rows}</tbody></table>`
    : '';
  return slide(copy, body);
}

/** 키 → 렌더러 — 덱에 어떤 장이 존재하는지는 slideKeysFor(모드)가 결정한다(스펙 §10.4) */
const RENDERERS: Record<SlideKey, (copy: SlideCopy, b: BlocksJson) => string> = {
  cover: coverSlide,
  conclusion: conclusionSlide,
  score: scoreSlide,
  positioning: positioningSlide,
  risk: riskSlide,
  benchmark: benchmarkSlide,
  beforeAfter: beforeAfterSlide,
  nextStep: nextStepSlide,
};

const STYLE = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Hiragino Sans","Noto Sans JP",sans-serif;background:#000;color:${T.ink};-webkit-font-smoothing:antialiased}
.deck{position:relative;width:100vw;height:100vh;overflow:hidden}
@media(min-width:769px){.deck{max-width:calc(100vh*16/9);max-height:calc(100vw*9/16);margin:auto;position:absolute;inset:0}}
.s{position:absolute;inset:0;background:${T.canvas};display:flex;align-items:center;justify-content:center;padding:6vh 6vw;opacity:0;visibility:hidden;transition:opacity .25s;overflow:hidden}
.s.on{opacity:1;visibility:visible}
.in{width:100%;max-width:900px;max-height:100%;overflow:hidden}
h1{font-size:clamp(26px,3.6vw,46px);font-weight:800;letter-spacing:-.03em;line-height:1.2}
h2{font-size:clamp(20px,2.6vw,34px);font-weight:800;letter-spacing:-.02em;line-height:1.25}
.eyebrow{font-size:12px;font-weight:700;color:${T.primaryStrong};letter-spacing:.08em;margin-bottom:12px}
.lead{font-size:clamp(13px,1.4vw,17px);color:${T.body};margin-top:12px;line-height:1.65;max-width:46em}
.h3{font-size:12.5px;font-weight:700;color:${T.mute};margin-top:20px}
.b{margin-top:18px;padding-left:16px;list-style:none}
.b li{position:relative;font-size:clamp(12px,1.2vw,14.5px);color:${T.body};line-height:1.6;padding-left:12px;margin-top:7px}
.b li:before{content:"";position:absolute;left:0;top:.6em;width:4px;height:4px;border-radius:50%;background:${T.primary}}
.cover .meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 28px;margin-top:26px;border-top:1px solid ${T.line};padding-top:18px}
.cover .meta dt{font-size:11px;color:${T.mute};font-weight:600}
.cover .meta dd{font-size:14px;font-weight:600;margin-top:2px}
.score{margin-top:24px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.score .n{font-size:clamp(56px,8vw,104px);font-weight:800;letter-spacing:-.04em;line-height:1;color:${T.primaryStrong}}
.score .d{font-size:20px;font-weight:600;color:${T.mute}}
.score .cap{font-size:11.5px;color:${T.mute};margin-left:8px}
.bars{margin-top:20px;display:flex;flex-direction:column;gap:9px}
.bar{display:flex;align-items:center;gap:12px;font-size:12.5px}
.bar .lb{width:112px;flex-shrink:0;font-weight:600}
.bar .tr{flex:1;height:9px;background:#f2f3f5;border-radius:999px;overflow:hidden}
.bar .tr i{display:block;height:100%;background:${T.primary};border-radius:999px}
.bar .pc{width:42px;text-align:right;font-variant-numeric:tabular-nums;color:${T.mute}}
.top3{margin-top:8px;padding-left:18px;font-size:13px;color:${T.body};line-height:1.75}
.stats{display:flex;gap:10px;margin-top:12px}
.st{flex:1;border-radius:10px;padding:12px 14px;text-align:center}
.st .n{display:block;font-size:30px;font-weight:800;line-height:1}
.st .l{font-size:11px;font-weight:600}
.st.ng{background:${T.errorBg};color:${T.error}}
.st.cd{background:${T.warnBg};color:${T.warn}}
.st.ok{background:${T.safeBg};color:${T.safe}}
.quote{margin-top:16px;border-left:2px solid ${T.primary};padding:2px 0 2px 14px}
.quote .tag{font-size:10.5px;font-weight:700;color:${T.error};background:${T.errorBg};border-radius:4px;padding:2px 7px}
.quote p{font-size:14px;margin-top:7px;color:${T.ink}}
.quote .alt{font-size:13px;color:${T.safe};background:${T.safeBg};border-radius:6px;padding:8px 10px;margin-top:8px}
.t{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:12px}
.t th{text-align:left;font-size:11px;color:${T.mute};font-weight:700;border-bottom:1px solid #cfd4dc;padding:7px 8px}
.t td{padding:8px;border-bottom:1px solid ${T.line};vertical-align:top;color:${T.body}}
.t td.ok{color:${T.safe};font-weight:700}
.t td.ng{color:${T.error};font-weight:700}
.t td.na{color:${T.mute};font-weight:600}
.t td.pr{font-weight:700;color:${T.ink};white-space:nowrap}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}
.ba>div{border-radius:10px;padding:14px}
.ba .k{font-size:10.5px;font-weight:700;letter-spacing:.04em}
.ba .be{background:#f6f6f6}
.ba .be .k{color:${T.error}}
.ba .be p{text-decoration:line-through;text-decoration-color:#b6bac1;color:${T.mute};font-size:13.5px;margin-top:6px}
.ba .af{background:${T.tint}}
.ba .af .k{color:${T.safe}}
.ba .af p{font-size:14px;font-weight:600;margin-top:6px}
.ba .af .kr{font-size:12px;font-weight:400;color:${T.body};margin-top:8px;line-height:1.6}
.fine{font-size:10.5px;color:${T.mute};margin-top:14px;line-height:1.55}
.nav{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;z-index:9}
.nav button{width:30px;height:30px;border:0;border-radius:50%;background:rgba(0,0,0,.28);color:#fff;font-size:14px;cursor:pointer;line-height:1}
.nav button:hover{background:rgba(0,0,0,.5)}
.nav .c{font-size:11px;color:rgba(0,0,0,.45);font-variant-numeric:tabular-nums}
.pg{position:fixed;top:0;left:0;width:100%;height:2px;background:${T.primary};z-index:9;transform:scaleX(0);transform-origin:0 50%;transition:transform .25s}
@media print{.nav,.pg{display:none}.deck{max-width:none;max-height:none;position:static;width:auto;height:auto}.s{position:static;opacity:1;visibility:visible;page-break-after:always;min-height:100vh}}
@media(max-width:768px){.ba{grid-template-columns:1fr}.cover .meta{grid-template-columns:1fr}}
`.trim();

const SCRIPT = `
var i=0,S=document.querySelectorAll('.s'),N=S.length;
function go(n){i=Math.max(0,Math.min(N-1,n));for(var k=0;k<N;k++)S[k].classList.toggle('on',k===i);
document.getElementById('c').textContent=(i+1)+' / '+N;
document.getElementById('p').style.transform='scaleX('+((i+1)/N)+')';}
document.addEventListener('keydown',function(e){
if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();go(i+1)}
if(e.key==='ArrowLeft'){e.preventDefault();go(i-1)}});
go(0);
`.trim();

/**
 * 덱 spec + blocksJson → 단일 HTML 문자열.
 * @param spec 콜⑤가 쓴 카피 (숫자 없음)
 * @param blocks 리포트 원본 — 모든 수치의 출처
 */
export function renderDeckHtml(spec: DeckSpec, blocks: BlocksJson): string {
  const title = `${blocks.block0.brandName} 일본 진출 진단 — 보고용`;
  const keys = slideKeysFor(blocks.meta.mode);
  const slides = keys
    .map((key) => {
      const copy = spec[key];
      if (!copy) throw new Error(`슬라이드 카피 누락: ${key} — 콜⑤ 검증을 통과했다면 도달 불가`);
      return RENDERERS[key](copy, blocks);
    })
    .join('\n');

  const mockNote = blocks.meta.llmMode === 'mock'
    ? '<p class="fine" style="position:fixed;top:8px;left:12px;z-index:9">목(mock) 모드 — 판정은 데모용입니다</p>'
    : '';

  return [
    '<!doctype html>',
    '<html lang="ko">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    '<div class="pg" id="p"></div>',
    `<div class="deck">${slides}</div>`,
    mockNote,
    '<div class="nav">',
    '<button type="button" onclick="go(i-1)" aria-label="이전">←</button>',
    `<span class="c" id="c">1 / ${keys.length}</span>`,
    '<button type="button" onclick="go(i+1)" aria-label="다음">→</button>',
    '</div>',
    `<script>${SCRIPT}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}
