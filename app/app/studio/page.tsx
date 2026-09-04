import Link from 'next/link';
import { ContentBadge, StudioPageHeading } from '@/components/app/studioUi';

/**
 * ② 마케팅 스튜디오 메뉴 — 세 가지 만들기 중 하나를 고르는 진입 화면.
 * 화면 정본: Figma `마케팅 스튜디오_메뉴`(1:11201). 2열 그리드 · 카드 334px ·
 * 웜 중립 표면(fill-normal) + 2px 중립 테두리, 카드 안은 제목 24 / 설명 16 + 겹친 참고 컷.
 * 참고 컷은 각 퍼널이 이미 쓰는 정적 자산을 그대로 재사용한다(새 자산을 만들지 않는다).
 */

export const metadata = { title: '마케팅 스튜디오 | YOAKE' };

interface StudioMenuItem {
  href: string | null;
  title: string;
  desc: string;
  /** stack=정사각 3장을 겹쳐 놓는다(썸네일·SNS) · row=세로 3장을 나란히(상세페이지) */
  shape: 'stack' | 'row';
  images: string[];
  ready: boolean;
}

const ITEMS: StudioMenuItem[] = [
  {
    href: '/app/studio/thumbnail',
    title: '썸네일 만들기',
    desc: '제품 이미지를 일본향 스타일의 썸네일 이미지로 변환',
    shape: 'stack',
    images: [
      '/studio-templates/06-model.jpg',
      '/studio-templates/07-promo.jpg',
      '/studio-templates/04-copy-ingredient.jpg',
    ],
    ready: true,
  },
  {
    href: '/app/studio/detail',
    title: '상세페이지 만들기',
    desc: '한국형 쇼핑몰 상세페이지를 일본향 스타일의 상세페이지로 변환',
    shape: 'row',
    images: [
      '/detail-templates/preview-D1-card.webp',
      '/detail-templates/preview-D2-card.webp',
      '/detail-templates/preview-D6-card.webp',
    ],
    ready: true,
  },
  {
    href: null,
    title: 'SNS 피드 만들기',
    desc: '일본 SNS 계정 운영을 위한 컨텐츠 생성',
    shape: 'stack',
    images: ['/studio-templates/08-premium.jpg', '/studio-templates/02-texture.jpg', '/studio-templates/01-clean.jpg'],
    ready: false,
  },
];

/** 겹쳐 놓은 정사각 참고 컷 3장 — 좌우가 살짝 기울고 가운데가 위로 올라온다 */
function StackPreview({ images, alt }: { images: string[]; alt: string }) {
  const box =
    'absolute size-[171px] rounded-[8px] border border-line-neutral object-cover shadow-[0px_8px_12px_6px_rgba(0,0,0,0.15),0px_4px_4px_0px_rgba(0,0,0,0.3)]';
  return (
    <div aria-hidden className="relative h-[190px] w-[513px] max-w-full">
      {/* eslint-disable @next/next/no-img-element */}
      <img src={images[0]} alt="" className={`${box} left-0 top-[3px] -rotate-[5.4deg]`} />
      <img src={images[1]} alt="" className={`${box} left-[168px] top-0 z-10`} />
      <img src={images[2]} alt="" className={`${box} left-[331px] top-0 rotate-[3.82deg]`} />
      {/* eslint-enable @next/next/no-img-element */}
      <span className="sr-only">{alt}</span>
    </div>
  );
}

/** 세로 참고 컷 3장 — 상세페이지 카드 */
function RowPreview({ images, alt }: { images: string[]; alt: string }) {
  return (
    <div aria-hidden className="flex gap-[22px]">
      {images.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="h-[182px] w-[155px] rounded-[8px] object-cover object-top shadow-[0px_4px_12px_0px_rgba(0,0,0,0.12)]"
        />
      ))}
      <span className="sr-only">{alt}</span>
    </div>
  );
}

export default function StudioMenuPage() {
  return (
    <main className="animate-fade-up">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-8 pt-[72px] pb-32 max-sm:px-5">
        <StudioPageHeading
          title="마케팅 스튜디오"
          desc="제품 이미지와 한국형 상세페이지만 있으면 일본향 마케팅 컨텐츠로 바꿀 수 있어요"
        />

        <ul className="grid list-none grid-cols-2 gap-x-4 gap-y-5 max-lg:grid-cols-1">
          {ITEMS.map((item, idx) => {
            const inner = (
              <div className="flex w-[513px] max-w-full flex-col gap-6">
                <div className="flex w-[328px] max-w-full flex-col gap-2 text-black">
                  <h2 className="flex items-center gap-2.5 text-2xl leading-[1.4] font-bold">
                    {item.title}
                    {/* SNS 피드는 아직 만드는 중 — 카드는 시안대로 두고 상태만 덧붙인다 */}
                    {!item.ready && <ContentBadge>준비 중</ContentBadge>}
                  </h2>
                  <p className="text-[16px] leading-[1.5] font-semibold [text-wrap:pretty]">{item.desc}</p>
                </div>
                {item.shape === 'stack' ? (
                  <StackPreview images={item.images} alt={`${item.title} 참고 컷`} />
                ) : (
                  <RowPreview images={item.images} alt={`${item.title} 참고 컷`} />
                )}
              </div>
            );

            const card =
              'flex h-[334px] items-center justify-center overflow-hidden rounded-[12px] border-2 border-line-neutral bg-n-100 px-[59px] max-sm:px-5';

            return (
              <li key={item.title} className="flex animate-fade-up" style={{ animationDelay: `${idx * 70}ms` }}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`${card} group w-full no-underline transition-[border-color,transform] duration-200 ease-standard hover:-translate-y-0.5 hover:border-coral`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div aria-disabled="true" className={`${card} w-full`}>
                    <div className="opacity-60">{inner}</div>
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
