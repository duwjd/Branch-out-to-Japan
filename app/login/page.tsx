import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/server/session';
import { KglowLogo } from '@/components/brand/Logo';
import { LoginButtons } from './LoginButtons';

/**
 * 로그인 — 셸 없는 단독 화면 (specs/03-account LOGIN-00~05).
 * 소셜 버튼은 목 세션 발급만 한다(실 OAuth 미연동 — 09 §4b M5).
 */
export default async function LoginPage() {
  if (await getSession()) redirect('/app/library'); // LOGIN-00: 로그인 상태로 접근 시 앱으로

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 py-10">
      <section className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <KglowLogo className="mx-auto h-8" uid="login-logo" />
        <h1 className="mt-6 text-center text-lg font-bold">KGLOW 시작하기</h1>
        <p className="mt-2 text-center text-sm text-neutral-600">
          일본 고객 관점의 진단과 콘텐츠 제작, 하나의 계정으로 시작합니다
        </p>
        <LoginButtons />
        <p className="mt-6 text-center text-xs leading-relaxed text-neutral-500">
          계속 진행하면 KGLOW의 <span className="underline">이용약관</span> 및{' '}
          <span className="underline">개인정보처리방침</span>에 동의하는 것으로 간주됩니다
        </p>
      </section>
      <Link href="/" className="mt-6 text-sm text-neutral-500 underline">
        ← 소개 페이지로
      </Link>
    </main>
  );
}
