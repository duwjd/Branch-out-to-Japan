/**
 * 자산 카드 프리뷰 — 리포트 표지 CSS 목업 / 생성 썸네일 이미지.
 * 대시보드 최근 자산(MAIN-05b)·운영 라이브러리(LIB-04) 카드가 공유한다.
 * 리포트 표지는 실제 산출물이 아니라 표지 상징 목업(디자인 정본 previewHtml 이식).
 */

/** 리포트 표지 목업 — 점수형 / 브랜드 진단(점수 없음) */
export function ReportCoverPreview({ score }: { score: number | null }) {
  return (
    <span aria-hidden className="absolute inset-0 block bg-canvas">
      <span className="absolute top-[12%] left-[8%] text-[9px] font-extrabold tracking-[0.04em] text-coral-strong">
        KGLOW 진단 리포트
      </span>
      {score !== null ? (
        <span className="tnum absolute top-[26%] left-[8%] text-[30px] font-extrabold tracking-[-0.02em] text-ink">
          {score}
          <span className="text-[13px] font-semibold text-ink-faint">/100</span>
        </span>
      ) : (
        <span className="absolute top-[28%] left-[8%] text-[13px] font-extrabold text-ink">
          브랜드 진단
          <span className="mt-[3px] block text-[9.5px] font-semibold text-ink-faint">종합점수 없음 · brand 모드</span>
        </span>
      )}
      <span className="absolute top-[62%] right-[40%] left-[8%] h-[5px] rounded-[3px] bg-n-150" />
      <span className="absolute top-[73%] right-[26%] left-[8%] h-[5px] rounded-[3px] bg-n-150" />
      <span className="absolute top-[84%] right-[52%] left-[8%] h-[5px] rounded-[3px] bg-n-150" />
      <span className="absolute top-[12%] right-[8%] aspect-square w-[22%] rotate-45 rounded-full border-[3px] border-[#ffe2e2] border-t-coral" />
    </span>
  );
}

/** 생성 썸네일 프리뷰 — 로드 전에도 자리를 잡아 레이아웃 점프를 막는다 */
export function ThumbPreview({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- /api/files 동적 서빙(허용 목록 밖)
  return <img src={src} alt={alt} className="absolute inset-0 h-full w-full bg-n-150 object-cover" />;
}
