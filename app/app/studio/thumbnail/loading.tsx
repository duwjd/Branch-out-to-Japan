import { Skeleton } from '@/components/ui/primitives';

/**
 * 썸네일 만들기 로딩 스켈레톤 — UT 실측에서 가장 오래 걸린 화면(중앙값 3,136ms)이라
 * 공통 폴백(app/app/loading.tsx) 대신 실제 배치를 따로 잡는다.
 * 구성은 StudioForm 과 같다: 뒤로가기 + 제목 → 섹션 카드(이미지 업로드) → 템플릿 8종 격자.
 * 컨테이너도 폼과 동일하게 flex-col gap-8 · pb-8 을 쓴다(도착 시 레이아웃 이동 없음).
 */
export default function ThumbnailStudioLoading() {
  return (
    <main aria-busy="true" aria-label="썸네일 만들기 불러오는 중">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-8 pt-[72px] pb-8 max-sm:px-5">
        {/* 헤더 — 뒤로가기 링크 · 제목 · 설명 */}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-[104px] rounded-full" />
          <Skeleton className="h-[30px] w-[210px] rounded-lg" />
          <Skeleton className="h-4 w-full max-w-[420px] rounded-md" />
        </div>

        {/* 이미지 업로드 섹션 */}
        <section className="flex flex-col gap-6 rounded-[12px] border border-card-border bg-canvas p-[33px] max-sm:p-5">
          <div>
            <Skeleton className="h-5 w-[120px] rounded-md" />
            <Skeleton className="mt-2 h-4 w-[280px] rounded-md" />
          </div>
          <Skeleton className="h-[38px] w-[320px] rounded-full" />
          <Skeleton className="h-[184px] rounded-[14px]" />
        </section>

        {/* 템플릿 섹션 — 플랫폼 필터 칩 + 카드 8종 */}
        <section className="flex flex-col gap-6 rounded-[12px] border border-card-border bg-canvas p-[33px] max-sm:p-5">
          <div>
            <Skeleton className="h-5 w-[76px] rounded-md" />
            <Skeleton className="mt-2 h-4 w-[300px] rounded-md" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[30px] w-[84px] rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i}>
                <Skeleton className="aspect-square rounded-[10px]" />
                <Skeleton className="mt-2 h-4 w-3/5 rounded-md" />
                <Skeleton className="mt-1.5 h-3 w-4/5 rounded-md" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
