import { Skeleton } from '@/components/ui/primitives';

/**
 * /app 이하 공통 로딩 스켈레톤 — 자기 loading.tsx 가 없는 하위 세그먼트가 전부 상속한다
 * (홈·시즌 캘린더·기업 매칭·마이페이지·브랜드 관리·스튜디오 홈·새 진단).
 *
 * 왜 필요한가: App Router 는 동적 라우트를 프리페치할 때 가장 가까운 loading 경계까지만
 * 미리 가져온다. 경계가 없으면 프리페치가 **아무것도 반환하지 않고 조기 종료**하고,
 * 클릭 시에는 RSC 왕복이 끝날 때까지 이전 화면이 그대로 떠 있는다(전환 표시 없음).
 * UT 로그에 `/app?_rsc=… — net::ERR_ABORTED` 가 153회 남은 것이 그 흔적이다.
 * 이 파일 하나로 프리페치가 되살아나고, 클릭 즉시 골격이 그려진다.
 *
 * 치수는 앱 공통 헤더(eyebrow → h1 → 설명)와 본문 2열(8+4)에 맞췄다 — 실제 화면이 도착했을 때
 * 레이아웃이 튀지 않게 한다. 사이드바는 셸이 이미 그리고 있으므로 본문만 대체한다.
 */
export default function AppLoading() {
  return (
    <main aria-busy="true" aria-label="불러오는 중">
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] pb-24 max-sm:px-5">
        {/* 페이지 헤더 — 눈썹 라벨 · 제목 · 설명 */}
        <Skeleton className="h-4 w-[76px] rounded-full" />
        <Skeleton className="mt-3 h-[38px] w-[280px] rounded-lg" />
        <Skeleton className="mt-4 h-5 w-full max-w-[640px] rounded-md" />

        {/* 본문 — 왼쪽 주 콘텐츠 + 오른쪽 맥락 카드 두 줄. 홈의 12열 격자(8+4)와 같은 비율이라
            홈이 도착했을 때 카드 자리가 튀지 않고, 2열 본문을 쓰는 다른 화면에도 그대로 맞는다 */}
        <div className="mt-8 grid gap-6 xl:grid-cols-12">
          <Skeleton className="h-[340px] rounded-card xl:col-span-8" />
          <Skeleton className="h-[340px] rounded-card xl:col-span-4" />
          <Skeleton className="h-[320px] rounded-card xl:col-span-8" />
          <Skeleton className="h-[320px] rounded-card xl:col-span-4" />
        </div>
      </div>
    </main>
  );
}
