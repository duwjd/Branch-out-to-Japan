import Link from 'next/link';
import { cardClass } from '@/components/ui/primitives';

/**
 * 홈 대시보드 공용 뼈대 — 카드 껍데기와 글자 단계(2026-11-24 전면 재설계).
 *
 * 홈은 12열 격자 위의 카드 대시보드다. 카드마다 머리(제목 · 보조 한 줄 · 우측 링크)를 같은 자리에
 * 같은 크기로 두어, 카드가 달라도 읽는 법이 하나가 되게 한다. 이전 판은 카드 없는 히어로 · 카드 ·
 * 밴드 · 머리선만 있는 칼럼이 섞여 표면 문법이 넷이었고, 오른쪽 열 폭도 줄마다 달라 세로선이 어긋났다.
 *
 * 글자 단계는 여섯 개로 묶는다(이 밖의 크기를 새로 만들지 않는다).
 *   30 페이지 제목 · 24 다음 단계 제목 · 16 카드 제목 · 14 본문 · 13 보조 · 12 캡션
 * 숫자만 따로 크다: 종합 점수 40(링 안) · 시즌 D-day 28.
 */

/** 카드 제목 — 16px. 모든 홈 카드가 같은 크기를 쓴다 */
export const HOME_CARD_TITLE = 'text-[16px] leading-tight font-bold tracking-[-0.01em] text-ink';

/** 카드 우측 링크·행 끝 링크 — 13px 코랄(글자색은 coral-strong) */
export const HOME_LINK = 'text-[13px] font-semibold text-coral-strong no-underline hover:underline';

/** 카드 안 소제목(구획 라벨) — 12px */
export const HOME_LABEL = 'text-[12px] font-bold text-ink-mute';

/**
 * 홈 카드 — 머리(제목 · 보조 · 링크) + 본문.
 * @param titleId 섹션 aria-labelledby 용 id
 * @param meta 제목 옆 보조 한 줄(리포트명 · 발행일 등)
 * @param action 우측 링크 — 카드의 "전체 보기" 한 개
 */
export function HomeCard({
  title,
  titleId,
  meta,
  action,
  children,
  className = '',
}: {
  title: string;
  titleId: string;
  meta?: React.ReactNode;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cardClass(`flex flex-col p-6 max-sm:p-5 ${className}`)} aria-labelledby={titleId}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 id={titleId} className={HOME_CARD_TITLE}>
          {title}
        </h2>
        {meta && <p className="min-w-0 truncate text-[12.5px] text-ink-mute">{meta}</p>}
        {action && (
          <Link href={action.href} className={`${HOME_LINK} ml-auto flex-none`}>
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
