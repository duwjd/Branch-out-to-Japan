/**
 * 랜딩 본문 섹션 — Figma LP_Nonmember_Desktop_v2 순서 그대로.
 * 전부 서버 컴포넌트다(상태 없음). 진입 애니메이션은 Reveal이 감싼다.
 * 카피는 content.ts에서만 온다.
 */

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
            <article className="h-full rounded-2xl border border-lp-line bg-white px-9 pt-9 pb-7">
              <p className="text-[14px] font-semibold tracking-[0.08em] text-lp-faint">{card.eyebrow}</p>
              <h3 className="mt-2.5 text-lp-h3 font-bold break-keep text-lp-ink max-sm:text-[22px]">{card.title}</h3>
              <p className="mt-4 text-lp-body text-lp-body [text-wrap:pretty]">{card.body}</p>
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
        </Reveal>
        <Reveal delay={100}>
          <DiagnosePreview />
        </Reveal>
      </div>
    </LpSection>
  );
}

/** 진단 리포트 화면 미리보기 — 실제 리포트가 무엇을 보여주는지 축약해 옮긴 예시 카드 */
function DiagnosePreview() {
  return (
    <div className="rounded-2xl border border-lp-line bg-lp-surface p-7 max-sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-lp-faint">진단 리포트 · 주장 01</p>
        <span className="rounded-full bg-lp-conditional-tint px-3 py-1 text-[13px] font-bold text-lp-conditional">
          조건부 △
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-lp-line bg-white p-5">
        <p className="text-[13px] font-semibold text-lp-faint">입력 · 한국어 원문</p>
        <p className="mt-2 text-lp-h4 font-bold text-lp-ink">산뜻하게 48시간 촉촉</p>
        <p className="mt-2 text-[14px] leading-[1.6] text-lp-muted [text-wrap:pretty]">
          감지된 위험 요소 · 시간 수치 표현과 사용감 주장이 함께 붙어 있습니다.
        </p>
      </div>

      <div className="mt-3.5 rounded-xl border border-lp-line bg-white p-5">
        <p className="text-[13px] font-semibold text-lp-faint">대체 표현 (일본어)</p>
        <p lang="ja" className="mt-2 text-lp-sm font-semibold text-lp-ink">
          乾燥した肌に、うるおいを与える
        </p>
        <p lang="ja" className="mt-1.5 text-lp-sm font-semibold text-lp-ink">
          乾燥に負けない、なめらかうるおい肌へ
        </p>
      </div>

      <div className="mt-3.5 rounded-xl border border-lp-line bg-white p-5">
        <p className="text-[13px] font-semibold text-lp-faint">변경 이유</p>
        <p className="mt-2 text-[14px] leading-[1.7] text-lp-body [text-wrap:pretty]">
          48시간 수치 주장의 근거가 입력되지 않아 수치를 빼고, 사용감 의도만 남겨 재설계했습니다.
        </p>
      </div>

      <ul className="mt-4 flex list-none flex-wrap gap-2">
        {['적용 규칙 버전', '원문·수정안 비교', '검토 이력 3건'].map((chip) => (
          <li key={chip}>
            <span className="inline-flex rounded-full border border-lp-line bg-white px-3 py-1.5 text-[13px] font-medium text-lp-muted">
              {chip}
            </span>
          </li>
        ))}
      </ul>
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
        </Reveal>
      </div>
    </LpSection>
  );
}

/** 마케팅 스튜디오 생성 결과 미리보기 — 채널 칩 + 썸네일 3안 + 상세페이지 상단 구간 */
function CreatePreview() {
  return (
    <div className="rounded-2xl border border-lp-line bg-white p-7 max-sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-lp-faint">마케팅 스튜디오 · 생성 결과</p>
        <span className="rounded-full bg-lp-review-tint px-3 py-1 text-[13px] font-bold text-lp-review">
          검토 가능 ○
        </span>
      </div>

      <p className="mt-5 text-[13px] font-semibold text-lp-faint">목표 채널</p>
      <ul className="mt-2 flex list-none flex-wrap gap-2">
        {['Qoo10', '아마존JP', '라쿠텐 공식샵', '라쿠텐 리셀러', '자사몰', '기타'].map((c) => (
          <li key={c}>
            <span className="inline-flex rounded-full border border-lp-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-lp-body">
              {c}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13px] font-semibold text-lp-faint">썸네일 3안</p>
      <ul className="mt-2 grid list-none grid-cols-3 gap-3 max-sm:grid-cols-1">
        {[
          { ja: '乾いた肌にうるおいを与える', name: '캐치카피+성분 비주얼형' },
          { ja: 'プレゼントセット', name: '프로모션 강조형' },
          { ja: '乾燥に負けない、なめらかうるおい肌へ', name: '모델+카피형' },
        ].map((t) => (
          <li key={t.name} className="rounded-xl border border-lp-line bg-lp-surface p-3.5">
            <p lang="ja" className="min-h-[3.4em] text-[13px] leading-[1.7] font-semibold text-lp-ink">
              {t.ja}
            </p>
            <p className="mt-2 text-[12px] font-medium text-lp-muted">{t.name}</p>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13px] font-semibold text-lp-faint">상세페이지 상단 구간</p>
      <div className="mt-2 rounded-xl border border-lp-line bg-lp-surface p-5">
        <p lang="ja" className="text-lp-h4 font-bold text-lp-ink">
          乾燥が気になる肌へ、うるおいを角質層まで
        </p>
        <p className="mt-2.5 text-[13px] text-lp-muted">진단 리포트 주장 01의 근거와 연결됨</p>
        <div className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="rounded-lg border border-lp-line bg-white p-3.5">
            <p className="text-[12px] font-semibold text-lp-faint">수정 전 · 원문</p>
            <p className="mt-1.5 text-[14px] font-medium text-lp-body">산뜻하게 48시간 촉촉</p>
          </div>
          <div className="rounded-lg border border-lp-line bg-white p-3.5">
            <p className="text-[12px] font-semibold text-lp-faint">수정 후 · 반영안</p>
            <p lang="ja" className="mt-1.5 text-[14px] font-medium text-lp-ink">
              乾いた肌に、うるおいを与える
            </p>
          </div>
        </div>
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
            <p className="mt-6 text-[13px] font-semibold text-lp-faint">{before.title}</p>
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
            <p className="text-[14px] font-semibold tracking-[0.06em] text-lp-faint">{diagnose.label}</p>
            <ul className="mt-5 flex list-none flex-col gap-2.5">
              {diagnose.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[14px] leading-[1.6] text-lp-body">
                  <span aria-hidden className="mt-[9px] h-[5px] w-[5px] flex-none rounded-full bg-lp-coral" />
                  <span className="[text-wrap:pretty]">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[13px] font-semibold text-lp-faint">{diagnose.altLabel}</p>
            <ul className="mt-2 flex list-none flex-col gap-2">
              {diagnose.alts.map((alt) => (
                <li key={alt} lang="ja" className="rounded-lg border border-lp-line bg-lp-surface px-3.5 py-2.5 text-[14px] font-semibold text-lp-ink">
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
            <p className="mt-6 text-[13px] font-semibold text-lp-faint">{create.title}</p>
            <p className="mt-2 text-[14px] font-medium text-lp-body">{create.body}</p>
            <div className="mt-4 rounded-xl border border-lp-line bg-white p-3.5">
              <p className="text-[13px] font-bold text-lp-ink">{create.styleName}</p>
              <p className="mt-2 text-[13px] leading-[1.65] text-lp-muted [text-wrap:pretty]">{create.styleBody}</p>
            </div>
            <p className="mt-6 text-[13px] text-lp-muted">{create.caption}</p>
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
        </Reveal>
        <Reveal delay={100}>
          <div className="rounded-2xl border border-dashed border-lp-line bg-lp-dim p-7 max-sm:p-5">
            <LpBullets items={FUTURE.items} />
            <p className="mt-6 border-t border-lp-line pt-5 text-[14px] leading-[1.7] text-lp-muted [text-wrap:pretty]">
              {FUTURE.note}
            </p>
          </div>
        </Reveal>
      </div>
    </LpSection>
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
      <div className="relative max-w-[660px]">
        <h2 className="text-lp-h2 font-bold break-keep text-white max-sm:text-[30px] [text-wrap:pretty]">{PILOT_CTA.heading}</h2>
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
