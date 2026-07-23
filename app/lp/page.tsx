import type { Metadata } from 'next';
import Link from 'next/link';
import { KglowLogo } from '@/components/brand/Logo';
import { PILOT_OFFER, formatKrw } from '@/lib/lead';
import { PageView } from './PageView';
import { TrackedCta } from './TrackedCta';
import { LeadForm } from './LeadForm';

/**
 * MVP 검증 랜딩(/lp) — 유튜브 유입 방문자에게 상담 신청(주 CTA)·자료받기(보조 CTA)를 받아
 * "구매(필요성) 의향"을 측정한다. 가격은 가짜문(fake door)으로 실제 정가를 노출한다.
 * 섹션 카피는 app/page.tsx(기존 제품 랜딩)의 확정 카피를 재사용·발췌했다.
 */

/** 유튜브 영상 ID — 값이 정해지면 여기에 넣는다(예: 'dQw4w9WgXcQ'). 빈 값이면 플레이스홀더 렌더. */
const YOUTUBE_VIDEO_ID = '';

export const metadata: Metadata = {
  title: '일본 Qoo10에서 안 팔릴 때 — 상세페이지, 일본 고객 관점으로 진단 | KGLOW',
  description:
    '번역은 끝냈는데 일본에서 안 팔린다면? 薬機法 표현·리뷰(口コミ)·랭킹 정체 문제를 일본 고객 관점에서 진단합니다. 진단 리포트 30만원 정가, 지금 파일럿 참여 시 무료.',
};

const BEFORE_AFTER_ROWS = [
  {
    category: '스킨케어/CICA',
    before: '塗る瞬間、トラブルを消す。即・鎮静CICAアンプル',
    after: '乾燥による肌あれ※が気になる肌を、うるおいでキメ整える。※角層',
    note: "'없앤다'는 효과보증 → '수분으로 결 정돈(整える)'+각질층 자기한정 각주로 합법화",
  },
  {
    category: '미백',
    before: 'シミが消える美白クリーム',
    after: 'メラニンの生成を抑え、シミ・そばかすを防ぐ。※薬用(医薬部外品)の場合',
    note: "'기미가 사라진다' 단정 → 일본 미백 표준 문형. 의약외품 승인 시만, 없으면 「明るい印象へ」로 낮춤",
  },
  {
    category: '더마/敏感肌',
    before: '病院処方級、敏感肌のトラブルを治療するケア',
    after: '敏感肌※の方の毎日にも。パッチテスト済み・無添加処方。※すべての方に刺激が起きないわけではありません',
    note: "'치료'·의료비교 불가 → '패치테스트·무첨가' 안심 근거로 전환",
  },
  {
    category: '향/바디',
    before: '一日中香りが持続、ストレスを解消するボディミスト',
    after: '気分に寄り添う、みずみずしい香り。朝のひと吹きで、自分を整える時間に。',
    note: "'지속' 무근거·'스트레스 해소' 효능 위험 → 정서·사용씬 소구로",
  },
];

const FAQ_ROWS = [
  { q: '번역과 뭐가 다른가요?', a: '문장을 일본어로 옮기는 게 아니라, 일본 고객이 무엇을 근거로 신뢰하고 구매하는지를 역설계해 정보 구조를 다시 짓습니다. 채점 기준과 코퍼스 근거를 전부 공개합니다.' },
  { q: 'AI 판정을 어떻게 믿나요?', a: '점수만 던지지 않습니다. 항목마다 통과 기준·내 문장·코퍼스 근거를 함께 노출하고, 약기법 판정에는 규정 조항을 각주로 답니다. 근거를 보고 직접 판단하실 수 있습니다.' },
  { q: '약기법 판정은 법적 판단인가요?', a: '아니요 — 공개 규정 기반 1차 스크리닝입니다. 한계를 리포트에 명시하고, 상시(上市) 전 약무 전문가 확인을 권고합니다.' },
  { q: '일본어를 못 읽어도 되나요?', a: '재설계된 모든 일본어 문장에 한국어 역해설이 병기됩니다. 무엇이 어떻게 바뀌었는지 한국어로 검수할 수 있습니다.' },
  {
    q: '파일럿은 정말 무료인가요?',
    a: `네. 정가 ${formatKrw(PILOT_OFFER.reportListPrice)}인 진단 리포트를 파일럿 참여 브랜드에 무료로 제공합니다. 선착순 ${PILOT_OFFER.pilotSeats}팀 한정입니다.`,
  },
];

/** 랜딩 섹션 공통 래퍼 */
function Section({ id, children, alt }: { id: string; children: React.ReactNode; alt?: boolean }) {
  return (
    <section id={id} className={alt ? 'bg-neutral-50' : 'bg-white'}>
      <div className="mx-auto max-w-4xl px-6 py-14">{children}</div>
    </section>
  );
}

export default function LpPage() {
  return (
    <main>
      <PageView />

      {/* 1 헤더 */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/lp" aria-label="KGLOW 홈">
            <KglowLogo height={32} />
          </Link>
          <TrackedCta
            cta="header-consult"
            targetId="lead"
            className="rounded-lg bg-[#FF6464] px-4 py-2 text-base font-bold text-white transition-colors hover:bg-[#D93636]"
          >
            무료 상담 신청
          </TrackedCta>
        </div>
      </header>

      {/* 2 히어로 + 영상 */}
      <Section id="hero">
        <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold leading-snug sm:text-4xl">
              번역이 아니라,
              <br />
              일본 고객 관점의 메시지 재설계
            </h1>
            <p className="mt-5 text-lg text-neutral-700">
              한국 상세페이지·SNS·광고 문구를 일본 구매자가 &lsquo;사는 이유&rsquo;로 다시 씁니다. 薬機法 표현부터
              리뷰(口コミ)·랭킹이 오르지 않는 이유까지, 일본 고객 관점에서 진단합니다.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <TrackedCta cta="hero-consult" targetId="lead">
                무료 상담 신청
              </TrackedCta>
              <TrackedCta
                cta="hero-resource"
                targetId="lead"
                className="text-base font-semibold text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
              >
                무료 샘플 리포트 받기
              </TrackedCta>
            </div>
          </div>

          <div>
            {YOUTUBE_VIDEO_ID ? (
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}`}
                  title="KGLOW 소개 영상"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-sm font-semibold text-neutral-400">
                영상 준비 중
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* 3 문제 공감 — 2트랙 */}
      <Section id="problem" alt>
        <h2 className="text-xl font-bold">지금 어떤 상황이신가요?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold">입점 준비</h3>
            <p className="mt-2 text-neutral-700">번역은 끝냈는데, 이게 일본에서 통할지 확신이 없다</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold">운영 정체</h3>
            <p className="mt-2 text-neutral-700">입점은 했는데, 리뷰(口コミ)도 랭킹도 오르지 않는다</p>
          </div>
        </div>
      </Section>

      {/* 4 Before/After ★ 최강 자산 */}
      <Section id="before-after">
        <h2 className="text-xl font-bold">직역하면 이렇게, 재설계하면 이렇게</h2>
        <div className="mt-4 space-y-4">
          {BEFORE_AFTER_ROWS.map((row) => (
            <article key={row.category} className="rounded-xl border border-neutral-200 p-5">
              <h3 className="text-sm font-semibold text-[#D93636]">{row.category}</h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-neutral-500">Before (직역)</dt>
                  <dd className="mt-1 text-neutral-700 line-through decoration-neutral-400" lang="ja">
                    {row.before}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-neutral-500">After (재설계)</dt>
                  <dd className="mt-1 font-medium" lang="ja">
                    {row.after}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-neutral-600">{row.note}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* 5 오퍼/가격 — 가짜문(fake door) */}
      <Section id="pricing" alt>
        <h2 className="text-xl font-bold">지금 파일럿 모집 중</h2>
        <div className="mt-5 rounded-2xl border border-[#FFD6D6] bg-[#FFF8F8] p-6 sm:p-8">
          <p className="text-sm font-bold text-[#D93636]">진단 리포트 정가</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-semibold text-neutral-400 line-through">
              {formatKrw(PILOT_OFFER.reportListPrice)}
            </span>
            <span className="text-4xl font-extrabold text-[#D93636]">무료</span>
          </p>
          <p className="mt-4 max-w-xl text-neutral-700">
            파일럿에 참여하는 브랜드에는 정가 {formatKrw(PILOT_OFFER.reportListPrice)} 진단 리포트를 무료로 제공합니다. 선착순{' '}
            {PILOT_OFFER.pilotSeats}팀 한정입니다.
          </p>
          <TrackedCta
            cta="pricing-consult"
            targetId="lead"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#FF6464] px-6 py-3 text-lg font-bold text-white transition-colors hover:bg-[#D93636] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          >
            파일럿 신청하기
          </TrackedCta>
        </div>
      </Section>

      {/* 6 진행 방식 3스텝 */}
      <Section id="how">
        <h2 className="text-xl font-bold">배울 것 없습니다. 자산만 연결하면 됩니다.</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            'STEP 1 — 브랜드 자산 연결 (새로 배울 도구 없음)',
            'STEP 2 — 전문가가 확정, AI가 속도',
            'STEP 3 — 한국어 역해설 붙은 초안·완성본 도착',
          ].map((step) => (
            <li key={step} className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
              {step}
            </li>
          ))}
        </ol>
      </Section>

      {/* 7 FAQ */}
      <Section id="faq" alt>
        <h2 className="text-xl font-bold">자주 묻는 질문</h2>
        <div className="mt-4 space-y-2">
          {FAQ_ROWS.map((row) => (
            <details key={row.q} className="rounded-lg border border-neutral-200 bg-white p-4">
              <summary className="cursor-pointer font-medium">{row.q}</summary>
              <p className="mt-2 text-sm text-neutral-700">{row.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* 8 최종 CTA + 리드 폼 */}
      <section id="lead" className="bg-white">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold">파일럿, 지금 신청하세요</h2>
              <p className="mt-2 text-neutral-700">
                실제 카피를 넣으면 문장 단위 감사와 재설계안이 담긴 리포트가 생성됩니다.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                <li>정가 {formatKrw(PILOT_OFFER.reportListPrice)} 진단 리포트 무료 제공</li>
                <li>선착순 {PILOT_OFFER.pilotSeats}팀 한정</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
              <LeadForm />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto max-w-4xl px-6 py-8 text-sm text-neutral-500">
          KGLOW — 파일럿 모집 중인 검증 페이지입니다.
        </div>
      </footer>
    </main>
  );
}
