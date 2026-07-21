import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/server/session';
import { KglowLogo } from '@/components/brand/Logo';
import { cardClass } from '@/components/ui/primitives';
import { LoginButtons } from './LoginButtons';

/**
 * 로그인 — 셸 없는 단독 화면 (docs/specs/03-account/1-login.html LOGIN-00~05 정본).
 * 소셜 버튼은 목 세션 발급만 한다(실 OAuth 미연동 — 09 §4b M5).
 */
export default async function LoginPage() {
  if (await getSession()) redirect('/app'); // LOGIN-00: 로그인 상태로 접근 시 앱으로

  return (
    <main className="main-glow flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <section aria-label="로그인" className={cardClass('w-full max-w-[400px] animate-fade-up p-8 text-center')}>
        <KglowLogo className="mx-auto h-[22px] w-auto" uid="login-logo" />
        <h1 className="mt-[18px] text-[22px] font-extrabold tracking-[-0.02em] text-ink">KGLOW 시작하기</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-mute">
          일본 고객 관점의 진단과 콘텐츠 제작,
          <br />
          하나의 계정으로 시작합니다.
        </p>

        <LoginButtons />

        <p className="mt-[18px] text-[11.5px] leading-relaxed text-ink-mute">
          계속 진행하면 KGLOW의 <span className="underline">이용약관</span> 및{' '}
          <span className="underline">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
        </p>
      </section>

      <Link href="/" className="mt-[18px] text-[12.5px] text-ink-mute no-underline hover:underline">
        ← 소개 페이지로
      </Link>
    </main>
  );
}
