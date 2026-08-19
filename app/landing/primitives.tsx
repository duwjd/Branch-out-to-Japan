/**
 * 랜딩 전용 공용 조각 — 섹션 래퍼·제목·불릿·칩·버튼.
 * 앱 셸(components/ui/primitives)과 분리한 이유: 랜딩은 타입 스케일과 표면색이 다르고
 * (lp-* 토큰), 앱 프리미티브를 랜딩 크기로 늘리면 두 시스템이 서로를 끌어당긴다.
 */

/** 섹션 껍데기 — 앵커 id, 배경, 상단 sticky 헤더를 피하는 scroll-mt를 한곳에서 준다 */
export function LpSection({
  id,
  tone = 'white',
  children,
  className = '',
}: {
  id?: string;
  /** white=기본 · warm=따뜻한 회백 · navy=반전(CTA) */
  tone?: 'white' | 'warm' | 'navy';
  children: React.ReactNode;
  className?: string;
}) {
  const bg = tone === 'warm' ? 'bg-lp-surface' : tone === 'navy' ? 'bg-lp-ink' : 'bg-white';
  return (
    <section id={id} className={`scroll-mt-20 ${bg} ${className}`}>
      <div className="mx-auto max-w-[1440px] px-[120px] py-[140px] max-lg:px-10 max-lg:py-24 max-sm:px-5 max-sm:py-16">
        {children}
      </div>
    </section>
  );
}

/** 섹션 제목 — 42px 볼드. lead가 있으면 아래 한 줄 */
export function LpHeading({
  children,
  lead,
  align = 'center',
}: {
  children: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'center' | 'left';
}) {
  const a = align === 'center' ? 'text-center' : 'text-left';
  return (
    <div className={a}>
      <h2 className={`text-lp-h2 font-bold break-keep text-lp-ink max-sm:text-[30px] ${a} [text-wrap:pretty]`}>{children}</h2>
      {lead && <p className={`mt-4 text-lp-lead break-keep text-lp-body max-sm:text-[16px] ${a} [text-wrap:pretty]`}>{lead}</p>}
    </div>
  );
}

/** 눈썹 카피 — 코랄 대문자 라벨 */
export function LpEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] font-semibold tracking-[0.08em] text-lp-coral">{children}</p>;
}

/**
 * 점 불릿 목록 — 서비스 섹션의 "주요 결과".
 * tone='muted'는 확장 로드맵(COMING NEXT)용 — 아직 못 쓰는 기능이라 시안에서도 점을 죽여 둔다.
 */
export function LpBullets({ items, tone = 'coral' }: { items: readonly string[]; tone?: 'coral' | 'muted' }) {
  return (
    <ul className="flex list-none flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-lp-sm text-lp-body">
          <span
            aria-hidden
            className={`mt-[10px] h-[5px] w-[5px] flex-none rounded-full ${tone === 'muted' ? 'bg-lp-muted' : 'bg-lp-coral'}`}
          />
          <span className="[text-wrap:pretty]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** 코랄 좌측 선 인용 — 섹션의 한 줄 결론 */
export function LpPullQuote({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-lp-coral py-3.5 pl-5">
      <p className="text-lp-body font-semibold text-lp-ink [text-wrap:pretty]">{children}</p>
    </div>
  );
}

/** 테두리 칩 — Hero 태그·제공 항목 */
export function LpChip({ children, tone = 'light' }: { children: React.ReactNode; tone?: 'light' | 'onNavy' }) {
  const cls =
    tone === 'onNavy'
      ? 'border-white/16 bg-white/8 text-white'
      : 'border-lp-line bg-white text-lp-body';
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-semibold ${cls}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone === 'onNavy' ? 'bg-lp-coral' : 'bg-lp-coral'}`} />
      {children}
    </span>
  );
}

/**
 * 랜딩 버튼 클래스 — <a>·<Link>·<button> 어디에나 붙인다(앱의 buttonClass와 같은 관례).
 * 컴포넌트가 아니라 클래스 문자열인 이유: 측정용 onClick이 붙는 CTA가 있어
 * 컴포넌트로 감싸면 서버 섹션까지 클라이언트로 끌려 들어간다.
 * @param variant primary=코랄 솔리드(주 CTA) · secondary=아웃라인(보조)
 */
export function lpButtonClass(variant: 'primary' | 'secondary' = 'primary', extra = ''): string {
  const cls =
    variant === 'primary'
      ? 'bg-lp-coral text-white hover:brightness-95'
      : 'border border-lp-line-strong bg-white text-lp-ink hover:bg-lp-surface';
  return [
    'inline-flex h-[52px] cursor-pointer items-center justify-center rounded-[10px] px-7 text-[17px] font-semibold whitespace-nowrap no-underline',
    'transition-[filter,background-color,transform] duration-200 ease-standard active:translate-y-px',
    cls,
    extra,
  ].join(' ');
}
