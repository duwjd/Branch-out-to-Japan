import Link from 'next/link';
import { StatusBadge } from '@/components/ui/primitives';
import { IconImage } from '@/components/ui/icons';

/**
 * ② 마케팅 스튜디오 메뉴 — 세 가지 만들기 중 하나를 고르는 진입 화면.
 * 스튜디오에 들어오면 항상 여기부터 시작한다(2026-08-18 플로우 개편).
 * 카드 미리보기는 각 퍼널이 이미 쓰고 있는 정적 자산을 그대로 재사용한다
 * (public/studio-templates · public/detail-templates — 별도 자산을 새로 만들지 않는다).
 */

export const metadata = { title: '마케팅 스튜디오 | YOAKE' };

interface StudioMenuItem {
  href: string | null;
  title: string;
  desc: string;
  /** 카드 미리보기 — 겹쳐 놓는 정사각 3장 또는 세로 3장 */
  shape: 'square' | 'tall';
  images: string[];
  ready: boolean;
  /** 준비 중 카드에만 — 왜 아직 못 쓰는지 한 줄 */
  note?: string;
}

const ITEMS: StudioMenuItem[] = [
  {
    href: '/app/studio/thumbnail',
    title: '썸네일 만들기',
    desc: '제품 이미지를 일본향 썸네일로 바꿉니다.',
    shape: 'square',
    images: ['/studio-templates/06-model.jpg', '/studio-templates/07-promo.jpg', '/studio-templates/04-copy-ingredient.jpg'],
    ready: true,
  },
  {
    href: '/app/studio/detail',
    title: '상세페이지 만들기',
    desc: '한국형 쇼핑몰 상세페이지를 일본향 상세페이지로 바꿉니다.',
    shape: 'tall',
    images: ['/detail-templates/preview-D1-card.webp', '/detail-templates/preview-D2-card.webp', '/detail-templates/preview-D6-card.webp'],
    ready: true,
  },
  {
    href: null,
    title: 'SNS 피드 만들기',
    desc: '일본 SNS 계정 운영에 쓸 피드 콘텐츠를 만듭니다.',
    shape: 'square',
    images: ['/studio-templates/08-premium.jpg', '/studio-templates/02-texture.jpg', '/studio-templates/01-clean.jpg'],
    ready: false,
    note: '아직 만들고 있습니다. 준비되면 이 자리에서 바로 열립니다.',
  },
];

/** 카드 미리보기 — 정사각(썸네일·SNS)은 겹쳐서, 세로(상세페이지)는 나란히 */
function Preview({ shape, images, title }: { shape: 'square' | 'tall'; images: string[]; title: string }) {
  if (shape === 'tall') {
    return (
      <div aria-hidden className="flex items-end justify-center gap-3">
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className="h-[168px] w-[74px] rounded-[10px] border border-card-border object-cover object-top shadow-card transition-transform duration-300 ease-standard group-hover:-translate-y-1"
            style={{ transitionDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden className="flex items-center justify-center">
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`h-[132px] w-[132px] rounded-[14px] border border-card-border object-cover shadow-card transition-transform duration-300 ease-standard group-hover:-translate-y-1 ${
            i === 0 ? '-rotate-6' : i === 1 ? 'z-10 -ml-6 scale-[1.06]' : '-ml-6 rotate-6'
          }`}
          style={{ transitionDelay: `${i * 40}ms` }}
        />
      ))}
      <span className="sr-only">{title} 미리보기</span>
    </div>
  );
}

export default function StudioMenuPage() {
  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[1280px] px-8 pt-11 pb-24 max-sm:px-5">
        <header>
          <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">YOAKE 마케팅 스튜디오</p>
          <h1 className="mt-2.5 text-[30px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink">마케팅 스튜디오</h1>
          <p className="mt-3.5 max-w-[720px] text-[15px] leading-[1.7] text-ink-body [text-wrap:pretty]">
            한국에서 쓰던 소재를 그대로 옮기지 않습니다. 무엇을 만들지 고르면 일본 고객이 읽는 방식으로 카피부터 다시 설계합니다.
          </p>
        </header>

        <ul className="mt-9 grid list-none grid-cols-2 gap-4 max-lg:grid-cols-1">
          {ITEMS.map((item, idx) => {
            const inner = (
              <>
                <div className="flex items-start gap-2.5">
                  <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">{item.title}</h2>
                  {!item.ready && <StatusBadge tone="off" className="mt-1.5">준비 중</StatusBadge>}
                </div>
                <p className="mt-2 text-[14px] leading-[1.6] text-ink-mute">{item.desc}</p>
                {item.note && <p className="mt-1 text-[12.5px] leading-[1.6] text-ink-faint">{item.note}</p>}
                <div className="mt-7 flex flex-1 items-end justify-center pb-1">
                  <Preview shape={item.shape} images={item.images} title={item.title} />
                </div>
                {item.ready && (
                  <p className="mt-6 flex items-center gap-1.5 text-[13px] font-bold text-coral-strong">
                    <IconImage size={16} aria-hidden />
                    시작하기
                    <span aria-hidden className="transition-transform duration-200 ease-standard group-hover:translate-x-0.5">
                      →
                    </span>
                  </p>
                )}
              </>
            );

            return (
              <li key={item.title} className="flex">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="group flex min-h-[334px] flex-1 flex-col rounded-card border border-card-border bg-canvas p-7 no-underline shadow-card transition-[border-color,box-shadow,transform] duration-200 ease-standard hover:-translate-y-0.5 hover:border-coral hover:shadow-nav"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    aria-disabled="true"
                    className="group flex min-h-[334px] flex-1 flex-col rounded-card border border-dashed border-card-border bg-n-50 p-7"
                  >
                    <span className="contents opacity-70">{inner}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
