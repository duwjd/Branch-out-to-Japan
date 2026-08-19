import { Skeleton } from '@/components/ui/primitives';

/**
 * 자산 라이브러리 로딩 스켈레톤(LIB-09) — 실제 화면과 같은 치수를 잡아 레이아웃 이동을 막는다.
 * 사이드바는 셸이 즉시 그리므로 본문만 대체한다.
 */
export default function LibraryLoading() {
  return (
    <main aria-busy="true" aria-label="자산 라이브러리 불러오는 중">
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] pb-24 max-sm:px-5">
        <Skeleton className="h-4 w-[76px] rounded-full" />
        <Skeleton className="mt-3 h-[38px] w-[280px] rounded-lg" />
        <Skeleton className="mt-4 h-5 w-full max-w-[640px] rounded-md" />

        {/* 현황 타일 4개 */}
        <div className="mt-7 grid grid-cols-4 gap-4 max-lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-card" />
          ))}
        </div>

        {/* 제안 카드 */}
        <Skeleton className="mt-4 h-[112px] rounded-card" />

        {/* 탭 + 툴바 */}
        <div className="mt-8 flex gap-3 border-b border-hairline pb-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[30px] w-[112px] rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-3.5 h-4 w-[120px] rounded-md" />

        {/* 자산 그리드 */}
        <div className="mt-4 grid grid-cols-4 gap-4 max-lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-card-border bg-canvas shadow-card">
              <Skeleton className="aspect-square rounded-none" />
              <div className="px-3 pt-2.5 pb-3">
                <Skeleton className="h-[18px] w-[62px] rounded-full" />
                <Skeleton className="mt-2 h-4 w-4/5 rounded-md" />
                <Skeleton className="mt-1.5 h-3 w-1/2 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
