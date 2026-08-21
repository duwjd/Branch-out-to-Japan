import { Skeleton } from '@/components/ui/primitives';

/**
 * 진단 리포트 로딩 스켈레톤 — UT 에서 가장 많이 열린 화면(100회, 중앙값 2,794ms).
 *
 * 왜 가운데 정렬인가: 이 페이지는 클라이언트 컴포넌트라 RSC 가 도착한 **뒤에도** 상태를
 * 폴링하는 동안 자기 로딩 상태(min-h-[50vh] 가운데 정렬)를 한 번 더 보여준다. 여기서 전폭
 * 리포트 골격을 그리면 "골격 → 가운데 안내 → 리포트" 로 화면이 두 번 튄다. 같은 컨테이너를
 * 써서 이어지게 만든다.
 */
export default function ReportLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="진단 리포트 불러오는 중"
      className="flex min-h-[50vh] items-center justify-center px-6 py-12"
    >
      <div className="w-full max-w-[560px]">
        <Skeleton className="h-4 w-[68px] rounded-full" />
        <div className="mt-3.5 rounded-card border border-card-border bg-canvas p-11 shadow-card">
          <Skeleton className="mx-auto h-6 w-[260px] rounded-lg" />
          <Skeleton className="mx-auto mt-3 h-4 w-[150px] rounded-md" />
          <Skeleton className="mt-6 h-1.5 rounded-full" />
          <div className="mt-7 border-t border-hairline pt-4.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="mt-2.5 h-4 w-full max-w-[300px] rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
