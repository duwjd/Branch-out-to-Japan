import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/server/session';
import { KglowLogo } from '@/components/brand/Logo';
import { cardClass } from '@/components/ui/primitives';
import { LoginCard } from './LoginCard';

/**
 * 로그인 — 셸 없는 단독 화면 (docs/specs/03-account/03-account-ui-기획서.md LOGIN-00·01·06 정본).
 * 카드는 두 모드(소셜 기본 / 이메일 펼침) — 전환·인증 상호작용은 LoginCard(클라이언트).
 * ?expired=1이면 세션 만료 배너(LOGIN-00). 소셜은 목 세션 발급, 이메일은 실 인증 API(M2).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await getSession()) redirect('/app'); // LOGIN-00: 로그인 상태로 접근 시 앱으로
  const { expired } = await searchParams;

  return (
    <main className="main-glow flex min-h-screen flex-col items-center justify-center px-6 py-12">
      {expired === '1' && (
        <div role="status" className="mb-3.5 w-full max-w-[400px] rounded-[10px] border border-amber bg-amber-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-text animate-fade-up">
          세션이 만료되었습니다 △ — 다시 로그인해 주세요.
        </div>
      )}

      <section aria-label="로그인" className={cardClass('w-full max-w-[400px] animate-fade-up p-8 text-center')}>
        <KglowLogo className="mx-auto h-[22px] w-auto" uid="login-logo" />
        <h1 className="mt-[18px] text-[22px] font-extrabold tracking-[-0.02em] text-ink">KGLOW 시작하기</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-mute">
          일본 고객 관점의 진단과 콘텐츠 제작,
          <br />
          하나의 계정으로 시작합니다.
        </p>

        <LoginCard />
      </section>

      <Link href="/" className="mt-[18px] text-[12.5px] text-ink-mute no-underline hover:underline">
        ← 소개 페이지로
      </Link>
    </main>
  );
}
