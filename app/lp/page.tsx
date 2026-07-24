import type { Metadata } from 'next';
import Link from 'next/link';
import { KglowLogo } from '@/components/brand/Logo';
import { PILOT_OFFER, formatKrw } from '@/lib/lead';
import { PageView } from './PageView';
import { TrackedCta } from './TrackedCta';
import { LeadForm } from './LeadForm';
import { ScrollProgress } from './ScrollProgress';
import { Reveal } from './Reveal';
import { BeforeAfterShowcase } from './BeforeAfterShowcase';

/**
 * MVP 검증 랜딩(/lp) — 유튜브 유입 방문자가 흥미를 갖고 끝까지 스크롤하도록 설계한 서사형 랜딩.
 * 서사: 문제 공감 → 원인 재정의 → Before/After 시연(척추) → 근거(리포트) → 오퍼 → 방식 → FAQ → 신청.
 * 브랜드 원칙(차분·정돈·근거)에 맞춰 요란한 모션·채도 없이 타이포·여백·시연으로 몰입을 만든다.
 * 상담 신청(주 CTA)·자료받기(보조 CTA)로 지불의향을 측정. 가격은 가짜문(fake door).
 */

/** 유튜브 영상 ID — 값이 정해지면 여기에 넣는다. 빈 값이면 Before/After 시연 카드로 대체 렌더. */
const YOUTUBE_VIDEO_ID = '';

export const metadata: Metadata = {
  title: '일본 Qoo10에서 안 팔릴 때 — 상세페이지, 일본 고객 관점으로 진단 | KGLOW',
  description:
    '번역은 끝냈는데 일본에서 안 팔린다면? 薬機法 표현·리뷰(口コミ)·랭킹 정체 문제를 일본 고객 관점에서 진단합니다. 진단 리포트 30만원 정가, 지금 파일럿 참여 시 무료.',
};

const FAQ_ROWS = [
  {
    q: '번역과 뭐가 다른가요?',
    a: '문장을 일본어로 옮기는 게 아니라, 일본 고객이 무엇을 근거로 신뢰하고 구매하는지를 역설계해 정보 구조를 다시 짓습니다. 채점 기준과 코퍼스 근거를 전부 공개합니다.',
  },
  {
    q: '판정을 어떻게 믿나요?',
    a: '점수만 던지지 않습니다. 항목마다 통과 기준·내 문장·코퍼스 근거를 함께 노출하고, 약기법 판정에는 규정 조항을 각주로 답니다. 근거를 보고 직접 판단하실 수 있습니다.',
  },
  {
    q: '약기법 판정은 법적 판단인가요?',
    a: '아니요 — 공개 규정 기반 1차 스크리닝입니다. 한계를 리포트에 명시하고, 상시(上市) 전 약무 전문가 확인을 권고합니다. 귀찮고 위험한 표현 정리를 대신 안전하게 해드립니다.',
  },
  {
    q: '일본어를 못 읽어도 되나요?',
    a: '재설계된 모든 일본어 문장에 한국어 역해설이 병기됩니다. 무엇이 어떻게 바뀌었는지 한국어로 검수할 수 있습니다.',
  },
  {
    q: '파일럿은 정말 무료인가요?',
    a: `네. 정가 ${formatKrw(PILOT_OFFER.reportListPrice)}인 진단 리포트를 파일럿 참여 브랜드에 무료로 제공합니다. 선착순 ${PILOT_OFFER.pilotSeats}팀 한정입니다.`,
  },
];

const HOW_STEPS = [
  { n: '01', t: '브랜드 자산 연결', d: '상세페이지·SNS·광고 문구를 그대로 보내주세요. 새로 배울 도구는 없습니다.' },
  { n: '02', t: '전문가가 확정, AI가 속도', d: '일본 고객 관점의 진단·재설계를 사람이 확정하고, 반복 작업은 AI가 빠르게 처리합니다.' },
  { n: '03', t: '한국어 역해설과 함께 도착', d: '무엇이 왜 바뀌었는지 한국어 해설이 붙은 리포트를 받습니다. 그대로 검수·적용하면 됩니다.' },
];

/** 코랄 primary CTA — large/bold + white(대비 트레이드오프, 호버 시 강한 코랄로 보강) */
const CTA_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-coral px-6 py-3.5 text-[15px] font-bold text-white shadow-[0_10px_28px_-10px_rgba(255,100,100,0.75)] transition hover:-translate-y-px hover:bg-coral-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral';

/** 랜딩 섹션 래퍼 — canvas/page 교대로 리듬을 준다 */
function Section({ id, tint, children }: { id: string; tint?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className={tint ? 'bg-page' : 'bg-canvas'}>
      <div className="mx-auto max-w-4xl px-6 py-[clamp(3.5rem,7vw,5.5rem)]">{children}</div>
    </section>
  );
}

/** 섹션 제목 공통 스타일 */
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[clamp(1.5rem,3.4vw,2rem)] font-extrabold tracking-tight text-ink">{children}</h2>;
}

export default function LpPage() {
  return (
    <main className="bg-page text-ink-body">
      <PageView />
      <ScrollProgress />

      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/lp" aria-label="KGLOW 홈" className="rounded-md focus-visible:outline-2 focus-visible:outline-coral">
            <KglowLogo height={30} />
          </Link>
          <TrackedCta
            cta="header-consult"
            targetId="lead"
            className="inline-flex items-center rounded-lg bg-coral px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-coral-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          >
            무료 상담 신청
          </TrackedCta>
        </div>
      </header>

      {/* 히어로 */}
      <section className="relative overflow-hidden bg-canvas">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{ background: 'radial-gradient(760px 320px at 30% -60px, rgba(255,100,100,0.07), transparent)' }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-4xl px-6 py-[clamp(3.5rem,8vw,6rem)]">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <Reveal>
              <p className="text-[14px] font-semibold text-coral-strong">일본 진출 브랜드를 위한 콘텐츠 진단</p>
              <h1 className="mt-3 text-[clamp(2.1rem,5.4vw,3.35rem)] font-extrabold leading-[1.12] tracking-tight text-ink">
                번역은 끝냈는데,
                <br />왜 안 팔릴까?
              </h1>
              <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-ink-body">
                한국에서 잘 팔리던 문구를 그대로 옮기면, 문법은 맞아도 일본 고객은 &lsquo;살 이유&rsquo;를 못 찾습니다. 상세페이지를
                <b className="font-semibold text-ink"> 일본 고객 관점으로 다시 설계</b>합니다.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <TrackedCta cta="hero-consult" targetId="lead" className={CTA_PRIMARY}>
                  무료로 진단받기
                </TrackedCta>
                <TrackedCta
                  cta="hero-resource"
                  targetId="lead"
                  className="text-[15px] font-semibold text-coral-strong underline-offset-4 hover:underline"
                >
                  샘플 리포트 먼저 보기
                </TrackedCta>
              </div>
              <p className="mt-6 text-[13px] text-ink-mute">
                진단 리포트 정가 <span className="line-through">{formatKrw(PILOT_OFFER.reportListPrice)}</span> →{' '}
                <b className="font-bold text-ink">파일럿 무료</b> · 선착순 {PILOT_OFFER.pilotSeats}팀
              </p>
            </Reveal>

            {/* 우측 — 영상 또는 Before/After 시연 카드 */}
            <Reveal delay={120}>
              {YOUTUBE_VIDEO_ID ? (
                <div className="aspect-video w-full overflow-hidden rounded-card border border-card-border bg-black shadow-2">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}`}
                    title="KGLOW 소개 영상"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              ) : (
                /* 유튜브 영상 임베드 자리 — 영상 ID가 들어오면 위 iframe으로 교체된다. 동일 16:9로 레이아웃 예약. */
                <div
                  className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-card border border-dashed border-card-border bg-n-50 text-center shadow-2"
                  role="img"
                  aria-label="소개 영상 자리 — 준비 중"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-coral text-white shadow-[0_10px_28px_-10px_rgba(255,100,100,0.75)]">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <p className="text-[13px] font-semibold text-ink-mute">소개 영상 준비 중</p>
                </div>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {/* 문제 공감 — 2트랙 (동일 카드 반복 대신 헤어라인 분할) */}
      <Section id="problem" tint>
        <Reveal>
          <H2>지금 이런 상황인가요?</H2>
          <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-0">
            <div className="md:pr-10">
              <p className="text-[13px] font-bold text-coral-strong">입점 준비</p>
              <p className="mt-2 text-[17px] leading-relaxed text-ink-body">
                번역은 끝냈는데, 이게 일본에서 통할지 확신이 없다.
              </p>
            </div>
            <div className="md:border-l md:border-hairline md:pl-10">
              <p className="text-[13px] font-bold text-coral-strong">운영 정체</p>
              <p className="mt-2 text-[17px] leading-relaxed text-ink-body">
                입점은 했는데, 리뷰(口コミ)도 랭킹도 오르지 않는다.
              </p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* 원인 재정의 — 스크롤을 끌어내리는 브릿지 */}
      <Section id="reframe">
        <Reveal>
          <p className="max-w-[24ch] text-[clamp(1.6rem,4.2vw,2.5rem)] font-extrabold leading-[1.2] tracking-tight text-ink">
            번역이 문제가 아닙니다.
            <br />
            일본 고객은 <span className="text-coral-strong">&lsquo;사는 이유&rsquo;</span>를 다른 데서 봅니다.
          </p>
          <p className="mt-6 max-w-[60ch] text-[17px] leading-relaxed text-ink-body">
            근거 표기 방식, 성분을 말하는 순서, 리뷰에서 쓰는 말투 — 신뢰의 조건이 한국과 다릅니다. 그래서 문장을 옮기는 게 아니라, 사는
            이유를 처음부터 다시 설계합니다.
          </p>
        </Reveal>
      </Section>

      {/* Before/After 시연 ★ 최강 자산 */}
      <Section id="before-after" tint>
        <Reveal>
          <H2>직역과 재설계, 무엇이 다른가</H2>
          <p className="mt-3 max-w-[58ch] text-[16px] leading-relaxed text-ink-body">
            카테고리를 눌러 실제 예시를 넘겨보세요. 같은 제품, 문구 한 줄이 어떻게 &lsquo;사는 이유&rsquo;로 바뀌는지 보입니다.
          </p>
          <div className="mt-8">
            <BeforeAfterShowcase />
          </div>
        </Reveal>
      </Section>

      {/* 근거 — 리포트는 점수만 던지지 않는다 */}
      <Section id="evidence">
        <Reveal>
          <H2>점수만 던지지 않습니다</H2>
          <p className="mt-3 max-w-[58ch] text-[16px] leading-relaxed text-ink-body">
            항목마다 통과 기준·내 문장·코퍼스 근거를 함께 열고, 약기법 판정에는 규정 조항을 각주로 답니다. 근거를 보고 직접 판단하실 수
            있습니다.
          </p>

          <div className="mt-8 rounded-card border border-card-border bg-canvas p-6 shadow-card sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
              <p className="text-[15px] font-bold text-ink">효능 표현 · 약기법 스크리닝</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-bg px-3 py-1 text-[12.5px] font-bold text-amber-text">
                <span aria-hidden="true">△</span> 주의 — 표현 조정 권장
              </span>
            </div>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">내 문장</dt>
                <dd lang="ja" className="mt-1.5 text-[15px] text-ink-body line-through decoration-ink-faint/70">
                  シミが消える美白クリーム
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">통과 기준</dt>
                <dd className="mt-1.5 text-[15px] text-ink-body">효과 단정 대신 &lsquo;생성 억제·예방&rsquo; 표준 문형</dd>
              </div>
              <div>
                <dt className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">코퍼스 근거</dt>
                <dd className="mt-1.5 text-[15px] text-ink-body">일본 미백 제품 상위 리스팅 문형 패턴</dd>
              </div>
              <div>
                <dt className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">약기법 조항</dt>
                <dd className="mt-1.5 text-[15px] text-ink-body">医薬品等適正広告基準 — 효능 최대 표현 범위</dd>
              </div>
            </dl>
            <div className="mt-5 rounded-xl border border-coral/25 bg-coral-tint p-4">
              <p className="text-[12px] font-bold uppercase tracking-wide text-coral-strong">한국어 역해설</p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-body">
                &lsquo;기미가 사라진다&rsquo;는 일본에서 효과 보증으로 걸립니다. &lsquo;멜라닌 생성을 억제·예방&rsquo; 문형으로 바꾸고,
                의약외품 승인이 없으면 &lsquo;밝은 인상으로&rsquo;처럼 더 낮춰 씁니다.
              </p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* 오퍼 — 가짜문(fake door) */}
      <Section id="pricing" tint>
        <Reveal>
          <div className="overflow-hidden rounded-card border border-coral/25 bg-coral-tint p-8 sm:p-10">
            <p className="text-[13px] font-bold text-coral-strong">지금 파일럿 모집 중 · 선착순 {PILOT_OFFER.pilotSeats}팀</p>
            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
              <span className="text-[22px] font-semibold text-ink-faint line-through">
                {formatKrw(PILOT_OFFER.reportListPrice)}
              </span>
              <span className="text-[clamp(2.5rem,7vw,3.5rem)] font-extrabold leading-none text-coral-strong">무료</span>
            </div>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-ink-body">
              파일럿에 참여하는 브랜드에는 정가 {formatKrw(PILOT_OFFER.reportListPrice)} 진단 리포트를 무료로 제공합니다. 광고에 큰돈
              쓰기 전에, 무엇을 바꿔야 하는지부터 확인하세요.
            </p>
            <TrackedCta cta="pricing-consult" targetId="lead" className={`${CTA_PRIMARY} mt-7`}>
              파일럿 신청하기
            </TrackedCta>
          </div>
        </Reveal>
      </Section>

      {/* 진행 방식 — 실제 순서라 번호가 정보를 담는다 */}
      <Section id="how">
        <Reveal>
          <H2>배울 것 없습니다. 자산만 연결하면 됩니다.</H2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {HOW_STEPS.map((step, i) => (
              <li key={step.n} className="relative">
                <div className="flex items-center gap-3">
                  <span className="text-[28px] font-extrabold tabular-nums text-coral">{step.n}</span>
                  {i < HOW_STEPS.length - 1 && (
                    <span className="hidden h-px flex-1 bg-hairline md:block" aria-hidden="true" />
                  )}
                </div>
                <h3 className="mt-3 text-[17px] font-bold text-ink">{step.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-body">{step.d}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </Section>

      {/* FAQ */}
      <Section id="faq" tint>
        <Reveal>
          <H2>자주 묻는 질문</H2>
          <div className="mt-8 divide-y divide-hairline border-y border-hairline">
            {FAQ_ROWS.map((row) => (
              <details key={row.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold text-ink">
                  {row.q}
                  <span
                    className="shrink-0 text-[20px] font-normal text-coral transition-transform duration-200 group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-body">{row.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* 최종 CTA + 리드 폼 */}
      <section id="lead" className="bg-canvas">
        <div className="mx-auto max-w-4xl px-6 py-[clamp(3.5rem,7vw,5.5rem)]">
          <div className="grid gap-10 md:grid-cols-2 md:items-start">
            <Reveal>
              <H2>파일럿, 지금 신청하세요</H2>
              <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-ink-body">
                실제 카피를 넣으면 문장 단위 진단과 재설계안이 담긴 리포트가 생성됩니다. 무엇을 바꿔야 하는지부터 확인하세요.
              </p>
              <ul className="mt-6 space-y-3 text-[15px] text-ink-body">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-coral-strong" aria-hidden="true">
                    ○
                  </span>
                  정가 {formatKrw(PILOT_OFFER.reportListPrice)} 진단 리포트 무료 제공
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-coral-strong" aria-hidden="true">
                    ○
                  </span>
                  일본어 문장마다 한국어 역해설 병기
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-coral-strong" aria-hidden="true">
                    ○
                  </span>
                  선착순 {PILOT_OFFER.pilotSeats}팀 한정
                </li>
              </ul>
            </Reveal>
            <Reveal delay={100}>
              <div className="rounded-card border border-card-border bg-n-50 p-6 shadow-card sm:p-8">
                <LeadForm />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline bg-canvas">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <KglowLogo height={22} />
          <p className="text-[13px] text-ink-mute">KGLOW — 파일럿 모집 중인 검증 페이지입니다.</p>
        </div>
      </footer>
    </main>
  );
}
