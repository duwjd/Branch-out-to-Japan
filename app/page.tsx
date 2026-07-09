import Link from 'next/link';

/**
 * 랜딩(메인) 페이지 — 기능 검증 빌드.
 * 카피 정본: design/wireframes/public-onboarding-spec.md §1 확정 카피(jp-localizer 2026-07-09) 그대로 사용.
 * 규칙 준수: Stats 수치 비노출(실측 전) · 가상 통계 금지 · CTA 코랄 정책(#FF6464 + 큰 흰 글씨만).
 * 디자인은 확정 후 교체 — 섹션 구조(id)와 카피만 유지하면 된다.
 */

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
  { q: 'AI 판정을 어떻게 믿나요?', a: '모든 판정·재설계는 사람 검수자의 검토·서명을 거쳐 발행됩니다. 근거 각주와 채점 기준이 리포트에 그대로 노출됩니다.' },
  { q: '약기법 판정은 법적 판단인가요?', a: '아니요 — 공개 규정 기반 1차 스크리닝입니다. 한계를 리포트에 명시하고, 상시(上市) 전 약무 전문가 확인을 권고합니다.' },
  { q: '일본어를 못 읽어도 되나요?', a: '재설계된 모든 일본어 문장에 한국어 역해설이 병기됩니다. 무엇이 어떻게 바뀌었는지 한국어로 검수할 수 있습니다.' },
  { q: '결과물을 보기 전에 비용이 드나요?', a: '무료 체커로 시작해, 진단 리포트는 30만 원 고정가 1회입니다. 제작이 필요할 때만 Growth 월 20만(첫 달 진단비 공제)으로 확장합니다. 언제든 해지, 품의용 PDF 제공.' },
];

/** 랜딩 섹션 공통 래퍼 */
function Section({ id, children, alt }: { id: string; children: React.ReactNode; alt?: boolean }) {
  return (
    <section id={id} className={alt ? 'bg-neutral-50' : 'bg-white'}>
      <div className="mx-auto max-w-4xl px-6 py-14">{children}</div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <main>
      {/* 1 Header */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-bold tracking-tight">
            Japan Growth Studio
          </Link>
          <nav aria-label="주요 메뉴" className="flex items-center gap-4 text-sm">
            <a href="#service" className="text-neutral-600 hover:text-neutral-900">서비스</a>
            <a href="#before-after" className="text-neutral-600 hover:text-neutral-900">Before·After</a>
            <a href="#pricing" className="text-neutral-600 hover:text-neutral-900">요금</a>
            <a href="#faq" className="text-neutral-600 hover:text-neutral-900">FAQ</a>
            <Link
              href="/app/report/new"
              className="rounded-lg bg-[#FF6464] px-4 py-2 text-base font-bold text-white hover:bg-[#D93636]"
            >
              무료 진단 시작
            </Link>
          </nav>
        </div>
      </header>

      {/* 2 Hero */}
      <Section id="hero">
        <h1 className="text-3xl font-extrabold leading-snug sm:text-4xl">
          번역이 아니라,
          <br />
          일본 고객 관점의 메시지 재설계
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-neutral-700">
          한국 상세·SNS 문구를 일본 구매자가 &lsquo;사는 이유&rsquo;로 다시 씁니다. 일본어로 옮기는 게 아니라,
          무엇을 근거로 신뢰하고 구매하는지를 역설계해 문장을 다시 짓습니다.{' '}
          <strong>일본향 전문가가 확정하고, AI가 속도를 냅니다.</strong>
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/app/report/new"
            className="rounded-lg bg-[#FF6464] px-6 py-3 text-lg font-bold text-white hover:bg-[#D93636]"
          >
            무료 진단 시작
          </Link>
          <span
            aria-disabled="true"
            className="cursor-not-allowed rounded-lg border border-neutral-300 px-6 py-3 text-lg font-semibold text-neutral-400"
            title="샘플 리포트 페이지는 다음 단계에서 제공됩니다"
          >
            샘플 리포트 보기 (준비 중)
          </span>
        </div>
      </Section>

      {/* 3 Stats — 실측 확보 전 수치 비노출(가상 통계 금지). 판단 근거 공개 칩만. */}
      <Section id="stats" alt>
        <h2 className="text-xl font-bold">숫자로 설득하지 않습니다. 근거로 보여드립니다.</h2>
        <p className="mt-2 text-neutral-700">정착률·만족도를 지어내지 않습니다. 대신 판단 근거를 전부 공개합니다.</p>
        <ul className="mt-4 flex flex-wrap gap-2 text-sm">
          {['薬機法 조항 각주', '채점 기준 공개', '라쿠텐 상세 코퍼스 대조', '한국어 역해설 병기'].map((chip) => (
            <li key={chip} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-neutral-700">
              {chip}
            </li>
          ))}
        </ul>
      </Section>

      {/* 4 Problem — 2트랙 */}
      <Section id="problem">
        <h2 className="text-xl font-bold">지금 어떤 상황이신가요?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold">입점 준비</h3>
            <p className="mt-2 text-neutral-700">번역은 끝냈는데, 이게 일본에서 통할지 확신이 없다</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-5">
            <h3 className="font-semibold">운영 정체</h3>
            <p className="mt-2 text-neutral-700">입점은 했는데, 리뷰(口コミ)도 랭킹도 오르지 않는다</p>
          </div>
        </div>
      </Section>

      {/* 5 Service 3축 */}
      <Section id="service" alt>
        <h2 className="text-xl font-bold">진단부터 제작·운영까지, 한 곳에서</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold">① 진단 리포트</h3>
            <p className="mt-2 text-sm text-neutral-700">薬機法 전수 감사 + 페르소나·USP 재정의 + 근거 기반 재작성</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold">② 마케팅 스튜디오</h3>
            <p className="mt-2 text-sm text-neutral-700">자산만 연결하면 재설계된 상세·썸네일·피드 초안이 도착</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold">③ 운영</h3>
            <p className="mt-2 text-sm text-neutral-700">시즌 사이클 대응 + 일본 기업 매칭</p>
          </div>
        </div>
      </Section>

      {/* 6 Before/After ★ 최강 자산 */}
      <Section id="before-after">
        <h2 className="text-xl font-bold">직역하면 이렇게, 재설계하면 이렇게</h2>
        <div className="mt-4 space-y-4">
          {BEFORE_AFTER_ROWS.map((row) => (
            <article key={row.category} className="rounded-xl border border-neutral-200 p-5">
              <h3 className="text-sm font-semibold text-[#D93636]">{row.category}</h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-neutral-500">Before (직역)</dt>
                  <dd className="mt-1 text-neutral-700 line-through decoration-neutral-400" lang="ja">{row.before}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-neutral-500">After (재설계)</dt>
                  <dd className="mt-1 font-medium" lang="ja">{row.after}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-neutral-600">{row.note}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* 7 How */}
      <Section id="how" alt>
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

      {/* 8 Compliance — 약기법 훅 */}
      <Section id="compliance">
        <div className="rounded-xl border border-[#FFD6D6] bg-[#FFF8F8] p-6">
          <h2 className="text-xl font-bold">그 効能 문구, 일본에선 광고가 내려갈 수도 있습니다</h2>
          <p className="mt-2 text-neutral-700">
            화장품·의약외품이 말할 수 있는 효능 범위는 薬機法으로 정해져 있습니다. 지금 문구를 진단으로 확인하세요.
          </p>
          <Link href="/app/report/new" className="mt-3 inline-block text-sm font-semibold text-[#D93636] underline">
            진단으로 확인하기 →
          </Link>
        </div>
      </Section>

      {/* 9 Trust */}
      <Section id="trust" alt>
        <h2 className="text-xl font-bold">AI가 먼저가 아닙니다. 사람이 확정합니다.</h2>
        <p className="mt-2 max-w-2xl text-neutral-700">
          모든 판정·재설계는 일본 약무·현지화 담당자 검토·서명을 거쳐 발행됩니다.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2 text-sm">
          {['근거 각주', '채점 기준 공개', '사람 서명 발행'].map((chip) => (
            <li key={chip} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-neutral-700">
              {chip}
            </li>
          ))}
        </ul>
      </Section>

      {/* 10 Pricing 요약 */}
      <Section id="pricing">
        <h2 className="text-xl font-bold">고정가입니다. 견적 왕복이 없습니다.</h2>
        <p className="mt-2 max-w-2xl text-neutral-700">
          진단 1건 30만 고정. 제작이 필요하면 Growth 월 20만, 첫 달은 진단비 공제. 결과물 보기 전 월정액 아님.
          언제든 해지, 품의용 PDF.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { name: 'Free', price: '0원', desc: '처음, 감 잡기' },
            { name: 'Report', price: '30만 / 1회', desc: '방향 확인 — 진단 리포트' },
            { name: 'Growth', price: '월 20만', desc: '콘텐츠 제작 · 첫 달 진단비 공제' },
          ].map((tier) => (
            <div key={tier.name} className="rounded-xl border border-neutral-200 p-5">
              <h3 className="font-semibold">{tier.name}</h3>
              <p className="mt-1 text-lg font-bold">{tier.price}</p>
              <p className="mt-1 text-sm text-neutral-600">{tier.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 11 FAQ */}
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

      {/* 12 Final CTA */}
      <Section id="cta">
        <div className="rounded-2xl bg-[#FFF8F8] p-8 text-center">
          <h2 className="text-2xl font-bold">지금 쓰는 문구부터, 무료로 진단해 보세요.</h2>
          <p className="mt-2 text-neutral-700">실제 카피를 넣으면 문장 단위 감사와 재설계안이 담긴 리포트가 생성됩니다.</p>
          <Link
            href="/app/report/new"
            className="mt-5 inline-block rounded-lg bg-[#FF6464] px-8 py-3 text-lg font-bold text-white hover:bg-[#D93636]"
          >
            무료 진단 시작
          </Link>
        </div>
      </Section>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto max-w-4xl px-6 py-8 text-sm text-neutral-500">
          Japan Growth Studio — 기능 검증 빌드. 디자인은 확정 후 교체됩니다.
          <span className="mx-2">·</span>
          <Link href="/admin/review" className="text-[#D93636] underline">검수자 화면(내부)</Link>
        </div>
      </footer>
    </main>
  );
}
