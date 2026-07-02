import Link from "next/link";

/** 랜딩 히어로에서 신청으로 유도하는 CTA 버튼 */
function CtaButton({ children }: { children: React.ReactNode }) {
  return (
    <Link
      href="/apply"
      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      {children}
    </Link>
  );
}

const PROBLEMS = [
  "일본 고객에게 어떤 말로 팔아야 할지 모르겠다.",
  "한국식 상세페이지를 그대로 번역해도 될지 확신이 없다.",
  "인스타·릴스·유튜브에 어떤 콘텐츠를 올려야 할지 막막하다.",
  "대행사에 맡기기 전, 일본 시장에서 통할 가능성이 있는지 먼저 알고 싶다.",
];

const DELIVERABLES = [
  { title: "일본향 콘텐츠 위험도 5개", desc: "지금 콘텐츠에서 일본 고객에게 걸리는 지점을 짚어 드립니다." },
  { title: "고쳐야 할 문구 예시 3개", desc: "번역이 아니라 일본 고객 관점으로 다시 쓴 예시." },
  { title: "추천 콘텐츠 방향 3개", desc: "어떤 메시지·형식으로 접근할지 방향을 제안합니다." },
];

/** 랜딩(Phase 1) — 문제 자극 → 차별점 → 무료 진단 제공물 → 신청 CTA */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white text-zinc-900">
      {/* 헤더 */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight">브랜드 전환 스튜디오</span>
        <Link href="/apply" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          무료 진단 신청 →
        </Link>
      </header>

      {/* 히어로 */}
      <main className="mx-auto w-full max-w-5xl px-6">
        <section className="py-20 sm:py-28">
          <p className="mb-4 text-sm font-semibold text-indigo-600">일본 진출 전 콘텐츠 진단</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            번역만으로는 부족한 일본 진출 콘텐츠,
            <br />
            <span className="text-indigo-600">7일 안에 진단</span>해 드립니다.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600">
            대행사에 월 수백만 원을 쓰기 전, 지금 우리 브랜드의 상세페이지·SNS·광고 문구가
            일본 고객에게 통할지 먼저 점검하세요.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <CtaButton>무료 5분 진단 신청하기</CtaButton>
            <span className="text-sm text-zinc-500">신청 후 영업일 기준 안내드립니다.</span>
          </div>
        </section>

        {/* 문제 공감 */}
        <section className="border-t border-zinc-100 py-16" aria-labelledby="problems-heading">
          <h2 id="problems-heading" className="text-2xl font-bold tracking-tight">
            이런 고민, 있으신가요?
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PROBLEMS.map((problem) => (
              <li key={problem} className="rounded-xl bg-zinc-50 p-5 text-zinc-700">
                “{problem}”
              </li>
            ))}
          </ul>
        </section>

        {/* 차별점 */}
        <section className="border-t border-zinc-100 py-16" aria-labelledby="diff-heading">
          <h2 id="diff-heading" className="text-2xl font-bold tracking-tight">
            우리는 번역이 아니라, 일본 고객 관점의 <span className="text-indigo-600">메시지 재설계</span>를 합니다.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-600">
            영상 제작·숏폼 편집·채널 분석·게시 도구는 이미 좋은 서비스가 많습니다. 우리는 그 앞단에서,
            일본 고객이 신뢰하고 구매할 이유를 담은 <strong className="font-semibold text-zinc-900">“팔릴 말과 콘텐츠 방향”</strong>을 정해 드립니다.
          </p>
        </section>

        {/* 무료 진단 제공물 */}
        <section className="border-t border-zinc-100 py-16" aria-labelledby="deliverables-heading">
          <h2 id="deliverables-heading" className="text-2xl font-bold tracking-tight">
            무료 5분 진단으로 받는 것
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {DELIVERABLES.map((item) => (
              <div key={item.title} className="rounded-xl border border-zinc-200 p-6">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 마무리 CTA */}
        <section className="border-t border-zinc-100 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            지금 콘텐츠가 일본에서 통할지, 먼저 점검하세요.
          </h2>
          <div className="mt-8">
            <CtaButton>무료 5분 진단 신청하기</CtaButton>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-10 text-sm text-zinc-400">
        © {new Date().getFullYear()} 브랜드 전환 스튜디오 — 일본 시장 진출 콘텐츠 진단
      </footer>
    </div>
  );
}
