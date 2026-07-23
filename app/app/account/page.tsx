import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, PROVIDER_LABELS } from '@/lib/server/session';
import { getActiveBrand } from '@/lib/server/activeBrand';
import { getStore } from '@/lib/db/store';
import { buttonClass, cardClass, StatusBadge } from '@/components/ui/primitives';
import { IconCard } from '@/components/ui/icons';
import { LogoutButton } from './LogoutButton';
import { PlanChangeButton, WithdrawButton } from './AccountActions';
import { MypageBrands } from './MypageBrands';

/**
 * 마이페이지(docs/specs/03-account/2-mypage.html MYPAGE-00~09) — 계정 정보 ·
 * 구독 플랜(무료 · 실데이터) · 플랜 비교 · 결제(목업) · 브랜드 프로필 · 계정 관리.
 * 앱 셸은 app/app/layout.tsx가 렌더한다 — 이 페이지는 컬럼 본문만 담당한다.
 * 결제·구독 엔티티는 미구현이므로 표시 계약만(전부 목업 — 커머셜 연동 미정).
 */
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const store = await getStore();
  const [profile, brandList] = await Promise.all([getActiveBrand(), store.listBrandProfiles()]);
  const [requests, assets] = profile
    ? await Promise.all([store.listRequests(profile.id), store.listAssets(profile.id)])
    : [[], []];
  const reportCount = requests.filter((r) => r.status === 'published').length;
  const thumbnailCount = assets.filter((a) => a.status === 'done').length;

  // MYPAGE-06 브랜드 목록 — 브랜드별 카운트(복수 브랜드)
  const brands = await Promise.all(
    brandList.map(async (b) => {
      const [reps, ass] = await Promise.all([store.listReports(b.id), store.listAssets(b.id)]);
      return {
        id: b.id,
        name: b.brandName,
        category: b.category,
        reportCount: reps.filter((r) => r.publishedAt !== null).length,
        thumbnailCount: ass.filter((a) => a.status === 'done').length,
      };
    }),
  );

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[720px] px-8 pt-10 pb-24 max-sm:px-5">
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">마이페이지</h1>
        <p className="mt-1.5 text-[13px] text-ink-mute">계정과 구독 플랜, 결제 정보를 확인합니다.</p>

        {/* MYPAGE-02 · 계정 정보 */}
        <section aria-labelledby="acc-title" className="mt-6">
          <h2 id="acc-title" className="sr-only">
            계정 정보
          </h2>
          <div className={cardClass('flex flex-wrap items-center gap-3.5 p-5')}>
            <span
              aria-hidden="true"
              className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-coral/35 bg-coral-tint text-lg font-extrabold text-coral-strong"
            >
              {session.user.name.slice(0, 1)}
            </span>
            <div className="min-w-[180px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold text-ink">{session.user.name}</span>
                <StatusBadge tone="off">{PROVIDER_LABELS[session.provider]} 연결됨</StatusBadge>
              </div>
              <p className="mt-[3px] text-[12.5px] text-ink-mute">{session.user.email}</p>
            </div>
            <span className="tnum flex-none text-xs text-ink-faint">{session.user.joinedAt.replace(/-/g, '.')} 가입</span>
          </div>
        </section>

        {/* MYPAGE-03 · 구독 플랜 카드(무료 상태 — 실데이터) */}
        <section aria-labelledby="plan-title" className="mt-7">
          <h2 id="plan-title" className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
            구독 플랜
          </h2>
          <div className={cardClass('mt-2.5 flex flex-wrap items-center justify-between gap-3.5 p-5')}>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-ink">FREE</span>
                <span className="text-[13.5px] font-bold text-ink-body">무료</span>
              </div>
              <p className="mt-1.5 text-xs text-ink-mute">약기법 간이 체커만 이용 중입니다.</p>
            </div>
            <a href="#plans" className={buttonClass('secondary', 'sm', 'flex-none no-underline')}>
              플랜 살펴보기
            </a>
          </div>
        </section>

        {/* MYPAGE-04 · 플랜 비교·변경 */}
        <section id="plans" aria-labelledby="plans-title" className="mt-8 scroll-mt-6">
          <h2 id="plans-title" className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
            플랜 비교
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            {/* FREE — 현재 플랜(코랄 보더, CTA 없음) */}
            <div className="flex flex-col gap-2.5 rounded-card border border-coral bg-canvas p-[18px] shadow-card">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-extrabold text-ink">FREE</span>
                <span className="inline-flex h-5 items-center rounded-full border border-coral/30 bg-coral-tint px-2 text-[10.5px] font-bold text-coral-strong">
                  현재 플랜
                </span>
              </div>
              <span className="text-base font-extrabold text-ink">무료</span>
              <ul className="m-0 list-none p-0 text-xs leading-[1.7] text-ink-body">
                <li>· 약기법 간이 체커</li>
                <li>· 샘플 리포트 열람</li>
              </ul>
              <span className="mt-auto text-[11.5px] text-ink-faint">기본 제공</span>
            </div>

            {/* Report — 1회 상품(구독 변경 대상 아님) */}
            <div
              className={cardClass(
                'flex flex-col gap-2.5 p-[18px] transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-extrabold text-ink">Report</span>
                <span className="inline-flex h-5 items-center rounded-full bg-n-150 px-2 text-[10.5px] font-bold text-ink-mute">
                  1회 상품
                </span>
              </div>
              <span className="tnum text-base font-extrabold text-ink">
                ₩300,000 <span className="text-[11.5px] font-semibold text-ink-faint">/ 1회</span>
              </span>
              <ul className="m-0 list-none p-0 text-xs leading-[1.7] text-ink-body">
                <li>· 진단 리포트 전체(페르소나·USP)</li>
                <li>· 리뷰 축적 병목 진단·설계</li>
                <li>· 약기법 실명 감사</li>
                <li>· Before&amp;After 실물(썸네일 1·상세 1)</li>
              </ul>
              <Link href="/app/report/new" className={buttonClass('secondary', 'sm', 'mt-auto no-underline')}>
                진단 신청 →
              </Link>
            </div>

            {/* Growth */}
            <div
              className={cardClass(
                'flex flex-col gap-2.5 p-[18px] transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2',
              )}
            >
              <span className="text-[15px] font-extrabold text-ink">Growth</span>
              <span className="tnum text-base font-extrabold text-ink">월 ₩200,000</span>
              <ul className="m-0 list-none p-0 text-xs leading-[1.7] text-ink-body">
                <li>· Report 전체 포함</li>
                <li>· 썸네일·피드 월 15~30건 + 상세 재설계 분기 1건</li>
                <li>
                  · 리뷰 축적 운영 키트 <span className="text-ink-faint">(실비 별도)</span>
                </li>
                <li>· 첫 4주 성과 확인 리포트</li>
              </ul>
              <PlanChangeButton planName="Growth" variant="primary" className="mt-auto" />
            </div>

            {/* Scale */}
            <div
              className={cardClass(
                'flex flex-col gap-2.5 p-[18px] transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-coral hover:shadow-2',
              )}
            >
              <span className="text-[15px] font-extrabold text-ink">Scale</span>
              <span className="tnum text-base font-extrabold text-ink">월 ₩800,000</span>
              <ul className="m-0 list-none p-0 text-xs leading-[1.7] text-ink-body">
                <li>· Growth 전체 포함</li>
                <li>· 약기법 상시 모니터링</li>
                <li>
                  · 일본 기업 매칭 · 복수 채널·대량 볼륨 <span className="text-ink-faint">(실비 별도)</span>
                </li>
                <li>· 전담 검수자 · 월 리뷰 미팅</li>
              </ul>
              <PlanChangeButton planName="Scale" variant="secondary" className="mt-auto" />
            </div>
          </div>
        </section>

        {/* MYPAGE-05 · 결제(전부 목업) */}
        <section aria-labelledby="pay-title" className="mt-8">
          <div className="flex items-center gap-2.5">
            <h2 id="pay-title" className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
              결제
            </h2>
            <StatusBadge tone="off">목업 — 커머셜 연동 (미정)</StatusBadge>
          </div>
          <div className={cardClass('mt-3 overflow-hidden')}>
            <div className="flex items-center gap-3 border-b border-n-150 p-4 sm:px-5">
              <IconCard className="flex-none text-ink-mute" />
              <p className="flex-1 text-[13px] text-ink-mute">등록된 결제 수단이 없습니다.</p>
              <button type="button" disabled title="PG 연동 미구현 (미정)" className={buttonClass('secondary', 'sm')}>
                변경
              </button>
            </div>
            <p className="p-4 text-[12.5px] text-ink-mute sm:px-5">결제 내역이 없습니다.</p>
          </div>
        </section>

        {/* MYPAGE-06 · 브랜드 프로필(복수 · 조회 요약만 — 편집 정본은 /app/brand) */}
        <section aria-labelledby="brand-title" className="mt-8">
          <h2 id="brand-title" className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
            브랜드 프로필
          </h2>
          <div className={cardClass('mt-3 overflow-hidden')}>
            {brands.length > 0 ? (
              <MypageBrands brands={brands} activeBrandId={profile?.id ?? null} />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
                  <p className="flex-1 text-[13px] text-ink-mute">아직 등록된 브랜드가 없습니다.</p>
                  <Link href="/app" className={buttonClass('secondary', 'sm', 'flex-none no-underline')}>
                    등록하기
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        {/* MYPAGE-07 · 계정 관리(위험 액션 — 시각 분리) */}
        <section aria-labelledby="danger-title" className="mt-11 border-t border-hairline pt-5">
          <h2 id="danger-title" className="text-[13px] font-bold text-ink-mute">
            계정 관리
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <LogoutButton />
            <WithdrawButton reportCount={reportCount} thumbnailCount={thumbnailCount} brandName={profile?.brandName ?? null} />
          </div>
        </section>
      </div>
    </main>
  );
}
