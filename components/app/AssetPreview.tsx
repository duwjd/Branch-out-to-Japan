/**
 * 자산 카드 프리뷰 — 리포트 표지 / 생성 썸네일 이미지.
 * 대시보드 최근 자산(MAIN-05b)·운영 라이브러리(LIB-04)·자산 상세(DETAIL-05)가 공유한다.
 *
 * 2026-08-19 개편: 리포트 표지가 회색 가짜 텍스트 줄 3개 + 데이터 없는 장식 링을 그리는
 * 와이어프레임 이식본이었다(실제로 바인딩된 값은 점수 1개뿐). 목록 조회에 이미 실려 오는
 * `ReportSummary` 의 A~E 그룹 점수·Top3를 그려 표지가 실제 진단 결과를 요약하게 바꿨다.
 * blocksJson은 쓰지 않는다 — 그리드는 카드가 여러 장이라 리포트당 ~30KB를 N배로 읽게 된다.
 */

import type { RubricGroup } from '@/lib/engine/types';
import { BAND_BAR, GROUP_ORDER, scoreBand } from '@/lib/report/labels';

export interface ReportCoverData {
  /** 종합 점수 — null이면 brand 모드(점수를 산출하지 않는다) */
  score: number | null;
  groupScores: Partial<Record<RubricGroup, number>>;
  /** 먼저 고칠 지점 — 첫 1건만 표지에 쓴다 */
  top3: { itemId: string; title: string }[];
}

/**
 * 리포트 표지 — 점수형 / 브랜드 진단(점수 없음).
 *
 * ⚠ 종합 점수에는 시급/보완/양호 같은 밴드 라벨을 붙이지 않는다(임계값 근거 미확정, 스펙 §9-Q3).
 * 밴드 색은 A~E 그룹 막대에만 쓴다 — `lib/report/labels.ts` 규칙과 같다.
 * ⚠ brand 모드에서 점수 자리에 0을 그리지 않는다 — 산출하지 않은 것을 0으로 위장하지 않는다(증거 원칙).
 *
 * @param density 'compact'는 16:10 카드(막대 3개), 'full'은 1:1 카드·상세(막대 5개 + Top3)
 */
export function ReportCoverPreview({
  score,
  groupScores = {},
  top3 = [],
  density = 'full',
}: ReportCoverData & { density?: 'compact' | 'full' }) {
  const bars: RubricGroup[] = density === 'compact' ? GROUP_ORDER.slice(0, 3) : GROUP_ORDER;
  const lead = top3[0] ?? null;
  const scored = score !== null;

  return (
    <>
      {/*
        표지는 시각 요약이라 통째로 aria-hidden 하고, 스크린리더에는 한 줄 요약만 남긴다.
        카드 전체가 링크라 막대 5개·수치를 모두 읽히면 링크 이름이 문장 여러 개로 불어난다.
      */}
      <span className="sr-only">
        {scored ? `종합 ${score}점` : '브랜드 진단 · 종합점수 없음'}
        {lead ? `, 먼저 고칠 지점 ${lead.title}` : ''}
      </span>

      <span aria-hidden className="absolute inset-0 flex flex-col bg-canvas p-[7%]">
        <span className="flex items-start justify-between gap-2">
          <span className="text-[9px] leading-tight font-extrabold tracking-[0.04em] text-coral-strong">
            YOAKE 진단 리포트
          </span>
          {!scored && (
            <span className="rounded-full bg-n-150 px-1.5 py-px text-[8px] font-bold whitespace-nowrap text-ink-mute">
              brand 모드
            </span>
          )}
        </span>

        {scored ? (
          <span className="tnum mt-[3%] flex items-baseline gap-0.5">
            <span className="text-[30px] leading-none font-extrabold tracking-[-0.02em] text-ink">{score}</span>
            <span className="text-[13px] font-semibold text-ink-faint">/100</span>
          </span>
        ) : (
          <span className="mt-[3%] block">
            <span className="block text-[13px] leading-tight font-extrabold text-ink">브랜드 진단</span>
            <span className="mt-[3px] block text-[9.5px] font-semibold text-ink-faint">
              제품 콘텐츠를 넣으면 점수가 나옵니다
            </span>
          </span>
        )}

        {/*
          A~E 그룹 충족도. 표지 크기에서는 라벨 전체("카테고리 적합성")가 잘려 오히려 못 읽으므로
          그룹 기호만 쓴다 — 밴드 색 + 수치가 함께 있어 색만으로 읽히지도 않는다.
        */}
        <span className="mt-auto flex flex-col gap-[5px] pt-[6%]">
          {bars.map((g) => {
            const pct = groupScores[g] ?? 0;
            return (
              <span key={g} className="flex items-center gap-1.5">
                <span className="w-[9px] flex-none text-[8px] font-extrabold text-ink-faint">{g}</span>
                <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-n-150">
                  <span
                    className={`block h-full rounded-full ${BAND_BAR[scoreBand(pct)]}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="tnum w-[15px] flex-none text-right text-[8px] font-bold text-ink-mute">{pct}</span>
              </span>
            );
          })}
        </span>

        {density === 'full' && lead && (
          <span className="mt-[6%] flex items-start gap-1.5 border-t border-n-150 pt-[5%]">
            <span className="mt-px inline-flex h-[13px] w-[13px] flex-none items-center justify-center rounded-[4px] bg-coral-tint text-[8px] font-extrabold text-coral-strong">
              1
            </span>
            <span className="line-clamp-2 text-[9.5px] leading-snug font-semibold text-ink-body">{lead.title}</span>
          </span>
        )}
      </span>
    </>
  );
}

/**
 * 생성 자산 프리뷰 — 로드 전에도 자리를 잡아 레이아웃 점프를 막는다.
 * anchor='top' 은 세로로 아주 긴 상세페이지용 — 정사각 카드에 가운데를 맞추면
 * 페이지 중간의 의미 없는 구간이 보이므로 히어로가 있는 위쪽을 보여준다.
 *
 * ⚠ 여기서 로드하는 건 생성 원본이다(상세페이지 결합본은 세로 수천 px · 수백 KB).
 * 라이브러리 그리드는 카드가 여러 장이라, lazy 없이 전부 즉시 로드하면 브라우저의
 * 오리진당 동시 연결(6개)을 이미지가 다 차지해 화면 전환 요청이 뒤로 밀린다.
 */
export function ThumbPreview({ src, alt, anchor = 'center' }: { src: string; alt: string; anchor?: 'center' | 'top' }) {
  // eslint-disable-next-line @next/next/no-img-element -- /api/files 동적 서빙(허용 목록 밖)
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`absolute inset-0 h-full w-full bg-n-150 object-cover ${anchor === 'top' ? 'object-top' : ''}`}
    />
  );
}
