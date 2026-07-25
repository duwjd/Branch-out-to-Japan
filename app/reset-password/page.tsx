import Link from 'next/link';
import { KglowLogo } from '@/components/brand/Logo';
import { cardClass } from '@/components/ui/primitives';
import { ResetPasswordCard } from './ResetPasswordCard';

/**
 * 비밀번호 재설정 링크 랜딩(LOGIN-10 · 3-reset.html) — 셸 없는 단독 카드.
 * `?token=`을 클라이언트 카드에 넘기고, 새 비밀번호 제출 POST는 ResetPasswordCard가 수행한다.
 */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <main className="main-glow flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <section aria-label="비밀번호 재설정" className={cardClass('w-full max-w-[400px] animate-fade-up p-8')}>
        <div className="text-center">
          <KglowLogo className="mx-auto h-[22px] w-auto" uid="reset-logo" />
        </div>
        <ResetPasswordCard token={token ?? null} />
      </section>

      <Link href="/login" className="mt-[18px] text-[12.5px] text-ink-mute no-underline hover:underline">
        ← 로그인으로
      </Link>
    </main>
  );
}
