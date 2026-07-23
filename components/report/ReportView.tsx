'use client';

/**
 * 리포트 열람 — 5탭 구조(디자인 정본: docs/specs/01-report/3-report.html).
 * 데이터 바인딩은 전부 blocksJson(lib/engine/types.ts BlocksJson)이다 — 화면 표시 순서만
 * 재배열하고 블록 번호·null 분기 의미(=데이터 잠금, 증거 원칙)는 그대로 보존한다.
 * 탭: ①진단 요약 ②일본 시장 ③리스크 진단 ④고객·전략 ⑤처방·다음 단계.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { buttonClass, cardClass, StatusBadge } from '@/components/ui/primitives';
import type { AuditVerdict, BlocksJson, RewriteResult, RubricGroup, RubricItemId } from '@/lib/engine/types';

/** 3탭 하이브리드(REPORT-14) — 블록0·1은 탭 위 상단 고정, 본문만 3탭으로 */
const TAB_LABELS = ['시장', '진단', '처방'];

const GROUP_ORDER: RubricGroup[] = ['A', 'B', 'C', 'D', 'E'];
const GROUP_LABELS: Record<RubricGroup, string> = {
  A: '신뢰 구축',
  B: '무첨가·안전',
  C: '서사 구조',
  D: '성분 프레이밍',
  E: '카테고리 적합성',
};

const VERDICT_BADGE: Record<AuditVerdict, string> = {
  불가: 'bg-danger-bg text-danger-text',
  조건부: 'bg-amber-bg text-amber-text',
  가능: 'bg-green-bg text-green-text',
};

/** RubricItemId(예: "A1")의 앞 글자로 소속 그룹을 역산한다 — top3에는 group 필드가 없어서 필요 */
function itemGroupOf(itemId: RubricItemId): RubricGroup {
  return itemId[0] as RubricGroup;
}

const CIRCLED_DIGITS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
/** 1-based 순번 → 원문자(①…⑳). 약기법 문장은 화면에서 K-id 대신 이 순번으로만 표기한다(라벨 정책) */
function circledNumber(n: number): string {
  return n >= 1 && n <= CIRCLED_DIGITS.length ? CIRCLED_DIGITS[n - 1] : String(n);
}

type Band = 'danger' | 'warn' | 'ok';
const BAND_LABEL: Record<Band, string> = { danger: '위험', warn: '미흡', ok: '양호' };
const BAND_BADGE: Record<Band, string> = {
  danger: 'bg-danger-bg text-danger-text',
  warn: 'bg-amber-bg text-amber-text',
  ok: 'bg-green-bg text-green-text',
};
const BAND_BAR: Record<Band, string> = { danger: 'bg-danger', warn: 'bg-amber', ok: 'bg-green' };

/**
 * 그룹 점수(%) → 위험/미흡/양호 — 블록5(A~E 상세 표)에서만 쓰는 화면 보조 밴딩이다.
 * 종합점수(블록1) 자체의 시급/보완/양호 라벨은 임계값 근거 부족으로 표기하지 않는다(스펙 REPORT-04) —
 * 혼동하지 않도록 이 밴딩은 그룹별 상세 막대에만 적용한다.
 */
function scoreBand(score: number): Band {
  if (score < 20) return 'danger';
  if (score < 60) return 'warn';
  return 'ok';
}

/** 데이터 잠금 카드(브랜드 진단) — 산출하지 않은 것을 빈 값·0건으로 위장하지 않는다(증거 원칙) */
function LockedCard({ title, body, hint }: { title: string; body: string; hint?: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-input-border bg-n-50 p-5 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
        <StatusBadge tone="off">잠김</StatusBadge>
        {title}
      </p>
      <p className="mt-2 leading-relaxed text-ink-mute">{body}</p>
      {hint && <p className="mt-1.5 leading-relaxed text-ink-mute">{hint}</p>}
    </div>
  );
}

/** 4타일 통계(감사 문장·불가·조건부·신뢰 장치 관찰) 공용 타일 */
function StatTile({ value, label, tone }: { value: React.ReactNode; label: string; tone?: 'danger' | 'amber' }) {
  const toneCls = tone === 'danger' ? 'bg-danger-bg text-danger-text' : tone === 'amber' ? 'bg-amber-bg text-amber-text' : 'bg-n-50 text-ink';
  return (
    <div className={`rounded-[12px] p-3.5 ${toneCls}`}>
      <p className="tnum text-2xl leading-none font-extrabold">{value}</p>
      <p className="mt-1.5 text-[11.5px] font-semibold">{label}</p>
    </div>
  );
}

interface DonutSegment {
  value: number;
  className: string;
}

/**
 * 범용 스택 도넛 SVG — 종합점수(1구간)·약기법 판정 분포(3구간) 공용.
 * angle을 map 콜백에서 순차 누적한다 — Array.prototype.map은 인덱스 오름차순으로 실행되므로
 * 매 렌더 결정적이다(부작용이지만 이 leaf 컴포넌트 밖으로 새지 않는다).
 */
function DonutChart({
  segments,
  total,
  size = 150,
  radius = 54,
  strokeWidth = 18,
  rounded = false,
  ariaLabel,
  centerLabel,
  centerSub,
}: {
  segments: DonutSegment[];
  total: number;
  size?: number;
  radius?: number;
  strokeWidth?: number;
  rounded?: boolean;
  ariaLabel?: string;
  centerLabel: React.ReactNode;
  centerSub?: React.ReactNode;
}) {
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -90;
  return (
    <div
      className="relative flex-none"
      style={{ width: size, height: size }}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden focusable="false">
        <circle cx={cx} cy={cy} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-n-150" />
        {total > 0 &&
          segments.map((seg, i) => {
            if (seg.value <= 0) return null;
            const frac = seg.value / total;
            const dash = frac * circumference;
            const node = (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap={rounded ? 'round' : 'butt'}
                strokeDasharray={`${dash} ${circumference - dash}`}
                transform={`rotate(${angle} ${cx} ${cy})`}
                className={seg.className}
              />
            );
            angle += frac * 360;
            return node;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerLabel}
        {centerSub}
      </div>
    </div>
  );
}

/** 종합점수 도넛(블록1) */
function ScoreDonut({ score }: { score: number }) {
  return (
    <DonutChart
      size={200}
      radius={78}
      strokeWidth={16}
      rounded
      segments={[{ value: score, className: 'stroke-coral' }]}
      total={100}
      ariaLabel={`일본 상세 관례 충족도 ${score}점 / 100점`}
      centerLabel={<span className="tnum text-[52px] leading-none font-extrabold tracking-[-0.04em] text-ink">{score}</span>}
      centerSub={<span className="mt-1 text-[13px] font-bold text-ink-faint">/ 100</span>}
    />
  );
}

/** 영역별 충족도 레이더(A~E, 5축) — 점선은 일본 상위 제품 관례 수준(80%) 기준선 */
function RadarChart({ groupScores }: { groupScores: Record<RubricGroup, number> }) {
  const cx = 160;
  const cy = 120;
  const maxR = 78;
  const angleAt = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / GROUP_ORDER.length;
  const pointAt = (i: number, r: number): [number, number] => {
    const a = angleAt(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const polygonAt = (r: (i: number) => number) => GROUP_ORDER.map((_, i) => pointAt(i, r(i)).join(',')).join(' ');
  const valuePolygon = polygonAt((i) => (maxR * (groupScores[GROUP_ORDER[i]] ?? 0)) / 100);
  const refPolygon = polygonAt(() => maxR * 0.8);

  return (
    <svg
      viewBox="0 0 320 240"
      className="mx-auto mt-3 block w-full max-w-[380px]"
      role="img"
      aria-label={`영역별 충족도 레이더 차트: ${GROUP_ORDER.map((g) => `${GROUP_LABELS[g]} ${groupScores[g] ?? 0}%`).join(', ')} — 일본 상위 제품 관례 수준 80% 대비`}
    >
      {[0.25, 0.5, 0.75, 1].map((lvl) => (
        <polygon key={lvl} points={polygonAt(() => maxR * lvl)} fill="none" className="stroke-n-200" strokeWidth={1} />
      ))}
      {GROUP_ORDER.map((_, i) => {
        const [x, y] = pointAt(i, maxR);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-n-200" strokeWidth={1} />;
      })}
      <polygon points={refPolygon} fill="none" className="stroke-ink-faint" strokeWidth={1.5} strokeDasharray="4 4" />
      <polygon points={valuePolygon} fill="rgba(255,100,100,.22)" className="stroke-coral" strokeWidth={2} strokeLinejoin="round" />
      {GROUP_ORDER.map((g, i) => {
        const [x, y] = pointAt(i, (maxR * (groupScores[g] ?? 0)) / 100);
        return <circle key={g} cx={x} cy={y} r={3} className="fill-coral" />;
      })}
      {GROUP_ORDER.map((g, i) => {
        const [x, y] = pointAt(i, maxR + 34);
        return (
          <text key={g} x={x} y={y} textAnchor="middle" fontSize={11} fontWeight={700} className="fill-ink">
            {GROUP_LABELS[g]} {groupScores[g] ?? 0}%
          </text>
        );
      })}
    </svg>
  );
}

// ── 탭2(일본 시장) 정적 에디토리얼 — 모든 리포트 공통, LLM/blocksJson 무관(REPORT-15) ──────

const MARKET_CALLOUTS: { title: string; desc: React.ReactNode }[] = [
  {
    title: '주장하지 말고, 근거로 팔 것',
    desc: (
      <>
        <span lang="ja">効能評価試験済み</span>·배합률·<span lang="ja">集計日</span> 있는 실적 — 검증 장치가 소구를
        대신합니다.
      </>
    ),
  },
  {
    title: '절제가 곧 신뢰다',
    desc: (
      <>
        ※각주로 주장 범위를 스스로 좁힙니다. 과장·즉효 단정은 신뢰를 깎고 <span lang="ja">薬機法</span> 위반이 됩니다.
      </>
    ),
  },
  {
    title: '플랫폼 문법을 지킬 것',
    desc: '아마존=클린 단독컷, 라쿠텐=신뢰 배지, Qoo10=프로모 문법 — 채널마다 다른 썸네일로 팝니다.',
  },
];

const MARKET_PATTERNS: { img: string; alt: string; title: string; quote: React.ReactNode; source: React.ReactNode }[] = [
  {
    img: '/report-assets/pattern-trust_fujifilm_8.jpg',
    alt: '아스타리프트 상세 컷 — 효능 문장 끝에 効能評価試験済み 라벨과 조건 각주',
    title: '효능은 근거 라벨 + 조건 각주로',
    quote: (
      <span lang="ja">
        「乾燥による小じわを目立たなくします（<b>効能評価試験済み</b>）」
      </span>
    ),
    source: (
      <>
        출처: <span lang="ja">楽天</span> · アスタリフト(FUJIFILM) · 2026-07 수집 · 분석 목적 인용
      </>
    ),
  },
  {
    img: '/report-assets/pattern-thirdparty_tvert_1.jpg',
    alt: 'TOUT VERT 상세 컷 — 랭킹 1위 위젯을 集計日 명기와 함께 보여준다',
    title: '실적은 집계일 있는 제3자 지표로',
    quote: (
      <span lang="ja">
        「ランキング1位（<b>集計日：5月11日〜5月17日</b>）」
      </span>
    ),
    source: (
      <>
        출처: <span lang="ja">楽天</span> · TOUT VERT · 2026-07 수집 · 분석 목적 인용
      </>
    ),
  },
  {
    img: '/report-assets/pattern-free_fancl_4.jpg',
    alt: 'FANCL 상세 컷 — 5종 프리 처방을 원형 배지로 나열',
    title: '무첨가는 라벨로 세어 보여준다',
    quote: (
      <>
        <span lang="ja">防腐剤・合成香料・合成色素</span> 등 뺀 것을 5개 배지로 나열
      </>
    ),
    source: (
      <>
        출처: <span lang="ja">楽天</span> · ファンケル(FANCL) · 2026-07 수집 · 분석 목적 인용
      </>
    ),
  },
];

const THUMB_DIST: { label: string; pct: number }[] = [
  { label: '클린 단독컷', pct: 33 },
  { label: '텍스처 스와치', pct: 15 },
  { label: '프로모션 강조', pct: 15 },
  { label: '모델+카피', pct: 13 },
  { label: '공식샵 배지', pct: 12 },
  { label: '프리미엄 무드', pct: 11 },
  { label: '카피+성분', pct: 7 },
  { label: '수상 스택', pct: 5 },
];

/**
 * 스티키 탭 내비(REPORT-14) — role="tablist" ARIA 탭 패턴 + roving tabindex + 좌우/Home/End 키.
 * navRef는 상단 고정 요약 아래 스티키 위치(tabsStickTop) 계산에 쓰인다(스크롤 클램프).
 */
function TabNav({
  active,
  onChange,
  navRef,
}: {
  active: number;
  onChange: (i: number) => void;
  navRef: React.RefObject<HTMLElement | null>;
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    let next = active;
    if (e.key === 'ArrowRight') next = (active + 1) % TAB_LABELS.length;
    else if (e.key === 'ArrowLeft') next = (active - 1 + TAB_LABELS.length) % TAB_LABELS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TAB_LABELS.length - 1;
    else return;
    e.preventDefault();
    onChange(next);
    navRef.current?.querySelector<HTMLButtonElement>(`#report-tab-${next}`)?.focus();
  }
  return (
    <nav
      ref={navRef}
      aria-label="리포트 구간 이동"
      role="tablist"
      onKeyDown={onKeyDown}
      className="sticky top-0 z-40 mt-6 flex gap-1 overflow-x-auto rounded-[14px] border border-card-border bg-canvas/95 p-1.5 shadow-nav backdrop-blur"
    >
      {TAB_LABELS.map((label, i) => {
        const on = i === active;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            id={`report-tab-${i}`}
            aria-selected={on}
            aria-controls={`report-tabpanel-${i}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(i)}
            className={`flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[10px] px-3.5 text-[13.5px] whitespace-nowrap transition-colors ${
              on ? 'bg-coral font-bold text-white' : 'font-semibold text-ink-body hover:bg-n-100'
            }`}
          >
            <b aria-hidden className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold ${on ? 'bg-white/25 text-white' : 'bg-n-150 text-[#70737c]'}`}>
              {i + 1}
            </b>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

/** 블록0 — 품의용 요약 표지(탭1 최상단 소형 카드) */
function CoverSummaryCard({ block0 }: { block0: BlocksJson['block0'] }) {
  return (
    <section className={cardClass('mt-5 p-7')}>
      <p className="text-[11px] font-semibold text-ink-faint">블록 0 · 품의용 요약 표지</p>
      <dl className="mt-2.5 grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
        <div><dt className="inline font-bold text-ink">브랜드 </dt><dd className="inline text-ink-body">{block0.brandName}</dd></div>
        <div><dt className="inline font-bold text-ink">제품 </dt><dd className="inline text-ink-body">{block0.productName}</dd></div>
        <div><dt className="inline font-bold text-ink">카테고리 </dt><dd className="inline text-ink-body">{block0.categoryLabel}</dd></div>
        <div><dt className="inline font-bold text-ink">제품 분류 </dt><dd className="inline text-ink-body">{block0.productClassLabel}</dd></div>
        <div><dt className="inline font-bold text-ink">가격 </dt><dd className="inline text-ink-body">{block0.priceLabel}</dd></div>
        <div><dt className="inline font-bold text-ink">발행일 </dt><dd className="inline text-ink-body">{block0.issuedAt}</dd></div>
        <div className="sm:col-span-2"><dt className="inline font-bold text-ink">진단 범위 </dt><dd className="inline text-ink-body">{block0.scope}</dd></div>
        <div className="sm:col-span-2"><dt className="inline font-bold text-ink">한계 요약 </dt><dd className="inline text-ink-body">{block0.limitSummary}</dd></div>
      </dl>
    </section>
  );
}

// ══════════ 상단 고정 — 블록 1 진단 요약 헤더(REPORT-04, 탭 무관 상시 노출) ══════════

function Block1Header({ b, onDeepLink }: { b: BlocksJson; onDeepLink: (itemId: string) => void }) {
  const block1 = b.block1;
  const observed = b.block4.comparisonRows.filter((r) => r.customerStatus === '관찰됨').length;
  const totalDevices = b.block4.comparisonRows.length;

  return (
    <>
      <section className={cardClass('mt-4 p-9')}>
        <p className="text-[11px] font-semibold text-ink-faint">블록 1</p>
        {block1.scored ? (
          <div className="grid items-center gap-9 sm:grid-cols-[200px_1fr]">
            <ScoreDonut score={block1.overallScore} />
            <div>
              <p className="text-[13px] font-bold text-coral-strong">일본 상세 관례 충족도</p>
              <p className="mt-2.5 max-w-2xl leading-[1.75] whitespace-pre-line text-ink-body [text-wrap:pretty]">
                {block1.summaryText}
              </p>
              <p className="mt-2 text-xs text-ink-mute">종합점수는 성과 예측이 아니라 &ldquo;일본 상세 관례 충족도&rdquo;입니다.</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {block1.trustBadges.map((badge) => (
                  <li key={badge} className="rounded-full border border-input-border px-2.5 py-1 text-xs text-ink-mute">{badge}</li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <StatTile value={b.block3?.sentences.length ?? '—'} label="감사한 문장" />
                <StatTile value={b.block3?.summary.ngCount ?? '—'} label="표현 불가" tone="danger" />
                <StatTile value={b.block3?.summary.conditionalCount ?? '—'} label="조건부" tone="amber" />
                <StatTile value={`${observed}/${totalDevices}`} label="신뢰 장치 관찰" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <LockedCard title="종합점수 없음" body={block1.lockedReason} hint={block1.unlockHint} />
            <p className="mt-4 max-w-2xl leading-[1.75] whitespace-pre-line text-ink-body">{block1.summaryText}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {block1.trustBadges.map((badge) => (
                <li key={badge} className="rounded-full border border-input-border px-2.5 py-1 text-xs text-ink-mute">{badge}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      {block1.scored && (
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className={cardClass('p-8')}>
            <h2 className="text-[17px] font-bold text-ink">영역별 충족도</h2>
            <p className="mt-1.5 text-xs text-ink-mute">점선 = 일본 상위 제품 관례 수준(80%)</p>
            <RadarChart groupScores={block1.groupScores} />
          </div>
          <div className={cardClass('flex flex-col p-8')}>
            <h2 className="text-[17px] font-bold text-ink">최우선 재설계 Top 3</h2>
            <div className="mt-4 flex flex-1 flex-col gap-2.5">
              {block1.top3.map((t, i) => (
                <button
                  key={t.itemId}
                  type="button"
                  onClick={() => onDeepLink(t.itemId)}
                  className="flex items-center gap-3.5 rounded-[12px] border border-card-border bg-canvas p-3.5 text-left transition-colors hover:border-coral"
                >
                  <span aria-hidden className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-coral text-[13px] font-extrabold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">
                      {t.title} <span className="text-danger-text">{t.score}/2점</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-mute">{GROUP_LABELS[itemGroupOf(t.itemId)]}</span>
                  </span>
                  <span aria-hidden className="text-ink-faint">→</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

// ══════════ 시장 탭 (정적 에디토리얼 · REPORT-15) ══════════

function MarketPanel() {
  const maxPct = THUMB_DIST[0].pct;
  return (
    <>
      <section className={cardClass('mt-5 p-9')}>
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">일본 시장은 이렇게 판다</h2>
        <p className="mt-2.5 max-w-[640px] text-sm leading-[1.7] text-ink-body [text-wrap:pretty]">
          일본 상위 제품 실측 — 상세페이지 304건 OCR·썸네일 948장 수집(2026-07). 여기서 본 관례가 곧 다음 탭에서 내
          브랜드를 채점하는 기준입니다.
        </p>
        <div className="mt-6 grid gap-3.5 sm:grid-cols-3">
          {MARKET_CALLOUTS.map((c, i) => (
            <div key={c.title} className="rounded-[14px] border border-coral/20 bg-coral-tint p-5">
              <span aria-hidden className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-coral text-[13px] font-extrabold text-white">
                {i + 1}
              </span>
              <p className="mt-3 text-[15px] font-bold text-ink">{c.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-body">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={cardClass('mt-4 p-9')}>
        <h2 className="text-[17px] font-bold text-ink">관례 실물 — 상위 제품 상세페이지에서 그대로</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {MARKET_PATTERNS.map((p) => (
            <article key={p.img} className="flex flex-col overflow-hidden rounded-[14px] border border-card-border">
              <div className="h-[200px] overflow-y-auto bg-n-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.img} alt={p.alt} loading="lazy" className="block h-auto w-full" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <p className="text-[13.5px] font-bold text-ink">{p.title}</p>
                <p className="text-[12.5px] leading-relaxed text-ink-body">{p.quote}</p>
                <p className="mt-auto text-[11px] text-ink-faint">{p.source}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={cardClass('mt-4 p-9')}>
        <h2 className="text-[17px] font-bold text-ink">썸네일 스타일 분포</h2>
        <p className="mt-1.5 text-xs text-ink-mute">층화 표본 120장 라벨링 (948장 수집분)</p>
        <div
          className="mt-4 flex flex-col gap-2.5"
          role="img"
          aria-label={`썸네일 스타일 분포: ${THUMB_DIST.map((d) => `${d.label} ${d.pct}%`).join(', ')}`}
        >
          {THUMB_DIST.map((d, i) => (
            <div key={d.label} className="grid grid-cols-[118px_1fr_34px] items-center gap-2.5">
              <span className={`text-[12.5px] ${i === 0 ? 'font-bold text-ink' : 'font-semibold text-ink-body'}`}>{d.label}</span>
              <span aria-hidden className="h-4 overflow-hidden rounded-[5px] bg-n-100">
                <span className={`block h-full rounded-[5px] ${i === 0 ? 'bg-coral' : 'bg-coral/55'}`} style={{ width: `${(d.pct / maxPct) * 100}%` }} />
              </span>
              <span className="tnum text-right text-xs font-bold text-ink">{d.pct}</span>
            </div>
          ))}
        </div>
        <p className="mt-3.5 text-[11.5px] text-ink-mute">분포는 층화 표본 120/948장의 추정치입니다.</p>
      </section>
    </>
  );
}

// ══════════ 탭3 · 리스크 진단 (블록 4·3·5) ══════════

/** 신뢰 장치 벤치마크 — 브랜드 진단도 "미확인" 3분기로 채워진다(데이터 잠금이 아니다) */
function BenchmarkSection({ block4 }: { block4: BlocksJson['block4'] }) {
  const observed = block4.comparisonRows.filter((r) => r.customerStatus === '관찰됨').length;
  const total = block4.comparisonRows.length;
  return (
    <section className={cardClass('mt-5 p-9')}>
      <p className="text-[11px] font-semibold text-ink-faint">블록 4</p>
      <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">
        카테고리 경쟁 벤치마크 <span className="text-base font-semibold text-ink-mute">(코퍼스 {block4.sampleCount}건 실측)</span>
      </h2>
      <p className="mt-2.5 max-w-[640px] text-sm leading-[1.7] text-ink-body">
        일본 상위 제품이 쓰는 {total}가지 신뢰 장치 대비, 내 상세 카피에서 관찰된 것은 {observed}개입니다.
      </p>
      {block4.narrative && <p className="mt-3 text-sm text-ink-body">{block4.narrative}</p>}
      {block4.corpusQuotes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {block4.corpusQuotes.map((q) => (
            <li key={q.device}>
              <span className="font-semibold text-ink">{q.device}: </span>
              <span lang="ja" className="text-ink-body">「{q.quote}」</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th scope="col" className="rounded-l-[8px] bg-n-100 px-3.5 py-2.5 text-left text-xs font-bold text-ink-body">신뢰 장치</th>
              <th scope="col" className="bg-n-100 px-3.5 py-2.5 text-left text-xs font-bold text-ink-body">일본 상위 제품 실제 표현</th>
              <th scope="col" className="bg-n-100 px-3.5 py-2.5 text-center text-xs font-bold text-ink-body">내 콘텐츠</th>
              <th scope="col" className="rounded-r-[8px] bg-n-100 px-3.5 py-2.5 text-left text-xs font-bold text-ink-body">갭</th>
            </tr>
          </thead>
          <tbody>
            {block4.comparisonRows.map((row) => (
              <tr key={row.device} className="border-b border-n-150 align-top">
                <td className="px-3.5 py-3 font-bold text-ink">{row.device}</td>
                <td lang="ja" className="px-3.5 py-3 text-ink-body">{row.corpusExample}</td>
                <td className="px-3.5 py-3 text-center">
                  <span
                    className={`inline-flex h-6.5 items-center gap-1 rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${
                      row.customerStatus === '관찰됨'
                        ? 'bg-green-bg text-green-text'
                        : row.customerStatus === '미확인'
                          ? 'bg-n-150 text-ink-mute'
                          : 'bg-danger-bg text-danger-text'
                    }`}
                  >
                    {row.customerStatus === '관찰됨' ? '○ 관찰됨' : row.customerStatus === '미확인' ? '— 미확인' : '✕ 미관찰'}
                  </span>
                </td>
                <td className="px-3.5 py-3 leading-relaxed text-ink-mute">{row.gapNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block4.searchTermRows.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-bold text-ink">일본 검색·고민 어휘 (빈도 실측)</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {block4.searchTermRows.map((t) => (
              <li key={t.term} className="rounded-full border border-input-border px-2.5 py-1 text-xs">
                <span lang="ja" className="font-semibold text-ink">{t.term}</span> <span className="text-ink-mute">{t.frequency}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** 薬機法 전수 감사(블록3) — null이면 데이터 잠금 카드 */
function AuditSection({ block3, productClassAssumed }: { block3: BlocksJson['block3']; productClassAssumed: boolean }) {
  return (
    <section className={cardClass('mt-4 p-9')}>
      <p className="text-[11px] font-semibold text-ink-faint">블록 3</p>
      <h2 className="text-[17px] font-bold text-ink"><span lang="ja">薬機法</span> 표현 전수 감사</h2>
      {block3 === null ? (
        <div className="mt-4">
          <LockedCard
            title="薬機法 표현 전수 감사"
            body="감사 대상 문장이 없어 산출하지 않았습니다(브랜드 진단)."
            hint="상세페이지 카피를 넣으면 문장별 불가/조건부/가능 판정과 조항 각주·합법 대체 표현이 열립니다."
          />
        </div>
      ) : (
        <>
          {productClassAssumed && (
            <p className="mt-2.5 rounded-[8px] bg-amber-bg p-2.5 text-xs text-amber-text">
              △ 제품 분류 미확인 — 화장품으로 가정해 진단했습니다.
            </p>
          )}
          <p className="mt-3 rounded-[10px] bg-n-50 p-3 text-sm text-ink-body">{block3.gradeNote}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th scope="col" className="rounded-l-[8px] bg-n-100 px-3.5 py-2.5 text-left text-xs font-bold text-ink-body" lang="ja">등급</th>
                  <th scope="col" className="bg-n-100 px-3.5 py-2.5 text-left text-xs font-bold text-ink-body">말할 수 있는 것</th>
                  <th scope="col" className="rounded-r-[8px] bg-n-100 px-3.5 py-2.5 text-left text-xs font-bold text-ink-body">말할 수 없는 것</th>
                </tr>
              </thead>
              <tbody>
                {block3.gradeRows.map((g) => (
                  <tr key={g.grade} className="border-b border-n-150 align-top">
                    <td className="px-3.5 py-3 font-bold text-ink" lang="ja">{g.grade}</td>
                    <td className="px-3.5 py-3 text-ink-body">{g.canSay}</td>
                    <td className="px-3.5 py-3 text-ink-body">{g.cannotSay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-7">
            <DonutChart
              size={150}
              radius={54}
              strokeWidth={18}
              ariaLabel={`판정 분포: 불가 ${block3.summary.ngCount}문장, 조건부 ${block3.summary.conditionalCount}문장, 가능 ${block3.summary.okCount}문장`}
              segments={[
                { value: block3.summary.ngCount, className: 'stroke-danger' },
                { value: block3.summary.conditionalCount, className: 'stroke-amber' },
                { value: block3.summary.okCount, className: 'stroke-green' },
              ]}
              total={block3.sentences.length}
              centerLabel={<span className="tnum text-2xl font-extrabold text-ink">{block3.sentences.length}</span>}
              centerSub={<span className="text-[11px] font-bold text-ink-faint">문장</span>}
            />
            <div className="flex flex-col gap-2.5 text-[13.5px]">
              <p><span aria-hidden className="mr-2 inline-block h-3 w-3 rounded-[4px] bg-danger align-middle" /><b className="text-ink">불가 {block3.summary.ngCount}</b> <span className="text-ink-mute">그대로 게재 불가</span></p>
              <p><span aria-hidden className="mr-2 inline-block h-3 w-3 rounded-[4px] bg-amber align-middle" /><b className="text-ink">조건부 {block3.summary.conditionalCount}</b> <span className="text-ink-mute">각주·한정 필요</span></p>
              <p><span aria-hidden className="mr-2 inline-block h-3 w-3 rounded-[4px] bg-green align-middle" /><b className="text-ink">가능 {block3.summary.okCount}</b> <span className="text-ink-mute">그대로 쓸 수 있는 문장</span></p>
            </div>
          </div>

          <div
            className="mt-5 flex flex-wrap gap-1.5"
            role="img"
            aria-label={`문장별 판정: ${block3.sentences.map((s, i) => `${circledNumber(i + 1)} ${s.verdict}`).join(', ')}`}
          >
            {block3.sentences.map((s, i) => (
              <span
                key={s.sentenceId}
                aria-hidden
                className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-sm font-bold ${
                  s.sentenceId === block3.summary.highestRiskId ? 'bg-danger text-white' : VERDICT_BADGE[s.verdict]
                }`}
              >
                {circledNumber(i + 1)}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-ink-mute">채운 붉은 칸 = 최고위험 문장</p>

          <div className="mt-6 space-y-3">
            {block3.sentences.map((s, i) => (
              <article
                key={s.sentenceId}
                id={`audit-${s.sentenceId}`}
                className={`rounded-[14px] border p-4 text-sm ${
                  s.verdict === '불가' ? 'border-danger/35' : s.verdict === '조건부' ? 'border-amber/40' : 'border-card-border'
                }`}
              >
                <header className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-ink">문장 {circledNumber(i + 1)}</span>
                  <span className={`inline-flex h-[23px] items-center rounded-[6px] px-2.5 text-xs font-bold ${VERDICT_BADGE[s.verdict]}`}>【{s.verdict}】</span>
                  {s.clauseRefs.length > 0 && (
                    <span className="text-xs text-ink-mute">근거 조항 {s.clauseRefs.map((r) => `[${r}]`).join('')}</span>
                  )}
                </header>
                <p className="mt-2.5 text-ink">{s.originalText}</p>
                <p className="mt-1.5 text-ink-mute">{s.reason}</p>
                {s.altTextJa && (
                  <p lang="ja" className="mt-2.5 rounded-[10px] bg-green-bg p-2.5 text-green-text">
                    <b className="font-bold">대체: </b>
                    {s.altTextJa}
                  </p>
                )}
              </article>
            ))}
          </div>
          <p className="mt-4 rounded-[10px] border border-card-border bg-n-50 p-3 text-xs text-ink-mute">{block3.disclaimer}</p>
        </>
      )}
    </section>
  );
}

/** 일본 문법 진단 점수(블록5, A~E 루브릭) — null이면 데이터 잠금 카드 */
function RubricSection({ block5 }: { block5: BlocksJson['block5'] }) {
  return (
    <section className={cardClass('mt-4 p-9')}>
      <p className="text-[11px] font-semibold text-ink-faint">블록 5</p>
      <h2 className="text-[17px] font-bold text-ink">일본 문법 진단 점수 <span className="font-normal text-ink-mute">(A~E 루브릭)</span></h2>
      {block5 === null ? (
        <div className="mt-4">
          <LockedCard
            title="일본 문법 진단 점수"
            body="채점할 &ldquo;내 문장&rdquo;이 없어 산출하지 않았습니다(브랜드 진단)."
            hint="상세페이지 카피를 넣으면 A~E 축별 채점과 통과 기준·내 문장·코퍼스 근거가 열립니다."
          />
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-xs text-ink-mute">카테고리에 해당하는 항목만 채점 — 같은 점수는 항상 같은 종합 점수로 집계됩니다</p>
          <div className="mt-5 flex flex-col gap-3.5">
            {GROUP_ORDER.map((g) => {
              const score = block5.groupScores[g];
              const band = scoreBand(score);
              return (
                <div key={g} className="grid grid-cols-[112px_1fr_92px_64px] items-center gap-3.5">
                  <span className="text-[13.5px] font-bold text-ink">{GROUP_LABELS[g]}</span>
                  <span role="img" aria-label={`${GROUP_LABELS[g]} ${score}%`} className="h-3 overflow-hidden rounded-full bg-n-100">
                    <span className={`block h-full rounded-full ${BAND_BAR[band]}`} style={{ width: `${score}%` }} />
                  </span>
                  <span className={`inline-flex h-6 items-center justify-center rounded-[6px] text-[11.5px] font-bold ${BAND_BADGE[band]}`}>
                    {BAND_LABEL[band]} · {score}%
                  </span>
                  <span className="tnum text-right text-[11.5px] text-ink-mute">가중 {block5.weights[g].toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 space-y-2">
            {block5.items.map((item) => (
              <details key={item.itemId} id={`rubric-${item.itemId}`} className="rounded-[12px] border border-card-border p-3.5 text-sm">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="flex-1 font-semibold text-ink">{item.title}</span>
                  <span
                    className={`inline-flex h-6 items-center rounded-[6px] px-2 text-xs font-bold ${
                      item.score === 2 ? 'bg-green-bg text-green-text' : item.score === 1 ? 'bg-amber-bg text-amber-text' : 'bg-danger-bg text-danger-text'
                    }`}
                  >
                    {item.score}점
                  </span>
                </summary>
                <dl className="mt-2.5 grid grid-cols-[96px_1fr] gap-x-4 gap-y-1.5 text-ink-body">
                  <dt className="text-xs font-bold text-ink-mute">통과 기준</dt>
                  <dd>{item.criterion}</dd>
                  <dt className="text-xs font-bold text-ink-mute">내 문장</dt>
                  <dd>{item.evidenceQuote || '(해당 표현 미관찰)'}</dd>
                  <dt className="text-xs font-bold text-ink-mute">코퍼스 근거</dt>
                  <dd>{item.corpusRef || '—'}</dd>
                </dl>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ══════════ 진단 탭 블록 2 — 페르소나·구매여정·USP(REPORT-05) ══════════

function PersonaSection({ block2: p }: { block2: BlocksJson['block2'] }) {
  return (
    <>
      <section className={cardClass('mt-5 p-9')}>
        <p className="text-[11px] font-semibold text-ink-faint">블록 2</p>
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">이 고객이, 이 지점에서 만납니다</h2>
        <div className="mt-5 flex items-start gap-5 rounded-[14px] border border-card-border p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/report-assets/persona-nao.svg"
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] flex-none rounded-full border border-coral/30 bg-coral-tint"
          />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-ink">{p.persona.name} · {p.persona.ageRange}</p>
            <dl className="mt-3.5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div><dt className="text-[11.5px] font-bold text-ink-mute">피부 고민</dt><dd className="mt-1 text-[13.5px] text-ink">{p.persona.skinConcerns.join(', ')}</dd></div>
              <div><dt className="text-[11.5px] font-bold text-ink-mute">구매 동기</dt><dd className="mt-1 text-[13.5px] text-ink">{p.persona.buyingMotive}</dd></div>
              <div><dt className="text-[11.5px] font-bold text-ink-mute">구매 전 확인</dt><dd className="mt-1 text-[13.5px] text-ink">{p.persona.checkBehaviors.join(' · ')}</dd></div>
              <div><dt className="text-[11.5px] font-bold text-ink-mute">가격 감도</dt><dd className="mt-1 text-[13.5px] text-ink">{p.persona.priceSensitivity}</dd></div>
              <div className="sm:col-span-2"><dt className="text-[11.5px] font-bold text-ink-mute">신뢰 트리거</dt><dd className="mt-1 text-[13.5px] text-ink">{p.persona.trustTriggers.join(' · ')}</dd></div>
            </dl>
          </div>
        </div>

        {/* 구매 여정 — 스펙상 인지→탐색→구매 3단계가 보장된다(REPORT-05 5b) */}
        <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
          {p.journey.stages.flatMap((stage, i) => {
            const isLast = i === p.journey.stages.length - 1;
            const card = (
              <div
                key={`stage-${i}`}
                className={`min-w-[180px] flex-1 rounded-[12px] p-4 ${isLast ? 'border-[1.5px] border-coral bg-coral-tint' : 'border border-card-border'}`}
              >
                <p className={`text-[11.5px] font-extrabold ${isLast ? 'text-coral-strong' : 'text-ink-mute'}`}>
                  {i + 1} · {isLast ? '구매 = 최종 확신 지점' : i === 0 ? '인지' : '탐색'}
                </p>
                <p className="mt-2 text-sm text-ink-body">{stage}</p>
                {isLast && <p className="mt-1.5 text-xs text-ink-body">{p.journey.finalConfidencePoint}</p>}
              </div>
            );
            if (isLast) return [card];
            return [card, <span key={`arrow-${i}`} aria-hidden className="hidden items-center justify-center text-ink-faint sm:flex">→</span>];
          })}
        </div>

        {p.objections.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-bold text-ink">구매 반대 이유 (첫 의문)</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-body">
              {p.objections.map((o) => (
                <li key={o.question}><span lang="ja" className="font-semibold text-ink">{o.question}</span> — {o.why}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={cardClass('mt-4 p-9')}>
        <h2 className="text-[17px] font-bold text-ink">USP 재정의 — 같은 강점, 일본의 언어로</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th scope="col" className="rounded-l-[8px] bg-n-100 px-3.5 py-2.5 text-left text-xs font-bold text-ink-body">현재(KR) 소구</th>
                <th scope="col" className="bg-n-100 px-3.5 py-2.5 text-left text-xs font-bold text-ink-body">일본 고객에게 읽히는 방식</th>
                <th scope="col" className="rounded-r-[8px] bg-n-100 px-3.5 py-2.5 text-left text-xs font-bold text-ink-body">재정의된 USP</th>
              </tr>
            </thead>
            <tbody>
              {p.uspTable.map((row, i) => (
                <tr key={i} className="border-b border-n-150 align-top">
                  <td className="px-3.5 py-3 font-semibold text-ink">{row.krAppeal}</td>
                  <td className="px-3.5 py-3 text-ink-mute">{row.jpReading}</td>
                  <td className="px-3.5 py-3 font-semibold text-ink">{row.redefinedUsp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ══════════ 진단 탭 블록 6 — 정보 공백 → 이탈(REPORT-09) ══════════

function Block6Section({ block6 }: { block6: BlocksJson['block6'] }) {
  return (
    <section className={cardClass('mt-4 p-9')}>
      <p className="text-[11px] font-semibold text-ink-faint">블록 6</p>
      <h2 className="text-[17px] font-bold text-ink">정보 공백 → 의문 → 이탈</h2>
      <div className="mt-4 overflow-hidden rounded-[14px] border border-card-border">
        <div className="grid grid-cols-3 gap-2.5 bg-n-100 px-4.5 py-3 text-[11.5px] font-bold text-ink-body">
          <span>진단된 정보 공백</span>
          <span>고객이 떠올리는 의문</span>
          <span>이탈 행동</span>
        </div>
        {block6.narrative.map((row, i) => (
          <div key={i} className="grid grid-cols-3 gap-2.5 border-t border-n-150 px-4.5 py-3.5 text-[13px]">
            <span className="font-semibold text-ink">{row.infoGap}</span>
            <span className="text-ink-body">{row.distrustSignal}</span>
            <span className="text-ink-body">{row.dropOff}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] text-ink-mute">{block6.generalNote}</p>
    </section>
  );
}

// ══════════ 탭5 · 처방·다음 단계 (블록 7·8·9) ══════════

type RewriteRow = RewriteResult['rewrites'][number];

/** 문장 단위 재작성 카드 — 해결 칩(진단→처방)은 콜④가 이미 내는 problem·whatAdded의 렌더 승격, 새 데이터 계약 없음 */
function RewriteCard({ rw, index }: { rw: RewriteRow; index: number }) {
  return (
    <article className="mt-3.5 rounded-[14px] border border-card-border bg-n-50 p-5.5 text-sm first:mt-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold text-ink">재작성 {index + 1}</p>
        <span className="inline-flex h-6 items-center rounded-full bg-danger-bg px-2.5 text-[11.5px] font-bold whitespace-nowrap text-danger-text">
          푸는 문제 · {rw.problem}
        </span>
        {rw.whatAdded.map((w) => (
          <span key={w} className="inline-flex h-6 items-center rounded-full bg-green-bg px-2.5 text-[11.5px] font-bold whitespace-nowrap text-green-text">
            + {w}
          </span>
        ))}
      </div>
      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
        <div className="rounded-[12px] border border-n-150 bg-canvas p-4.5">
          <p className="text-[11px] font-extrabold tracking-[.05em] text-ink-mute">BEFORE · KR</p>
          <p className="mt-2.5 leading-[1.7] text-ink-mute line-through decoration-danger/60">{rw.beforeKr}</p>
        </div>
        <div className="rounded-[12px] border border-coral/35 bg-coral-tint p-4.5">
          <p className="text-[11px] font-extrabold tracking-[.05em] text-coral-strong">AFTER · JP</p>
          <p lang="ja" className="mt-2.5 leading-[1.7] font-bold text-ink">{rw.afterJa}</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-body">{rw.afterKr}</p>
        </div>
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-mute">{rw.reason}</p>
    </article>
  );
}

/** 블록7 — NG/OK 재작성. null=데이터 잠금 / rewrites:[]=콜④ 실패 폴백(의미가 다르다) */
function RewriteSection({ block7 }: { block7: BlocksJson['block7'] }) {
  return (
    <section className={cardClass('mt-5 p-9')}>
      <p className="text-[11px] font-semibold text-ink-faint">블록 7</p>
      <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">이렇게 바꾸면, 이 문제가 풀린다</h2>
      <p className="mt-2.5 max-w-[640px] text-sm leading-[1.7] text-ink-body">
        위반·저점 문장을 문장 단위로 고치고 일본 관례에 맞게 재설계합니다. 번역이 아니라 정보 구조의 재설계입니다.
      </p>
      {block7 === null ? (
        <div className="mt-5">
          <LockedCard
            title="NG/OK 재작성"
            body="재작성할 원문이 없어 산출하지 않았습니다(브랜드 진단)."
            hint="상세페이지 카피를 넣으면 저점 문장의 Before/After 재작성과 한국어 역해설이 열립니다."
          />
        </div>
      ) : block7.rewrites.length === 0 ? (
        <p className="mt-4 text-sm text-ink-mute">재작성 생성에 실패했습니다 — 재실행 시 채워집니다.</p>
      ) : (
        <div className="mt-5">
          {block7.rewrites.map((rw, i) => (
            <RewriteCard key={i} rw={rw} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

/** 블록8 — 헤드라인 블록 통째 재구성(비포&애프터 샘플). null=데이터 잠금 */
function SampleSection({ block8 }: { block8: BlocksJson['block8'] }) {
  return (
    <section className={cardClass('mt-4 p-9')}>
      <p className="text-[11px] font-semibold text-ink-faint">블록 8</p>
      <h2 className="text-[17px] font-bold text-ink">하이라이트 — 헤드라인 블록 통째 재구성</h2>
      {block8 === null ? (
        <div className="mt-4">
          <LockedCard
            title="비포&애프터 샘플"
            body="재구성할 원문이 없어 산출하지 않았습니다(브랜드 진단)."
            hint="상세페이지 카피를 넣으면 한 블록을 통째로 재구성한 일본어 샘플과 한국어 병기가 열립니다."
          />
        </div>
      ) : block8.afterJaBlock ? (
        <div className="mt-4 rounded-[14px] border-[1.5px] border-coral/40 p-5.5">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-mute">
            대상 섹션: {block8.targetSection}
            {block8.isDemo && <span className="rounded-full bg-amber-bg px-2 py-0.5 text-[11px] text-amber-text">예시(데모)</span>}
          </p>
          <p lang="ja" className="mt-3.5 text-base leading-[1.75] font-bold whitespace-pre-line text-ink">{block8.afterJaBlock}</p>
          <p className="mt-3 leading-relaxed whitespace-pre-line text-ink-body">{block8.afterKrBlock}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-mute">샘플 생성에 실패했습니다 — 재실행 시 채워집니다.</p>
      )}
    </section>
  );
}

/** 블록9 — 지금 할 일 + 다음 단계 고정가 퍼널 + 규정 출처·한계 고지 */
function NextStepSection({ block9 }: { block9: BlocksJson['block9'] }) {
  return (
    <section className={cardClass('mt-4 p-9')}>
      <p className="text-[11px] font-semibold text-ink-faint">블록 9</p>
      <h2 className="text-[17px] font-bold text-ink">지금 할 일 — 위험 순</h2>
      <ol className="mt-4 flex flex-col gap-2.5">
        {block9.actions.map((a, i) => (
          <li key={a} className="flex items-start gap-3.5 rounded-[12px] border border-card-border p-3.5">
            <span aria-hidden className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-extrabold ${i === 0 ? 'bg-danger text-white' : 'bg-n-150 text-ink-body'}`}>
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed text-ink-body">{a}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-8 text-[17px] font-bold text-ink">다음 단계 — 고정가, 견적 왕복 없음</h2>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {block9.funnel.map((f, i) => (
          <div key={f.step} className={`rounded-[14px] p-4.5 ${i === 0 ? 'border-[1.5px] border-coral bg-coral-tint' : 'border border-card-border'}`}>
            <p className={`text-xs font-extrabold ${i === 0 ? 'text-coral-strong' : 'text-ink-mute'}`}>{f.step}</p>
            <p className="mt-2 text-[22px] font-extrabold text-ink">{f.price}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-body">{f.note}</p>
          </div>
        ))}
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-mute">규정 출처 · 한계 고지 ▾</summary>
        <div className="mt-3.5 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-bold text-ink-mute">규정 출처</h3>
            {block9.sources.length === 0 ? (
              <p className="mt-1.5 text-xs text-ink-faint">각주의 원천인 감사가 없어 규정 출처가 없습니다(브랜드 진단).</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5 text-xs text-ink-body">
                {block9.sources.map((s) => (
                  <li key={s.id}>
                    [{s.id}] {s.title} — {s.source}{' '}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-coral-strong underline">원문</a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink-mute">한계 고지</h3>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-xs text-ink-body">
              {block9.limits.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}

function PrescriptionPanel({ b, slideExportSlot }: { b: BlocksJson; slideExportSlot?: React.ReactNode }) {
  return (
    <>
      <RewriteSection block7={b.block7} />
      <SampleSection block8={b.block8} />
      <NextStepSection block9={b.block9} />

      {/* 실물 Before/After 예시(스튜디오 산출물 견본) — 정적 자산, blocksJson 무관 */}
      <section className={cardClass('mt-4 p-9')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[14px] border border-n-150 bg-n-50 p-4.5">
            <p className="text-[11px] font-extrabold tracking-[.05em] text-ink-mute">BEFORE · 한국 판촉 원본</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/report-assets/sample-before.webp" alt="한국 원본 판촉 이미지 — 특가·밈 카피·형광 테두리" loading="lazy" className="mt-2.5 block w-full rounded-[10px]" />
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-mute">특가·밈 카피·형광 테두리 — 한국 판촉 문법.</p>
          </div>
          <div className="rounded-[14px] border border-coral/35 bg-coral-tint p-4.5">
            <p className="text-[11px] font-extrabold tracking-[.05em] text-coral-strong">AFTER · 일본향 재설계 (스튜디오 예시)</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/report-assets/sample-after.png" alt="일본향으로 재설계한 이미지 — 스펙 중심·차분한 무드" loading="lazy" className="mt-2.5 block w-full rounded-[10px]" />
            <p className="mt-2.5 text-sm font-bold text-ink">
              <span lang="ja">白浮きしない、透明感トーンアップUV</span>{' '}
              <span className="text-xs font-normal text-ink-mute">SPF50+ · PA++++</span>
            </p>
          </div>
        </div>

        {/* 로그인 상태의 다음 행동 — 재설계 문구를 스튜디오로 가져간다(가입 CTA는 공개 샘플 전용이라 앱에선 제외) */}
        <div className="mt-6 rounded-[14px] border border-coral/35 bg-coral-tint p-8 text-center">
          <p className="text-[19px] font-extrabold tracking-[-0.01em] text-ink">지금 본 재설계를, 썸네일로 직접.</p>
          <p className="mx-auto mt-2.5 max-w-[520px] text-sm leading-[1.7] text-ink-body [text-wrap:pretty]">
            리포트의 Before/After 문구가 마케팅 스튜디오에서 썸네일 카피의 재료가 됩니다.
          </p>
          <Link href="/app/studio/thumbnail" className={`${buttonClass('primary', 'lg')} mt-4.5 no-underline`}>
            스튜디오에서 만들기 →
          </Link>
        </div>
      </section>

      {slideExportSlot && <div className="mt-6 flex justify-end">{slideExportSlot}</div>}
    </>
  );
}

// ══════════ 최상위 컴포넌트 ══════════

interface ReportViewProps {
  blocks: BlocksJson;
  /** 탭5 하단의 "보고용 슬라이드 만들기" 버튼 — 페이지가 SlideExport(fetch·blob 로직 보유)를 주입한다 */
  slideExportSlot?: React.ReactNode;
}

/** 탭 인덱스 ↔ URL 해시(REPORT-14 — 새로고침·링크 공유 시 활성 탭 유지) */
const TAB_HASHES = ['market', 'diagnosis', 'prescription'] as const;

/**
 * 리포트 본문(3탭 하이브리드 · REPORT-14) — 목업/정밀도 배너 → 상단 고정(블록0 표지 + 블록1 요약 헤더)
 * → 스티키 탭 내비(시장/진단/처방) → 활성 탭만 렌더. 블록 번호·blocksJson 계약은 불변, 표시 구조만 재편.
 */
export function ReportView({ blocks: b, slideExportSlot }: ReportViewProps) {
  const [tab, setTab] = useState(0); // 기본 탭 "시장"
  const navRef = useRef<HTMLElement | null>(null);

  // 진입 시 URL 해시로 활성 탭 복원 + popstate 동기화(딥링크 뒤로가기)
  useEffect(() => {
    const idxOf = (h: string) => TAB_HASHES.indexOf(h.replace('#', '') as (typeof TAB_HASHES)[number]);
    const initial = idxOf(window.location.hash);
    if (initial >= 0) setTab(initial);
    const onPop = () => {
      const i = idxOf(window.location.hash);
      if (i >= 0) setTab(i);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** 앵커 도착 — details 펼침 + 스크롤 + hl-flash 2초(REPORT-16). 패널 마운트를 위해 2프레임 대기 */
  function flashAnchor(id: string) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el instanceof HTMLDetailsElement) el.open = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('hl-flash');
        setTimeout(() => el.classList.remove('hl-flash'), 2000);
      }),
    );
  }

  /** 탭 전환(스티키 탭 바) — 해시 교체 + 스크롤 클램프(맨 위 X → 탭 바 상단 정렬까지만) */
  const goTab = useCallback((i: number) => {
    setTab(i);
    window.history.replaceState(null, '', `#${TAB_HASHES[i]}`);
    requestAnimationFrame(() => {
      const top = navRef.current?.offsetTop ?? 0;
      // 현재 스크롤이 탭 바 상단보다 아래면 그 지점까지만 올림. 위(상단 고정 요약 열람 중)면 이동 X
      if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
    });
  }, []);

  /** 상단 고정 Top3 → 진단 탭 블록5 항목 앵커로 딥링크(REPORT-16, pushState = 뒤로가기 복귀) */
  const deepLinkToRubric = useCallback((itemId: string) => {
    setTab(1);
    window.history.pushState(null, '', '#diagnosis');
    flashAnchor(`rubric-${itemId}`);
  }, []);

  return (
    <div>
      {(b.meta.llmMode === 'mock' || b.meta.precisionLimited) && (
        <div className="mt-5 space-y-2">
          {b.meta.llmMode === 'mock' && (
            <p className="rounded-[10px] bg-amber-bg p-3 text-[13px] font-medium text-amber-text">
              목(mock) 모드 리포트 — 판정은 데모용 고정 로직입니다.
            </p>
          )}
          {b.meta.precisionLimited && (
            <p className="rounded-[10px] bg-amber-bg p-3 text-[13px] font-medium text-amber-text">
              정밀도 제한 — 입력 콘텐츠가 200자 미만이라 일부 블록이 카테고리 일반형으로 산출되었습니다.
            </p>
          )}
        </div>
      )}

      {/* 상단 고정 — 블록0 표지 + 블록1 요약 헤더(탭 무관 상시 노출 · REPORT-14) */}
      <CoverSummaryCard block0={b.block0} />
      <Block1Header b={b} onDeepLink={deepLinkToRubric} />

      <TabNav active={tab} onChange={goTab} navRef={navRef} />

      <div id={`report-tabpanel-${tab}`} role="tabpanel" aria-labelledby={`report-tab-${tab}`} tabIndex={0}>
        {tab === 0 && <MarketPanel />}
        {tab === 1 && (
          <>
            {/* 진단 탭 표시 순서: 블록 4 → 2 → 3 → 5 → 6 (REPORT-14) */}
            <BenchmarkSection block4={b.block4} />
            <PersonaSection block2={b.block2} />
            <AuditSection block3={b.block3} productClassAssumed={b.meta.productClassAssumed} />
            <RubricSection block5={b.block5} />
            <Block6Section block6={b.block6} />
          </>
        )}
        {tab === 2 && <PrescriptionPanel b={b} slideExportSlot={slideExportSlot} />}
      </div>

      <p className="mt-9 text-center text-[11.5px] leading-relaxed text-ink-faint">
        KGLOW · 진단 리포트 — 화면 속 점수·판정·일본어 카피는 이 진단의 실제 산출 결과입니다.
      </p>
    </div>
  );
}
