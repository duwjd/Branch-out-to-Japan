import Link from 'next/link';
import type { ReportSummary } from '@/lib/db/store';
import type { AuditCounts, ReportMaterial } from '@/lib/home/reportMaterial';
import { BAND_BAR, GROUP_LABELS_PREFIXED, GROUP_ORDER, scoreBand } from '@/lib/report/labels';
import { HOME_LABEL, HOME_LINK, HomeCard } from '@/components/app/homeUi';

/**
 * 홈 진단 카드(MAIN-10) — 최근 리포트를 한 장에서 훑는다.
 *
 * 리포트가 말하는 것은 넷이다: ① 몇 점인가(일본 상세 관례 충족도) ② 어느 영역이 비었나(A~E)
 * ③ 무엇부터 고치나(Top 3) ④ 문구가 실제로 어떻게 바뀌었나(원문 → 재설계). 이전 홈은 ①②③을
 * 우측 칼럼의 좁은 목록으로, ④는 아예 보여 주지 않았다. 여기서는 넷을 한 카드의 구획으로 놓고,
 * 약기법 표현 감사 분포(불가·조건부·가능)를 그 사이에 띠로 둔다. 시각 요소는 리포트 화면과 같은
 * 말을 쓴다 — 점수 링(코랄) · 영역 막대(밴드 색) · 판정 칩(색+글자+기호).
 *
 * ⚠ 종합 점수에는 등급 라벨(양호/보완 등)을 붙이지 않는다 — 임계값 근거 미확정(리포트 스펙 §9-Q3).
 * ⚠ 이 카드는 조회 전용이다. 스튜디오가 재설계 문구를 자동으로 받아 쓰지 않는다(폐루프 미배선) —
 *    그래서 "재료"라고 쓰지 않고, 각 구획은 리포트의 해당 탭으로 보내는 링크만 둔다.
 */

/** 종합 점수 링 — 리포트 화면 ScoreDonut 과 같은 모양을 홈 크기로(서버 컴포넌트용 SVG) */
function ScoreRing({ score }: { score: number }) {
  const size = 132;
  const radius = 55;
  const stroke = 11;
  const c = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * c;
  return (
    <div
      className="relative flex-none"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`일본 상세 관례 충족도 ${score}점 / 100점`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden focusable="false">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-n-150" />
        {score > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="stroke-coral"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[40px] leading-none font-extrabold tracking-[-0.04em] text-ink">{score}</span>
        <span className="mt-1 text-[12px] font-bold text-ink-mute">/ 100</span>
      </div>
    </div>
  );
}

/** 판정 분포 칩 — 색+글자+기호 3중 표기(리포트 블록3과 같은 말: 불가 ✕ / 조건부 △ / 가능 ○) */
function AuditChips({ audit }: { audit: AuditCounts }) {
  const chips = [
    { label: '불가 ✕', n: audit.ng, tone: 'bg-danger-bg text-danger-text' },
    { label: '조건부 △', n: audit.conditional, tone: 'bg-amber-bg text-amber-text' },
    { label: '가능 ○', n: audit.ok, tone: 'bg-green-bg text-green-text' },
  ];
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span
          key={c.label}
          className={`tnum inline-flex h-[22px] items-center rounded-full px-2.5 text-[11.5px] font-bold ${c.tone}`}
        >
          {c.label} {c.n}
        </span>
      ))}
    </span>
  );
}

/** 표현 감사 띠 — 분포 막대(문장 수 비례) + 칩. 막대는 장식이 아니라 세 판정의 비율이다 */
function AuditStrip({ audit }: { audit: AuditCounts }) {
  const total = audit.ng + audit.conditional + audit.ok;
  const segs = [
    { n: audit.ng, tone: 'bg-danger' },
    { n: audit.conditional, tone: 'bg-amber' },
    { n: audit.ok, tone: 'bg-green' },
  ].filter((s) => s.n > 0);
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-n-150 pt-5">
      <p className={HOME_LABEL}>
        약기법 표현 감사 <span className="tnum font-semibold">· 문장 {total}건</span>
      </p>
      <span aria-hidden className="flex h-2 min-w-[140px] flex-1 gap-0.5 overflow-hidden rounded-full">
        {segs.map((s) => (
          <span key={s.tone} className={`h-full rounded-full ${s.tone}`} style={{ flexGrow: s.n, flexBasis: 0 }} />
        ))}
      </span>
      <AuditChips audit={audit} />
    </div>
  );
}

/** 문구 한 쌍 — 원문 → 재설계(또는 한국식 소구 → 재정의 USP) + 이유. 전체는 리포트 탭으로 */
function MaterialPair({ material, reportHref }: { material: ReportMaterial; reportHref: string }) {
  const isRewrite = material.kind === 'rewrite';
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className={HOME_LABEL}>{isRewrite ? '재설계한 문구' : '재정의한 USP'}</p>
        {material.total > 1 && <span className="tnum text-[12px] text-ink-mute">{material.total}건 중 1건</span>}
        <Link href={`${reportHref}#${isRewrite ? 'prescription' : 'diagnosis'}`} className={`${HOME_LINK} ml-auto`}>
          {material.total > 1 ? '모두 보기 →' : '리포트에서 보기 →'}
        </Link>
      </div>
      <div className="mt-3 grid items-stretch gap-x-2 gap-y-1.5 md:grid-cols-[minmax(0,1fr)_18px_minmax(0,1fr)]">
        <div className="rounded-field bg-n-100 px-4 py-3.5">
          <p className="text-[12px] font-bold text-ink-mute">{isRewrite ? '원문' : '한국식 소구'}</p>
          <p className="mt-1 line-clamp-3 text-[13.5px] leading-[1.65] text-ink-body">{material.before}</p>
        </div>
        <span aria-hidden className="self-center text-center text-[14px] text-ink-ghost max-md:rotate-90">
          →
        </span>
        <div className="rounded-field bg-coral-tint px-4 py-3.5">
          <p className="text-[12px] font-bold text-coral-strong">{isRewrite ? '재설계 문구' : '재정의한 USP'}</p>
          <p lang={material.afterLang} className="mt-1 line-clamp-3 text-[14px] leading-[1.65] font-semibold text-ink">
            {material.after}
          </p>
        </div>
      </div>
      {material.reason && (
        <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-mute">
          <b className="font-bold text-ink-body">{isRewrite ? '바꾼 이유' : '일본 고객의 읽기'}</b> · {material.reason}
        </p>
      )}
    </div>
  );
}

/**
 * 진단 카드 본체 — 발행된 리포트가 있을 때.
 * @param audit 표현 감사 분포 — 감사 대상이 없던 리포트면 null(띠를 그리지 않는다)
 * @param material 홈에 올릴 문구 한 쌍 — 고를 것이 없으면 null
 */
export function HomeReportCard({
  report,
  requestId,
  name,
  date,
  audit,
  material,
}: {
  report: ReportSummary;
  requestId: string;
  name: string;
  date: string;
  audit: AuditCounts | null;
  material: ReportMaterial | null;
}) {
  const reportHref = `/app/report/${requestId}`;
  const scored = report.overallScore !== null;

  return (
    <HomeCard
      title="최근 진단 리포트"
      titleId="report-t"
      meta={`${name} · ${date} 발행`}
      action={{ href: reportHref, label: '리포트 열기 →' }}
      className="h-full"
    >
      {scored ? (
        <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3 max-md:flex-row max-md:gap-5">
            <ScoreRing score={report.overallScore as number} />
            <p className="text-center text-[12px] leading-snug font-bold text-ink-mute max-md:text-left">
              일본 상세 관례
              <br />
              충족도
            </p>
          </div>

          <div className="min-w-0">
            <p className={HOME_LABEL}>영역별 충족도</p>
            <dl className="mt-3 flex flex-col gap-[11px]">
              {GROUP_ORDER.map((g) => {
                // 그룹 점수는 소수로 내려올 수 있다(16.7) — 막대 옆 좁은 자리라 정수로 적는다
                const p = Math.round(report.groupScores[g] ?? 0);
                return (
                  <div key={g} className="grid grid-cols-[104px_minmax(0,1fr)_26px] items-center gap-2.5">
                    <dt className="truncate text-[12.5px] text-ink-body">{GROUP_LABELS_PREFIXED[g]}</dt>
                    <dd className="m-0 h-1.5 overflow-hidden rounded-full bg-n-150">
                      <span
                        className={`block h-full rounded-full ${BAND_BAR[scoreBand(p)]}`}
                        style={{ width: `${p}%` }}
                      />
                    </dd>
                    <dd className="tnum m-0 text-right text-[12.5px] font-bold text-ink">{p}</dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="min-w-0">
            <p className={HOME_LABEL}>먼저 고칠 지점</p>
            {report.top3.length > 0 ? (
              <ol className="mt-2 list-none p-0">
                {report.top3.slice(0, 3).map((t, i) => (
                  <li key={t.itemId} className="border-b border-n-150 last:border-b-0">
                    {/* 행이 곧 링크다 — 진단 탭(채점 항목이 있는 곳)으로 보낸다 */}
                    <Link
                      href={`${reportHref}#diagnosis`}
                      className="group flex items-start gap-2.5 py-2.5 text-[13px] leading-snug text-ink-body no-underline hover:text-ink"
                    >
                      <span
                        aria-hidden
                        className="tnum mt-px inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] bg-coral-tint text-[10.5px] font-extrabold text-coral-strong"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 group-hover:underline">{t.title}</span>
                      <span aria-hidden className="text-ink-ghost group-hover:text-coral-strong">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-mute">우선순위로 뽑힌 항목이 없습니다.</p>
            )}
          </div>
        </div>
      ) : (
        /* 브랜드 진단 — 점수 자리에 0을 그리지 않는다(산출하지 않은 것을 0으로 위장하지 않는다) */
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-field bg-n-50 px-4 py-3.5">
          <span className="inline-flex h-[22px] items-center rounded-full bg-n-150 px-2.5 text-[11.5px] font-bold text-ink-mute">
            브랜드 진단 · 종합점수 없음
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-body">
            제품 콘텐츠를 넣어 진단하면 충족도 점수와 표현 감사가 함께 나옵니다.
          </p>
          <Link href="/app/report/new" className={HOME_LINK}>
            제품까지 진단하기 →
          </Link>
        </div>
      )}

      {audit && <AuditStrip audit={audit} />}
      {material && <MaterialPair material={material} reportHref={reportHref} />}
    </HomeCard>
  );
}

/**
 * 진단 카드 — 발행된 리포트가 아직 없을 때. 채워졌을 때와 **같은 세 구획**(점수 · 표현 감사 · 재설계)을
 * 빈 틀로 보여 준다: 무엇이 채워질지를 가르치고, 없는 숫자는 만들지 않는다.
 * 버튼은 두지 않는다 — "진단 시작"은 옆의 다음 단계 카드 하나뿐이다.
 * @param running 진단이 도는 중이면 머리의 상태 문구가 바뀐다
 */
export function HomeReportEmptyCard({ running }: { running: boolean }) {
  const parts: { title: string; desc: string; figure: React.ReactNode }[] = [
    {
      title: '일본 상세 관례 충족도',
      desc: '100점 기준 종합 점수와 A~E 영역별 충족도',
      figure: (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-[5px] border-n-150 text-[11px] font-extrabold text-ink-mute">
          /100
        </span>
      ),
    },
    {
      title: '약기법 표현 감사',
      desc: '문장마다 불가 · 조건부 · 가능 판정과 근거 조항',
      figure: (
        <span className="flex h-12 items-center gap-1">
          <span className="inline-flex h-[22px] items-center rounded-full bg-danger-bg px-2 text-[11px] font-bold text-danger-text">
            ✕
          </span>
          <span className="inline-flex h-[22px] items-center rounded-full bg-amber-bg px-2 text-[11px] font-bold text-amber-text">
            △
          </span>
          <span className="inline-flex h-[22px] items-center rounded-full bg-green-bg px-2 text-[11px] font-bold text-green-text">
            ○
          </span>
        </span>
      ),
    },
    {
      title: '재설계 문구',
      desc: '원문을 일본 고객 관점의 일본어 문구로, 바꾼 이유와 함께',
      figure: (
        <span className="flex h-12 items-center gap-1.5 text-[11px] font-bold">
          <span className="inline-flex h-[22px] items-center rounded-[6px] bg-n-150 px-2 text-ink-mute">원문</span>
          <span className="text-ink-ghost">→</span>
          <span
            lang="ja"
            className="inline-flex h-[22px] items-center rounded-[6px] bg-coral-tint px-2 text-coral-strong"
          >
            日本語
          </span>
        </span>
      ),
    },
  ];

  /* 진단 폼이 실제로 받는 입력(api/report parseTierInput) — 포지셔닝 1개 이상은 필수, 콘텐츠가 있어야
     점수·감사·재설계가 나온다(없으면 브랜드 진단), 제품 정보는 선택이다 */
  const inputs: { tag: string; tone: string; text: string }[] = [
    { tag: '필수', tone: 'bg-coral-tint text-coral-strong', text: '브랜드 포지셔닝 1개 이상' },
    { tag: '권장', tone: 'bg-amber-bg text-amber-text', text: '상세페이지 이미지 또는 문구 50자 이상' },
    { tag: '선택', tone: 'bg-n-150 text-ink-mute', text: '제품명 · 주요 성분 · 가격' },
  ];

  return (
    <HomeCard
      title="진단 리포트"
      titleId="report-t"
      meta={running ? '진단이 진행 중이에요 — 발행되면 이 카드에 채워집니다' : '첫 진단을 마치면 이 카드에 채워집니다'}
      className="h-full"
    >
      <p className={`${HOME_LABEL} mt-6`}>리포트에 담기는 것</p>
      <ul className="mt-3.5 grid list-none gap-x-8 gap-y-6 p-0 md:grid-cols-3">
        {parts.map((p) => (
          <li key={p.title}>
            <span aria-hidden className="flex">
              {p.figure}
            </span>
            <p className="mt-3 text-[14px] font-bold text-ink">{p.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">{p.desc}</p>
          </li>
        ))}
      </ul>

      {/* 준비물 — 누르기 전에 무엇을 들고 가야 하는지. 카드 아래에 붙여 둔다 */}
      <div className="mt-auto pt-7">
        <div className="rounded-panel bg-n-50 px-5 py-4">
          <p className={HOME_LABEL}>진단에 넣는 것</p>
          <ul className="mt-3 grid list-none gap-x-6 gap-y-2.5 p-0 md:grid-cols-3">
            {inputs.map((it) => (
              <li key={it.tag} className="flex items-start gap-2 text-[13px] leading-snug text-ink-body">
                <span
                  className={`mt-px inline-flex h-5 flex-none items-center rounded-full px-2 text-[11px] font-bold ${it.tone}`}
                >
                  {it.tag}
                </span>
                <span className="[text-wrap:pretty]">{it.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">
            문구 없이 시작하면 브랜드 진단으로 나옵니다 — 충족도 점수와 표현 감사는 제품 콘텐츠가 있을 때 산출됩니다.
          </p>
        </div>
      </div>
    </HomeCard>
  );
}
