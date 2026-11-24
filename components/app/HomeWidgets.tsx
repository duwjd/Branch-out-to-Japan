import Link from 'next/link';
import type { BrandProfileRecord, ProductRecord, ReportSummary } from '@/lib/db/store';
import { POSITIONING_TAGS } from '@/lib/engine/rules/positioning';
import { CATEGORY_LABELS } from '@/lib/engine/types';
import { ReportCoverPreview, ThumbPreview } from '@/components/app/AssetPreview';
import { HOME_CARD_TITLE, HOME_LABEL, HOME_LINK, HomeCard } from '@/components/app/homeUi';
import { AxisChip, cardClass } from '@/components/ui/primitives';
import { IconCheck } from '@/components/ui/icons';

/**
 * 홈 카드 — 브랜드 프로필(MAIN-11) · 확인할 것 · 작업물(MAIN-05b).
 * 전부 기존 엔티티 재조회 전용(홈은 아무것도 저장하지 않는다 — 08 §7). 서버 컴포넌트.
 * 2026-11-24 전면 재설계: 우측 칼럼의 머리선 목록이던 것들을 12열 격자의 카드로 올렸다
 * (근거: docs/decisions/2026-11-24-홈-다음단계-히어로.md).
 */

const TAG_LABELS: Record<string, string> = Object.fromEntries(POSITIONING_TAGS.map((t) => [t.value, t.label]));

/** 카테고리 한국어 라벨 — 미지의 값이면 원문 그대로(빈 자리를 만들지 않는다) */
export function categoryLabelKr(category: string): string {
  return CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category;
}

// ── 확인할 것 ────────────────────────────────────────────────────────────────

/** 확인할 것 1건 — 사용자의 행동을 기다리는 일 */
export interface AttentionItem {
  key: string;
  /** 'danger' = 실패(✕) · 'ok' = 좋은 소식이 도착(○). 색+글자+기호를 title 에 함께 싣는다 */
  tone: 'danger' | 'ok';
  /** 굵게 읽히는 머리 — "생성 실패 ✕ 1건" */
  title: string;
  detail: string;
  href: string;
  /** 링크 글자 — "원인 보기 →" */
  cta: string;
}

/**
 * 확인할 것 — 페이지 머리 바로 아래 한 블록. 항목이 없으면 페이지가 그리지 않는다.
 * 여러 건이어도 띠를 쌓지 않고 한 테두리 안의 행으로 둔다(배너는 화면에 하나).
 * 기업 매칭 제안 도착은 사이드바 운영 메뉴를 펼쳐야만 보였다 — 행동을 기다리는 일은 건수보다 앞에 둔다.
 */
export function HomeAttention({ items }: { items: AttentionItem[] }) {
  return (
    <section aria-label="확인할 것" className={cardClass('overflow-hidden')}>
      <ul className="list-none divide-y divide-n-150 p-0">
        {items.map((it) => (
          <li key={it.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3.5 text-[13px] max-sm:px-5">
            <span
              aria-hidden
              className={`h-2 w-2 flex-none rounded-full ${it.tone === 'danger' ? 'bg-danger' : 'bg-green'}`}
            />
            <b className={`font-bold ${it.tone === 'danger' ? 'text-danger-text' : 'text-green-text'}`}>{it.title}</b>
            <span className="text-ink-body">{it.detail}</span>
            <Link href={it.href} className={`${HOME_LINK} ml-auto`}>
              {it.cta}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 브랜드 프로필 ────────────────────────────────────────────────────────────

/** 브랜드 카드에 보이는 등록 제품 행 수 */
const PRODUCT_ROWS = 3;

/** 입력 한 줄의 채움 표식 — 채움 ✓(초록) · 비어 있음(점선 원). 값 글자가 함께 있어 색만으로 읽히지 않는다 */
function InputMarker({ filled }: { filled: boolean }) {
  return filled ? (
    <span
      aria-hidden
      className="inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-green-bg text-green-text"
    >
      <IconCheck size={11} strokeWidth={2.75} />
    </span>
  ) : (
    <span
      aria-hidden
      className="h-[18px] w-[18px] flex-none rounded-full border-[1.5px] border-dashed border-border-strong"
    />
  );
}

/**
 * MAIN-11 · 브랜드 프로필 카드 — "진단·생성이 무엇을 보고 도는가".
 * 이전 위젯은 "미등록"이 네 줄 이어져 읽을 것이 없었다. 채움 정도를 먼저 한 줄(n/4 + 4칸 막대)로 말하고,
 * 줄마다 채움 표식을 붙여 무엇이 비었는지가 한눈에 보이게 했다. 고치는 곳은 브랜드 관리 하나다.
 * 아래에는 등록 제품을 둔다 — 스튜디오의 제품 피커가 여기서 고른다(BRAND-03 · HOME-02).
 * @param products 브랜드에 등록한 제품(최신순) — 앞에서 3건까지만 보인다
 */
export function HomeBrandCard({ brand, products }: { brand: BrandProfileRecord; products: ProductRecord[] }) {
  const tags = brand.positioningTags.map((v) => TAG_LABELS[v] ?? v);
  const kitDone =
    (brand.brandKit.productNamesJa.length > 0 ? 1 : 0) +
    (brand.brandKit.forbiddenTerms.length > 0 ? 1 : 0) +
    (brand.brandKit.toneGuide.trim() ? 1 : 0);
  const hasProductInfo = Boolean(brand.detailDocName || brand.productInfoMemo.trim());
  const jpChannels = brand.channels.jp.map((c) => c.channel).filter(Boolean);

  const rows: { label: string; filled: boolean; value: string }[] = [
    {
      label: '포지셔닝',
      filled: tags.length > 0,
      value:
        tags.length > 0 ? tags.slice(0, 2).join(' · ') + (tags.length > 2 ? ` 외 ${tags.length - 2}` : '') : '미등록',
    },
    { label: '제품·상세 정보', filled: hasProductInfo, value: hasProductInfo ? '등록됨' : '미등록' },
    {
      label: '일본 채널',
      filled: jpChannels.length > 0,
      value: jpChannels.length > 0 ? jpChannels.join(' · ') : '미등록',
    },
    { label: '브랜드 킷', filled: kitDone > 0, value: `${kitDone}/3 항목` },
  ];
  const filled = rows.filter((r) => r.filled).length;

  return (
    <HomeCard
      title="브랜드 프로필"
      titleId="brand-t"
      action={{ href: '/app/brand', label: '브랜드 관리 →' }}
      className="h-full"
    >
      <div className="mt-5 flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-panel bg-linear-135 from-[#ffe9df] to-[#ffcfb8] text-[17px] font-extrabold text-amber-text"
        >
          {brand.brandName.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-ink">{brand.brandName}</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-ink-mute">
            {categoryLabelKr(brand.category)} · {brand.productClass}
          </span>
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className={HOME_LABEL}>진단·생성에 쓰이는 입력</p>
          <p className="tnum text-[13px] font-bold text-ink">
            {filled}
            <span className="font-semibold text-ink-mute">/{rows.length}</span>
          </p>
        </div>
        <div aria-hidden className="mt-2 flex gap-1">
          {rows.map((r) => (
            <span key={r.label} className={`h-1.5 flex-1 rounded-full ${r.filled ? 'bg-green' : 'bg-n-150'}`} />
          ))}
        </div>
      </div>

      <dl className="mt-3 flex flex-col">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-2.5 border-b border-n-150 py-2.5 text-[13px] last:border-b-0"
          >
            <InputMarker filled={r.filled} />
            <dt className="flex-none text-ink-body">{r.label}</dt>
            <dd className={`m-0 ml-auto min-w-0 truncate font-semibold ${r.filled ? 'text-ink' : 'text-ink-mute'}`}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* 등록 제품은 카드 바닥에 붙인다 — 옆 카드에 맞춰 늘어나도 빈 자리가 두 구획 사이에 생기게 */}
      <div className="mt-auto pt-5">
        <div className="flex items-baseline justify-between gap-3 border-t border-n-150 pt-5">
          <p className={HOME_LABEL}>등록 제품</p>
          <p className="tnum text-[13px] font-bold text-ink">
            {products.length}
            <span className="font-semibold text-ink-mute">개</span>
          </p>
        </div>
        {products.length > 0 ? (
          <ul className="mt-2.5 flex list-none flex-col gap-2.5 p-0">
            {products.slice(0, PRODUCT_ROWS).map((p) => {
              const primary = p.images.find((im) => im.isPrimary) ?? p.images[0] ?? null;
              return (
                <li key={p.id} className="flex items-center gap-3">
                  {primary ? (
                    // eslint-disable-next-line @next/next/no-img-element -- /api/files 동적 서빙(허용 목록 밖)
                    <img
                      src={`/api/files/${primary.fileId}`}
                      alt=""
                      loading="lazy"
                      className="h-10 w-10 flex-none rounded-field border border-card-border bg-n-150 object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="h-10 w-10 flex-none rounded-field border border-card-border bg-n-100"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-ink">{p.nameKr}</span>
                    <span className="tnum mt-0.5 block truncate text-[12px] text-ink-mute">
                      {p.nameJa ? <span lang="ja">{p.nameJa}</span> : `이미지 ${p.images.length}장`}
                    </span>
                  </span>
                </li>
              );
            })}
            {products.length > PRODUCT_ROWS && (
              <li className="tnum text-[12px] text-ink-mute">외 {products.length - PRODUCT_ROWS}개</li>
            )}
          </ul>
        ) : (
          <p className="mt-2.5 rounded-field border border-dashed border-border-strong bg-n-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">
            제품컷을 등록하면 스튜디오에서 업로드 없이 바로 골라 쓸 수 있어요.
          </p>
        )}
      </div>
    </HomeCard>
  );
}

// ── 작업물 ───────────────────────────────────────────────────────────────────

/** 작업물 카드 1장 — 발행 리포트 또는 완성 자산 */
export interface WorkItem {
  key: string;
  kind: 'report' | 'thumbnail' | 'detail';
  href: string;
  name: string;
  /** "2026.11.23" */
  date: string;
  /** 리포트 표지용 — 자산이면 null/빈 값 */
  score: number | null;
  groupScores: ReportSummary['groupScores'];
  top3: ReportSummary['top3'];
  /** 자산 이미지 경로 — 리포트면 null */
  img: string | null;
}

/** 작업물 격자의 칸 수(데스크톱) — 한 줄만 보인다. 나머지는 "전체 보기"가 맡는다 */
export const WORK_COLUMNS = 4;

/**
 * MAIN-05b · 최근 작업물 — 이어서 열 것. 한 줄(4칸)만 보이고, 4칸이 안 차면 마지막에 만들기 칸을 붙인다
 * (칸이 비어 격자가 무너지지 않게 · 만들기 진입을 겸한다).
 * @param items 최신순 작업물(리포트 + 자산) — 앞에서 4건까지만 쓴다
 * @param counts 종류별 총 건수 — 머리에서 각 목록으로 가는 링크가 된다
 */
export function HomeWork({
  items,
  counts,
}: {
  items: WorkItem[];
  counts: { report: number; thumbnail: number; detail: number };
}) {
  const shown = items.slice(0, WORK_COLUMNS);
  const showCreateTile = shown.length < WORK_COLUMNS;
  const countLinks = [
    { label: '진단 리포트', n: counts.report, tab: 'report' },
    { label: '썸네일', n: counts.thumbnail, tab: 'thumbnail' },
    { label: '상세페이지', n: counts.detail, tab: 'detail' },
  ];

  return (
    <section aria-labelledby="work-t">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <h2 id="work-t" className={HOME_CARD_TITLE}>
          최근 작업물
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-3 text-[12.5px] text-ink-mute">
          {countLinks.map((c) => (
            <Link
              key={c.tab}
              href={`/app/library?tab=${c.tab}`}
              className="text-ink-mute no-underline hover:text-ink hover:underline"
            >
              {c.label} <b className="tnum font-bold text-ink-body">{c.n}</b>
            </Link>
          ))}
        </p>
        <Link href="/app/library" className={`${HOME_LINK} ml-auto`}>
          전체 보기 →
        </Link>
      </div>

      <ul className="mt-4 grid list-none grid-cols-4 gap-6 p-0 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {shown.map((r) => (
          <li key={r.key} className="flex">
            <Link
              href={r.href}
              aria-label={`${r.name} 열기`}
              className="block w-full overflow-hidden rounded-card border border-card-border bg-canvas no-underline shadow-card transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2"
            >
              <span className="relative block aspect-4/3 overflow-hidden border-b border-n-150">
                {r.kind === 'report' ? (
                  <ReportCoverPreview score={r.score} groupScores={r.groupScores} top3={r.top3} density="compact" />
                ) : r.img ? (
                  <ThumbPreview src={r.img} alt="" anchor={r.kind === 'detail' ? 'top' : 'center'} />
                ) : (
                  <span aria-hidden className="absolute inset-0 bg-n-150" />
                )}
              </span>
              <span className="block px-4 py-3.5">
                <AxisChip axis={r.kind === 'report' ? 'report' : 'studio'} />
                <span className="mt-2 block truncate text-[14px] font-bold text-ink">{r.name}</span>
                <span className="tnum mt-0.5 block text-[12px] text-ink-mute">
                  {r.kind === 'report' ? '발행' : '생성'} {r.date}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {showCreateTile && (
          <li className="flex">
            <Link
              href="/app/studio"
              className="flex min-h-[220px] w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong bg-n-50 px-5 text-center no-underline transition-colors hover:border-coral hover:bg-coral-tint"
            >
              <span
                aria-hidden
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-coral-tint text-[20px] leading-none font-bold text-coral-strong"
              >
                ＋
              </span>
              <span className="text-[14px] font-bold text-ink">새로 만들기</span>
              <span className="text-[12.5px] text-ink-mute">썸네일 · 상세페이지</span>
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

/** 스튜디오 예시 타일 1장의 내용 — 스튜디오 메뉴가 이미 쓰는 정적 컷을 재사용한다(새 자산을 만들지 않는다) */
const STUDIO_SAMPLES: {
  href: string;
  title: string;
  desc: string;
  cta: string;
  shape: 'square' | 'tall';
  images: string[];
}[] = [
  {
    href: '/app/studio/thumbnail',
    title: '썸네일',
    desc: '제품 이미지를 일본 채널의 썸네일 문법 8종 중 하나로 만듭니다.',
    cta: '썸네일 만들기 →',
    shape: 'square',
    images: [
      '/studio-templates/01-clean.jpg',
      '/studio-templates/03-official.jpg',
      '/studio-templates/05-award.jpg',
      '/studio-templates/02-texture.jpg',
    ],
  },
  {
    href: '/app/studio/detail',
    title: '상세페이지',
    desc: '한국형 쇼핑몰 상세페이지를 일본 채널에 맞는 구성과 표현으로 바꿉니다.',
    cta: '상세페이지 만들기 →',
    shape: 'tall',
    images: [
      '/detail-templates/preview-D3-card.webp',
      '/detail-templates/preview-D4-card.webp',
      '/detail-templates/preview-D5-card.webp',
      '/detail-templates/preview-D1-card.webp',
    ],
  },
];

/**
 * 작업물이 아직 없을 때 그 자리 — 스튜디오에서 만드는 것 예시 2장.
 * 빈 격자("아직 없습니다") 대신 무엇이 채워질지를 실제 예시 컷으로 보여 준다. 브랜드의 결과물이 아니므로
 * "예시" 배지를 붙이고, 타일 전체가 해당 만들기 화면으로 가는 링크다(채워진 버튼은 두지 않는다).
 */
export function HomeStudioSamples() {
  return (
    <section aria-labelledby="samples-t">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <h2 id="samples-t" className={HOME_CARD_TITLE}>
          스튜디오에서 만드는 것
        </h2>
        <p className="text-[12.5px] text-ink-mute">완성한 작업물이 이 자리에 쌓입니다</p>
      </div>
      <ul className="mt-4 grid list-none grid-cols-2 gap-6 p-0 max-lg:grid-cols-1">
        {STUDIO_SAMPLES.map((s) => (
          <li key={s.href} className="flex">
            <Link
              href={s.href}
              className={cardClass(
                'group grid w-full items-center gap-x-6 gap-y-5 overflow-hidden p-6 no-underline transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2 sm:grid-cols-[minmax(0,1fr)_auto] max-sm:p-5',
              )}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[16px] font-bold text-ink">{s.title}</span>
                  <span className="inline-flex h-5 items-center rounded-full bg-n-150 px-2 text-[11px] font-bold text-ink-mute">
                    예시
                  </span>
                </span>
                <span className="mt-2 block text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                  {s.desc}
                </span>
                <span className={`${HOME_LINK} mt-4 inline-block group-hover:underline`}>{s.cta}</span>
              </span>
              <span aria-hidden className="flex items-end gap-2">
                {s.images.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element -- 정적 public 자산, 고정 크기
                  <img
                    key={src}
                    src={src}
                    alt=""
                    loading="lazy"
                    className={`flex-none rounded-[8px] border border-card-border object-cover object-top ${
                      s.shape === 'square' ? 'h-[76px] w-[76px]' : 'h-[112px] w-[52px]'
                    }`}
                  />
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
