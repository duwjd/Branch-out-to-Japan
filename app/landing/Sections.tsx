/**
 * 랜딩 본문 섹션 — Figma LP_Nonmember_Desktop_v2 순서 그대로.
 * 전부 서버 컴포넌트다(상태 없음). 진입 애니메이션은 Reveal이 감싼다.
 * 카피는 content.ts에서만 온다.
 */

import { Illustration, LandingShot } from '@/components/landing/Illustration';
import { Reveal } from '@/components/landing/Reveal';
import { TrackedCta } from '@/components/landing/TrackedCta';
import {
  CORE_FLOW,
  FAQ,
  FUTURE,
  PILOT_CTA,
  PRODUCT_EXAMPLE,
  PROBLEM,
  SERVICE_CREATE,
  SERVICE_DIAGNOSE,
  TRUST,
  WORKFLOW,
} from './content';
import { LpBullets, LpChip, LpEyebrow, LpHeading, LpPullQuote, LpSection, lpButtonClass } from './primitives';

/* ── 번역 이후에도, 두 번 막힙니다 ─────────────────────────── */
export function ProblemGaps() {
  return (
    <LpSection>
      <LpHeading lead={PROBLEM.lead}>{PROBLEM.heading}</LpHeading>
      <div className="mt-14 grid grid-cols-2 gap-8 max-lg:grid-cols-1">
        {PROBLEM.cards.map((card, i) => (
          <Reveal key={card.title} delay={i * 80}>
            <article className="h-full rounded-2xl border border-lp-line bg-white px-9 pt-9 pb-7 max-sm:px-6 max-sm:pt-7">
              {/* 제목 블록과 일러스트가 한 줄(Figma `top`) — 일러스트가 없으면 제목이 폭을 다 쓴다 */}
              <div className="flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold tracking-[0.08em] text-lp-faint">{card.eyebrow}</p>
                  <h3 className="mt-2.5 text-lp-h3 font-bold break-keep text-lp-ink max-sm:text-[22px]">{card.title}</h3>
                </div>
                <Illustration
                  name={card.illustration}
                  width={card.illustrationWidth}
                  height={147}
                  className="flex-none max-sm:hidden"
                />
              </div>
              <p className="mt-1 text-lp-body text-lp-body [text-wrap:pretty]">{card.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <div className="mt-14 flex justify-center">
        <span className="inline-flex items-center gap-3 rounded-full bg-lp-coral-tint py-3.5 pr-6 pl-5.5 text-lp-body font-semibold text-lp-ink">
          <span aria-hidden className="h-2 w-2 rounded-full bg-lp-coral" />
          {PROBLEM.bridge}
        </span>
      </div>
    </LpSection>
  );
}

/* ── 진단에서 제작까지, 하나의 흐름 ───────────────────────── */
export function CoreFlow() {
  return (
    <LpSection tone="warm">
      <LpHeading>{CORE_FLOW.heading}</LpHeading>
      <ol className="mt-14 flex list-none items-stretch justify-between gap-4 max-lg:flex-col">
        {CORE_FLOW.steps.map((step, i) => (
          <li key={step.no} className="contents">
            <Reveal delay={i * 80} className="flex-1">
              <article
                className={`flex h-full flex-col gap-3 rounded-2xl p-8 ${
                  step.ready ? 'border border-lp-line bg-white' : 'border border-dashed border-lp-line bg-lp-dim'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`text-lp-h4 font-bold ${step.ready ? 'text-lp-coral' : 'text-lp-faint'}`}>{step.no}</span>
                  <h3 className={`text-lp-h3 font-bold max-sm:text-[22px] ${step.ready ? 'text-lp-ink' : 'text-lp-muted'}`}>
                    {step.title}
                  </h3>
                  {'badge' in step && step.badge && (
                    <span className="rounded-full border border-lp-line-strong bg-white px-2.5 py-1 text-[13px] font-medium text-lp-muted">
                      {step.badge}
                    </span>
                  )}
                </div>
                <p className="text-lp-body text-lp-body [text-wrap:pretty]">{step.body}</p>
              </article>
            </Reveal>
            {i < CORE_FLOW.steps.length - 1 && (
              <span
                aria-hidden
                className={`mt-[86px] h-0.5 w-16 flex-none self-start rounded-full max-lg:hidden ${
                  i === 0 ? 'bg-lp-coral' : 'bg-lp-line-strong'
                }`}
              />
            )}
          </li>
        ))}
      </ol>
      <p className="mx-auto mt-14 max-w-[900px] text-center text-[14px] leading-[1.5] text-lp-muted [text-wrap:pretty]">
        {CORE_FLOW.note}
      </p>
    </LpSection>
  );
}

/* ── SERVICE 01 · DIAGNOSE ─────────────────────────────────── */
export function ServiceDiagnose() {
  return (
    <LpSection id="service">
      <div className="grid grid-cols-[minmax(0,460px)_minmax(0,1fr)] gap-16 max-lg:grid-cols-1">
        <Reveal className="flex flex-col gap-5.5">
          <LpEyebrow>{SERVICE_DIAGNOSE.eyebrow}</LpEyebrow>
          <h2 className="text-lp-h2 font-bold break-keep text-lp-ink max-sm:text-[30px]">
            {SERVICE_DIAGNOSE.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="text-lp-body text-lp-body [text-wrap:pretty]">{SERVICE_DIAGNOSE.lead}</p>
          <LpBullets items={SERVICE_DIAGNOSE.items} />
          <LpPullQuote>{SERVICE_DIAGNOSE.pull}</LpPullQuote>
          <Illustration name="service-diagnose" width={227} height={147} className="mt-2" />
        </Reveal>
        <Reveal delay={100}>
          <DiagnosePreview />
        </Reveal>
      </div>
    </LpSection>
  );
}

/** 진단 리포트 화면 미리보기(Figma UI_DiagnoseResult) — 실제 리포트 한 건을 축약해 옮긴 예시 카드 */
function DiagnosePreview() {
  const c = SERVICE_DIAGNOSE.preview;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-lp-line bg-white px-7 py-6.5 shadow-[0px_8px_24px_0px_rgba(23,36,51,0.06)] max-sm:px-5 max-sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-lp-body font-semibold text-lp-ink">
          <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-lp-coral" />
          {c.title}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-lp-risk-tint py-[7px] pr-3.5 pl-3 text-[14px] font-semibold whitespace-nowrap text-lp-risk">
          <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full bg-lp-risk" />
          {c.status}
        </span>
      </div>

      <span aria-hidden className="h-px w-full bg-lp-line" />

      <div className="rounded-[10px] bg-lp-risk-tint px-4.5 py-4">
        <p className="text-[13px] leading-[1.5] font-medium text-lp-muted">{c.sourceLabel}</p>
        <p className="mt-2 text-lp-h4 font-bold text-lp-ink">
          {c.source.head}
          <span className="text-lp-risk">{c.source.risk}</span>
          {c.source.tail}
        </p>
        <p className="mt-2 text-[14px] leading-[1.5] text-lp-risk [text-wrap:pretty]">{c.sourceNote}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <div className="flex flex-col gap-2.5 rounded-[10px] bg-lp-panel px-4 py-3.5">
          <p className="text-[13px] leading-[1.5] font-medium text-lp-muted">{c.altLabel}</p>
          {c.alts.map((alt) => (
            <p key={alt} lang="ja" className="rounded-lg bg-white px-3 py-2.5 text-[15px] leading-[1.8] text-lp-ink">
              {alt}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-2.5 rounded-[10px] bg-lp-panel px-4 py-3.5">
          <p className="text-[13px] leading-[1.5] font-medium text-lp-muted">{c.evidenceLabel}</p>
          <ul className="flex list-none flex-col gap-2.5">
            {c.evidence.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-lp-sm text-lp-body">
                <span aria-hidden className="mt-[10px] h-[5px] w-[5px] flex-none rounded-full bg-lp-coral" />
                <span className="[text-wrap:pretty]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-[10px] border border-lp-line bg-white px-4.5 py-3.5">
        <p className="text-[13px] leading-[1.5] font-medium text-lp-muted">{c.reasonLabel}</p>
        <p className="mt-1.5 text-lp-sm text-lp-body [text-wrap:pretty]">{c.reason}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-[13px] leading-[1.5] font-medium text-lp-faint">{c.metaLabel}</p>
        {c.metaChips.map((chip) => (
          <span
            key={chip}
            className="inline-flex rounded-full border border-lp-line bg-white py-[5px] pr-[11px] pl-2.5 text-[13px] font-medium text-lp-muted"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── SERVICE 02 · CREATE ──────────────────────────────────── */
export function ServiceCreate() {
  return (
    <LpSection tone="warm">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,460px)] gap-16 max-lg:grid-cols-1">
        <Reveal className="max-lg:order-2">
          <CreatePreview />
        </Reveal>
        <Reveal delay={100} className="flex flex-col gap-5.5 max-lg:order-1">
          <LpEyebrow>{SERVICE_CREATE.eyebrow}</LpEyebrow>
          <h2 className="text-lp-h2 font-bold break-keep text-lp-ink max-sm:text-[30px]">
            {SERVICE_CREATE.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="text-lp-body text-lp-body [text-wrap:pretty]">{SERVICE_CREATE.lead}</p>
          <LpBullets items={SERVICE_CREATE.items} />
          <LpPullQuote>
            {SERVICE_CREATE.pull.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </LpPullQuote>
          <p className="text-[14px] leading-[1.5] text-lp-faint">{SERVICE_CREATE.note}</p>
          <Illustration name="service-studio" width={130} height={158} className="mt-2" />
        </Reveal>
      </div>
    </LpSection>
  );
}

/**
 * 마케팅 스튜디오 결과 화면 미리보기(Figma UI_Studio) — 채널 선택 → 썸네일 3안 → 상세페이지 순.
 * 썸네일·상세페이지의 이미지 자리는 실제 생성물이 들어가는 칸이라, 여기서는 비율만 남긴 자리표시다.
 */
function CreatePreview() {
  const c = SERVICE_CREATE.preview;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-lp-line bg-white px-7 py-6.5 max-sm:px-5 max-sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-lp-body font-semibold text-lp-ink">
          <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-lp-coral" />
          {c.title}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-lp-review-tint py-[7px] pr-3.5 pl-3 text-[14px] font-semibold whitespace-nowrap text-lp-review">
          <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full bg-lp-review" />
          {c.status}
        </span>
      </div>

      <div>
        <p className="text-[13px] leading-[1.5] font-medium text-lp-muted">{c.channelLabel}</p>
        <ul className="mt-2.5 flex list-none flex-wrap gap-2">
          {c.channels.map((channel, i) => (
            <li
              key={channel}
              className={`rounded-full border px-4 py-[9px] text-[15px] leading-[1.5] font-semibold ${
                i === 0 ? 'border-lp-coral bg-lp-coral text-white' : 'border-lp-line bg-white text-lp-body'
              }`}
            >
              {channel}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[13px] leading-[1.5] font-medium text-lp-muted">{c.thumbLabel}</p>
        <ul className="mt-2.5 grid list-none grid-cols-3 gap-4 max-sm:grid-cols-1">
          {c.thumbs.map((thumb) => (
            <li key={thumb.name} className="flex h-full flex-col rounded-xl border border-lp-line bg-lp-surface p-2.5">
              <LandingShot name={thumb.shot} alt={thumb.name} className="rounded-lg" />
              <p lang="ja" className="mt-2.5 text-[13px] leading-[1.7] font-semibold text-lp-ink">
                {thumb.ja}
              </p>
              {/* 템플릿 이름은 카드 바닥에 정렬한다 — 카피 줄 수가 달라도 세 카드가 같은 선에서 끝난다 */}
              <p className="mt-auto pt-2 text-[12px] font-medium text-lp-muted">{thumb.name}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[13px] leading-[1.5] font-medium text-lp-muted">{c.detailLabel}</p>
        <div className="mt-2.5 flex items-start gap-4 rounded-xl border border-lp-line bg-lp-surface p-4 max-sm:flex-col">
          <LandingShot
            name="studio-detail"
            alt={c.detailLabel}
            ratio="wide"
            className="w-[180px] flex-none rounded-lg max-sm:w-full"
          />
          <div className="min-w-0">
            <p lang="ja" className="text-lp-h4 font-bold text-lp-ink">
              {c.detailJa.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
            <p className="mt-2.5 flex items-center gap-2 text-[13px] text-lp-muted">
              <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-lp-coral" />
              {c.detailNote}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {c.beforeAfter.map((row) => (
          <div key={row.label} className="rounded-lg border border-lp-line bg-white px-3.5 py-3">
            <p className="text-[12px] font-semibold text-lp-faint">{row.label}</p>
            <p lang={row.lang} className="mt-1.5 text-[14px] font-medium text-lp-ink">
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 한 문장이, 진단을 거쳐 제작물이 되기까지 ──────────────── */
export function ProductExample() {
  const { before, diagnose, create } = PRODUCT_EXAMPLE;
  return (
    <LpSection>
      <LpHeading lead={PRODUCT_EXAMPLE.lead}>{PRODUCT_EXAMPLE.heading}</LpHeading>

      <div className="mt-14 grid grid-cols-[minmax(0,330px)_28px_minmax(0,412px)_28px_minmax(0,330px)] items-stretch justify-center gap-4 max-lg:grid-cols-1">
        <Reveal>
          <article className="h-full rounded-2xl border border-lp-line bg-lp-surface p-6">
            <p className="text-[14px] font-semibold tracking-[0.06em] text-lp-faint">{before.label}</p>
            <LandingShot name="example-before" alt={before.title} className="mt-5 rounded-xl" />
            <p className="mt-5 text-[13px] font-semibold text-lp-faint">{before.title}</p>
            <p className="mt-2 text-[14px] leading-[1.7] text-lp-body [text-wrap:pretty]">{before.body}</p>
            <ul className="mt-4 flex list-none flex-wrap gap-2">
              {before.chips.map((c) => (
                <li key={c}>
                  <span className="inline-flex rounded-full border border-lp-line bg-white px-3 py-1 text-[12.5px] font-medium text-lp-muted">
                    {c}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[13px] text-lp-muted">{before.caption}</p>
          </article>
        </Reveal>

        <Arrow />

        <Reveal delay={80}>
          <article className="h-full rounded-2xl border border-lp-line bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-semibold tracking-[0.06em] text-lp-faint">{diagnose.label}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lp-conditional-tint py-[7px] pr-3.5 pl-3 text-[14px] font-semibold whitespace-nowrap text-lp-conditional">
                <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full bg-lp-conditional" />
                {diagnose.status}
              </span>
            </div>
            {/* 확인 단계는 체크박스로 — 결론이 아니라 "확인해야 할 목록"이라는 뜻을 형태로 남긴다 */}
            <ul className="mt-5 flex list-none flex-col gap-2.5">
              {diagnose.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[14px] leading-[1.6] text-lp-body">
                  <span
                    aria-hidden
                    className="mt-[5px] h-[13px] w-[13px] flex-none rounded-[3px] border border-lp-line-strong bg-white"
                  />
                  <span className="[text-wrap:pretty]">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[13px] font-semibold text-lp-faint">{diagnose.altLabel}</p>
            <ul className="mt-2 flex list-none flex-col gap-2">
              {diagnose.alts.map((alt) => (
                <li
                  key={alt}
                  lang="ja"
                  className="rounded-lg border border-lp-line bg-lp-surface px-3.5 py-2.5 text-[14px] font-semibold text-lp-ink"
                >
                  {alt}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[13px] leading-[1.7] text-lp-muted [text-wrap:pretty]">{diagnose.reason}</p>
          </article>
        </Reveal>

        <Arrow />

        <Reveal delay={160}>
          <article className="h-full rounded-2xl border border-lp-line bg-lp-surface p-6">
            <p className="text-[14px] font-semibold tracking-[0.06em] text-lp-faint">{create.label}</p>
            <LandingShot name="example-create" alt={create.body} className="mt-5 rounded-xl" />
            <p className="mt-5 text-[13px] font-semibold text-lp-faint">{create.title}</p>
            <p className="mt-2 text-[14px] font-medium text-lp-body">{create.body}</p>
            <div className="mt-4 rounded-xl border border-lp-line bg-white p-3.5">
              <p className="text-[13px] font-bold text-lp-ink">{create.styleName}</p>
              <p className="mt-2 text-[13px] leading-[1.65] text-lp-muted [text-wrap:pretty]">{create.styleBody}</p>
            </div>
            <p className="mt-6 flex items-center gap-2 text-[13px] text-lp-muted">
              <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-lp-coral" />
              {create.caption}
            </p>
          </article>
        </Reveal>
      </div>

      <p className="mx-auto mt-12 max-w-[900px] text-center text-[14px] text-lp-muted">{PRODUCT_EXAMPLE.note}</p>
    </LpSection>
  );
}

/** 흐름 화살표 — 좁은 화면에서는 세로로 눕는다 */
function Arrow() {
  return (
    <span aria-hidden className="flex items-center justify-center text-lp-line-strong max-lg:rotate-90">
      <svg width="28" height="14" viewBox="0 0 28 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M0 7h26M20 1.5 26.5 7 20 12.5" />
      </svg>
    </span>
  );
}

/* ── 자료를 연결하면, 진단에서 제작까지 이어집니다 ────────── */
export function Workflow() {
  return (
    <LpSection id="workflow" tone="warm">
      <LpHeading>{WORKFLOW.heading}</LpHeading>
      <ol className="mt-14 grid list-none grid-cols-5 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {WORKFLOW.steps.map((step, i) => (
          <li key={step.no}>
            <Reveal delay={i * 60}>
              <article className="flex h-full flex-col gap-2.5 rounded-[14px] border border-lp-line bg-white px-5.5 py-6">
                <p className="text-[34px] leading-[1.1] font-extrabold tracking-[-0.02em] text-lp-coral">{step.no}</p>
                <h3 className="text-lp-h4 font-bold text-lp-ink">{step.title}</h3>
                <p className="text-[14px] leading-[1.5] text-lp-body [text-wrap:pretty]">{step.body}</p>
              </article>
            </Reveal>
          </li>
        ))}
      </ol>
      <p className="mx-auto mt-14 max-w-[900px] text-center text-[14px] text-lp-muted">{WORKFLOW.note}</p>
    </LpSection>
  );
}

/* ── COMING NEXT · CONNECT ────────────────────────────────── */
export function FutureOperations() {
  return (
    <LpSection id="future">
      <div className="grid grid-cols-[minmax(0,520px)_minmax(0,1fr)] gap-16 max-lg:grid-cols-1">
        <Reveal className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <LpEyebrow>{FUTURE.eyebrow}</LpEyebrow>
            <span className="rounded-full border border-lp-line-strong bg-white px-2.5 py-1 text-[13px] font-medium text-lp-muted">
              {FUTURE.badge}
            </span>
          </div>
          <h2 className="text-lp-h2 font-bold break-keep text-lp-ink max-sm:text-[30px]">
            {FUTURE.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="text-lp-body text-lp-body [text-wrap:pretty]">{FUTURE.lead}</p>
          <LpBullets items={FUTURE.items} />
          {/* 아직 제공하지 않는 범위라, 고지를 본문과 같은 무게로 두지 않고 별도 상자에 담는다 */}
          <p className="rounded-xl bg-lp-panel px-4.5 py-3.5 text-[14px] leading-[1.7] text-lp-muted [text-wrap:pretty]">
            {FUTURE.note}
          </p>
        </Reveal>
        <Reveal delay={100} className="flex flex-col gap-6">
          <PartnerMatchPreview />
          <Illustration name="future-connect" width={230} height={172} />
        </Reveal>
      </div>
    </LpSection>
  );
}

/** 파트너 매칭 화면 예고(Figma UI_PartnerMatch) — 확장 범위라 점선 테두리로 "아직 아님"을 남긴다 */
function PartnerMatchPreview() {
  const c = FUTURE.preview;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-lp-line bg-lp-dim px-6.5 py-6 max-sm:px-5 max-sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lp-body font-semibold text-lp-ink">{c.title}</p>
        <span className="rounded-full border border-lp-line-strong bg-white px-2.5 py-1 text-[13px] font-medium text-lp-muted">
          {c.badge}
        </span>
      </div>

      <div className="rounded-xl bg-white px-4 py-3.5">
        <p className="text-[13px] leading-[1.5] font-medium text-lp-muted">{c.conditionLabel}</p>
        <dl className="mt-2.5 flex flex-col gap-2">
          {c.conditions.map((row) => (
            <div key={row.k} className="flex items-baseline justify-between gap-4">
              <dt className="text-[14px] text-lp-muted">{row.k}</dt>
              <dd className="text-right text-[14px] font-medium text-lp-body">{row.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <span aria-hidden className="h-px w-full bg-lp-line" />

      <div>
        <p className="text-[13px] leading-[1.5] font-medium text-lp-muted">{c.candidateLabel}</p>
        <ul className="mt-2.5 flex list-none flex-col gap-2.5">
          {c.candidates.map((cand) => (
            <li key={cand.title} className="flex items-center gap-3.5 rounded-xl bg-white px-4 py-3.5">
              <span aria-hidden className="h-7 w-7 flex-none rounded-lg bg-lp-coral-tint" />
              <div className="min-w-0 flex-1">
                <p className="text-lp-sm font-semibold text-lp-ink">{cand.title}</p>
                <p className="mt-0.5 text-[13px] text-lp-muted [text-wrap:pretty]">{cand.desc}</p>
              </div>
              <span className="flex-none text-[13px] font-medium whitespace-nowrap text-lp-faint">{cand.state}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── 판단 근거를 남기고, 최종 검토를 돕습니다 ─────────────── */
export function Trust() {
  return (
    <LpSection tone="warm">
      <LpHeading>{TRUST.heading}</LpHeading>
      <ul className="mt-13 grid list-none grid-cols-4 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {TRUST.cards.map((card, i) => (
          <li key={card.title}>
            <Reveal delay={i * 60}>
              <article className="flex h-full flex-col gap-3 rounded-[14px] border border-lp-line bg-white px-6.5 py-7">
                <span aria-hidden className="h-[3px] w-8 rounded-sm bg-lp-coral" />
                <h3 className="text-lp-h4 font-bold text-lp-ink">{card.title}</h3>
                <p className="text-lp-sm text-lp-body [text-wrap:pretty]">{card.body}</p>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>
      <div className="mt-13 flex gap-4.5 rounded-xl bg-lp-coral-tint px-7 py-6">
        <span aria-hidden className="w-[3px] flex-none rounded-sm bg-lp-coral" />
        <div>
          <p className="text-[14px] font-semibold text-lp-coral">{TRUST.disclosureLabel}</p>
          <p className="mt-1.5 text-lp-body text-lp-ink [text-wrap:pretty]">{TRUST.disclosure}</p>
        </div>
      </div>
    </LpSection>
  );
}

/* ── 먼저 무료 파일럿 진단으로 확인하세요 ─────────────────── */
export function PilotCta() {
  return (
    <LpSection tone="navy" className="relative overflow-hidden">
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-[300px] w-[680px] rounded-full bg-[radial-gradient(closest-side,rgba(255,111,97,0.28),transparent)]"
      />
      <div className="relative flex items-center justify-between gap-16 max-lg:gap-10">
        <div className="max-w-[660px]">
          <h2 className="text-lp-h2 font-bold break-keep text-white max-sm:text-[30px] [text-wrap:pretty]">
            {PILOT_CTA.heading}
          </h2>
          <p className="mt-5 text-lp-lead text-lp-on-navy-muted max-sm:text-[16px] [text-wrap:pretty]">{PILOT_CTA.lead}</p>
          <ul className="mt-5 flex list-none flex-wrap gap-2.5">
            {PILOT_CTA.items.map((item) => (
              <li key={item}>
                <LpChip tone="onNavy">{item}</LpChip>
              </li>
            ))}
          </ul>
          <TrackedCta cta="footer_pilot" targetId="apply" className={lpButtonClass('primary', 'mt-5 min-w-[180px]')}>
            {PILOT_CTA.cta}
          </TrackedCta>
          <p className="mt-5 text-[14px] leading-[1.5] text-lp-on-navy-muted [text-wrap:pretty]">{PILOT_CTA.note}</p>
        </div>
        <Illustration name="cta-pilot" width={215} height={208} className="flex-none max-lg:hidden" />
      </div>
    </LpSection>
  );
}

/* ── 자주 묻는 질문 ───────────────────────────────────────── */
export function Faq() {
  return (
    <LpSection id="faq">
      <LpHeading>자주 묻는 질문</LpHeading>
      <div className="mx-auto mt-13 flex max-w-[940px] flex-col gap-3.5">
        {FAQ.map((row, i) => (
          <details
            key={row.q}
            open={i === 0}
            className="group rounded-xl border border-lp-line bg-white px-7 py-6 open:border-lp-coral"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lp-body font-semibold text-lp-ink [&::-webkit-details-marker]:hidden">
              {row.q}
              <span
                aria-hidden
                className="flex-none text-lp-faint transition-transform duration-200 ease-standard group-open:rotate-180"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </summary>
            <p className="mt-3.5 text-lp-body text-lp-body [text-wrap:pretty]">{row.a}</p>
          </details>
        ))}
      </div>
    </LpSection>
  );
}
