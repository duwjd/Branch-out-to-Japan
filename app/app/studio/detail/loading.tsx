import { Skeleton } from '@/components/ui/primitives';

/**
 * 상세페이지 만들기 로딩 스켈레톤 — 이 라우트는 진입 시 checkDetailReadiness() 가
 * Supabase 3회 + 9.2MB OTF 로드를 태우므로 서버 대기가 가장 길다. 그 시간을 빈 화면이 아니라
 * 골격으로 채운다. 배치는 DetailForm 과 같다(header → 준비 상태 알림 → 템플릿 6종).
 * 컨테이너의 pb-8 도 폼과 맞춘다.
 */
export default function DetailStudioLoading() {
  return (
    <main aria-busy="true" aria-label="상세페이지 만들기 불러오는 중">
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] pb-8 max-sm:px-5">
        {/* 헤더 — 뒤로가기 링크 · 제목 · 설명 */}
        <Skeleton className="h-4 w-[104px] rounded-full" />
        <Skeleton className="mt-3 h-[32px] w-[240px] rounded-lg" />
        <Skeleton className="mt-2 h-4 w-full max-w-[560px] rounded-md" />

        {/* 준비 상태 알림 자리 */}
        <Skeleton className="mt-6 h-[60px] rounded-[12px]" />

        {/* 템플릿 6종 */}
        <section className="mt-6 rounded-[12px] border border-card-border bg-canvas p-[33px] max-sm:p-5">
          <Skeleton className="h-5 w-[100px] rounded-md" />
          <Skeleton className="mt-2 h-4 w-[300px] rounded-md" />
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-[168px] w-[74px] flex-none rounded-[10px]" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-4/5 rounded-md" />
                  <Skeleton className="mt-2 h-3 w-full rounded-md" />
                  <Skeleton className="mt-1.5 h-3 w-3/5 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
