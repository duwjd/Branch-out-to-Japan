import Link from 'next/link';
import { KglowLogo } from '@/components/brand/Logo';
import { cardClass } from '@/components/ui/primitives';
import { VerifyEmailCard } from './VerifyEmailCard';

/**
 * 이메일 인증 링크 랜딩(LOGIN-09) — 셸 없는 단독 카드. `?token=`을 클라이언트 카드에 넘긴다.
 * 실제 토큰 검증 POST는 마운트 시 VerifyEmailCard(클라이언트)가 수행한다.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <main className="main-glow flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <section aria-label="이메일 인증" className={cardClass('w-full max-w-[400px] animate-fade-up p-8 text-center')}>
        <KglowLogo className="mx-auto h-[22px] w-auto" uid="verify-logo" />
        <VerifyEmailCard token={token ?? null} />
      </section>

      <Link href="/login" className="mt-[18px] text-[12.5px] text-ink-mute no-underline hover:underline">
        ← 로그인으로
      </Link>
    </main>
  );
}
