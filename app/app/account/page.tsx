import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, PROVIDER_LABELS } from '@/lib/server/session';
import { getStore } from '@/lib/db/store';
import { LogoutButton } from './LogoutButton';

/**
 * 마이페이지(MYPAGE-00~09) — 계정 정보·구독 플랜(목업)·브랜드 요약·계정 관리.
 * 결제·구독은 표시 계약만(전부 목업 — 커머셜 연동 미정). 브랜드 편집 정본은 /app/brand.
 */
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const store = await getStore();
  const [profile, requests, assets] = await Promise.all([
    store.getBrandProfile(),
    store.listRequests(),
    store.listAssets(),
  ]);
  const reportCount = requests.filter((r) => r.status === 'published').length;
  const thumbnailCount = assets.filter((a) => a.status === 'done').length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">마이페이지</h1>
      <p className="mt-1 text-sm text-neutral-600">가입 정보·플랜·브랜드 프로필을 한곳에서 확인합니다</p>

      {/* 계정 정보(MYPAGE-02) */}
      <section className="mt-6 rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-bold">계정 정보</h2>
        <div className="mt-3 flex items-center gap-3">
          <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF6464] text-base font-bold text-white">
            {session.user.name.slice(0, 1)}
          </span>
          <div className="text-sm">
            <p className="font-semibold">{session.user.name}</p>
            <p className="text-xs text-neutral-500">{session.user.email}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium">
            {PROVIDER_LABELS[session.provider]} 연결됨
          </span>
          <span className="text-neutral-500">{session.user.joinedAt.replace(/-/g, '.')} 가입</span>
        </div>
      </section>

      {/* 구독 플랜(MYPAGE-03) — 목업 */}
      <section className="mt-5 rounded-2xl border border-neutral-200 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          구독 플랜 <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">연동 방식 (미정) · 목업</span>
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm"><span className="rounded bg-neutral-100 px-2 py-0.5 font-bold">FREE</span> <span className="ml-1 font-medium">무료</span></p>
            <p className="mt-1.5 text-xs text-neutral-500">약기법 간이 체커만 이용 중입니다</p>
          </div>
          <Link href="/app/report/new" className="rounded-lg bg-[#FF6464] px-4 py-2 text-sm font-bold text-white hover:bg-[#D93636]">
            진단 신청 (Report · ₩300,000 · 1회)
          </Link>
        </div>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
          {[
            ['FREE', '무료', '간이 체커'],
            ['Growth', '월 ₩200,000', '스튜디오 + 리뷰 축적 운영 (실비 별도)'],
            ['Scale', '월 ₩800,000', '운영 확장 (실비 별도)'],
          ].map(([name, price, desc]) => (
            <div key={name} className={`rounded-xl border p-3 ${name === 'FREE' ? 'border-[#FF6464]' : 'border-neutral-200'}`}>
              <p className="font-bold">{name}{name === 'FREE' && <span className="ml-1 rounded bg-[#FFF1F1] px-1.5 py-0.5 text-[10px] font-semibold text-[#D93636]">현재 플랜</span>}</p>
              <p className="mt-0.5 font-medium">{price}</p>
              <p className="mt-1 text-neutral-500">{desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">플랜 변경은 준비 중입니다 — 결제 연동(PG)·게이트 집행 미구현</p>
      </section>

      {/* 브랜드 프로필(MYPAGE-06) — 조회 요약만, 편집 정본은 ③ 브랜드 관리 */}
      <section className="mt-5 rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-bold">브랜드 프로필</h2>
        {profile ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold">
                {profile.brandName.slice(0, 1)}
              </span>
              <div>
                <p className="font-semibold">{profile.brandName}</p>
                <p className="text-xs text-neutral-500">
                  {profile.category} · 리포트 {reportCount} · 썸네일 {thumbnailCount}
                </p>
              </div>
            </div>
            <Link href="/app/brand" className="text-xs font-semibold text-[#D93636] underline">수정 — ③ 브랜드 관리로 이동</Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-600">
            아직 브랜드 프로필이 없습니다 —{' '}
            <Link href="/app/brand" className="text-[#D93636] underline">브랜드 관리에서 작성</Link>
          </p>
        )}
      </section>

      {/* 계정 관리(MYPAGE-07) — 위험 액션, 시각 분리 */}
      <section className="mt-10 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-bold text-neutral-500">계정 관리</h2>
        <div className="mt-3 flex items-center gap-4">
          <LogoutButton />
          <span aria-disabled="true" className="cursor-not-allowed text-xs text-neutral-400 underline">
            회원 탈퇴 (백엔드 정책 미정)
          </span>
        </div>
      </section>
    </main>
  );
}
