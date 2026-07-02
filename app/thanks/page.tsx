import Link from "next/link";

/** 신청 완료 확인 페이지 */
export default function ThanksPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 text-center text-zinc-900">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-2xl">
          ✓
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">신청이 접수되었습니다</h1>
        <p className="mt-4 leading-relaxed text-zinc-600">
          일본 고객 관점에서 콘텐츠를 살펴본 뒤 진단 결과를 안내드리겠습니다.
          빠르게 확인하고 연락드릴게요.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-lg border border-zinc-300 px-6 py-3 text-base font-semibold transition hover:bg-zinc-50"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
