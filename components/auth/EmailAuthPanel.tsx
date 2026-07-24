'use client';

/**
 * 이메일 로그인·회원가입 공용 상태 머신(LOGIN-06~10) — 로그인 카드와 게이트 모달(M4b)이 공유한다.
 * 탭 2개(로그인 | 회원가입) + 파생 안내 패널(인증 메일 안내 · 비밀번호 찾기).
 * 계정 존재/미인증 여부는 서버가 판정하며(비노출 원칙), 여기선 형식 검증과 상태 전환만 한다.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonClass, fieldLabelClass, inputClass } from '@/components/ui/primitives';
import { ResendVerifyButton } from './ResendVerifyButton';
import { DevLink } from './DevLink';
import { isEmailish } from './authUtils';

/** 패널 내부 화면 — 탭(로그인·회원가입) + 제출 후 파생 패널 */
type Screen =
  | { kind: 'login' }
  | { kind: 'signup' }
  | { kind: 'forgot' }
  | { kind: 'verify'; variant: 'sent' | 'needed'; email: string; devLink: string | null }
  | { kind: 'forgotSent'; devLink: string | null };

interface EmailAuthPanelProps {
  /** 로그인 성공 콜백(게이트는 "모달 닫고 재개"를 넘긴다). 없으면 /app으로 이동 */
  onAuthed?: () => void;
  /** 게이트 모달용 — 상단 여백을 줄인다 */
  compact?: boolean;
}

/** 탭 버튼 클래스 — 세그먼트 컨트롤(선택 시 흰 배경 + 카드 그림자) */
function tabClass(on: boolean): string {
  return [
    'h-9 flex-1 rounded-[8px] text-[13px] font-bold transition-colors',
    on ? 'bg-canvas text-ink shadow-card' : 'text-ink-mute hover:text-ink-body',
  ].join(' ');
}

export function EmailAuthPanel({ onAuthed, compact = false }: EmailAuthPanelProps) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ kind: 'login' });

  // 로그인 탭(LOGIN-07)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // 회원가입 탭(LOGIN-08)
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPassword2, setSignupPassword2] = useState('');
  const [agree, setAgree] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupDuplicate, setSignupDuplicate] = useState(false);
  const [signupBusy, setSignupBusy] = useState(false);

  // 비밀번호 찾기(LOGIN-10)
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotBusy, setForgotBusy] = useState(false);

  /** 로그인 성공 착지 — 게이트는 onAuthed로 재개를 넘긴다 */
  function handleAuthed() {
    if (onAuthed) {
      onAuthed();
      return;
    }
    router.replace('/app');
    router.refresh();
  }

  /** 탭 전환 — 관련 에러를 초기화한다 */
  function goTab(tab: 'login' | 'signup') {
    setScreen({ kind: tab });
    setLoginError(null);
    setSignupError(null);
    setSignupDuplicate(false);
  }

  /** 이메일 로그인 제출(LOGIN-07) — 401 인라인 · 403 미인증은 인증 안내로 전환 */
  async function submitLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loginBusy) return;
    if (!isEmailish(loginEmail)) {
      setLoginError('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    if (loginPassword.length === 0) {
      setLoginError('비밀번호를 입력해 주세요.');
      return;
    }
    setLoginBusy(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/email/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword, remember }),
      });
      if (res.status === 403) {
        const data = (await res.json().catch(() => ({}))) as { email?: string };
        setScreen({ kind: 'verify', variant: 'needed', email: data.email ?? loginEmail.trim(), devLink: null });
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setLoginError(data.error ?? '이메일 또는 비밀번호가 올바르지 않습니다.');
        return;
      }
      handleAuthed();
    } catch {
      setLoginError('네트워크 오류로 로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoginBusy(false);
    }
  }

  const signupValid =
    isEmailish(signupEmail) && signupPassword.length >= 8 && signupPassword === signupPassword2 && agree;

  /** 이메일 회원가입 제출(LOGIN-08) — 클라 검증 후 409 중복 인라인 · 성공은 인증 안내로 전환 */
  async function submitSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (signupBusy) return;
    setSignupDuplicate(false);
    if (!isEmailish(signupEmail)) {
      setSignupError('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (signupPassword !== signupPassword2) {
      setSignupError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!agree) {
      setSignupError('약관에 동의해 주세요.');
      return;
    }
    setSignupBusy(true);
    setSignupError(null);
    try {
      const res = await fetch('/api/auth/email/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail.trim(), password: signupPassword }),
      });
      if (res.status === 409) {
        setSignupError('이미 가입된 이메일입니다. 로그인 탭에서 로그인해 주세요.');
        setSignupDuplicate(true);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSignupError(data.error ?? '가입에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { devLink?: string | null };
      // 가입은 세션을 주지 않는다 — 인증 메일 안내로 전환, 인증 후 로그인 탭으로 유도
      setScreen({ kind: 'verify', variant: 'sent', email: signupEmail.trim(), devLink: data.devLink ?? null });
    } catch {
      setSignupError('네트워크 오류로 가입하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSignupBusy(false);
    }
  }

  /** 중복 이메일 → 로그인 탭으로 이동하며 이메일을 미리 채운다 */
  function goLoginFromDuplicate() {
    setLoginEmail(signupEmail.trim());
    goTab('login');
  }

  /** 비밀번호 찾기 제출(LOGIN-10) — 가입 여부와 무관하게 동일한 "메일 보냈어요"로 전환(비노출) */
  async function submitForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (forgotBusy) return;
    if (!isEmailish(forgotEmail)) {
      setForgotError('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    setForgotBusy(true);
    setForgotError(null);
    try {
      const res = await fetch('/api/auth/email/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { devLink?: string | null };
      setScreen({ kind: 'forgotSent', devLink: data.devLink ?? null });
    } catch {
      setForgotError('네트워크 오류로 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setForgotBusy(false);
    }
  }

  const showTabs = screen.kind === 'login' || screen.kind === 'signup';

  return (
    <div className={compact ? 'mt-4' : 'mt-6'}>
      {showTabs && (
        <div role="tablist" aria-label="이메일 로그인·회원가입" className="flex gap-1 rounded-[10px] bg-n-100 p-1">
          <button type="button" role="tab" aria-selected={screen.kind === 'login'} onClick={() => goTab('login')} className={tabClass(screen.kind === 'login')}>
            로그인
          </button>
          <button type="button" role="tab" aria-selected={screen.kind === 'signup'} onClick={() => goTab('signup')} className={tabClass(screen.kind === 'signup')}>
            회원가입
          </button>
        </div>
      )}

      {/* LOGIN-07 · 이메일 로그인 */}
      {screen.kind === 'login' && (
        <form onSubmit={submitLogin} className="mt-[18px] text-left">
          <label htmlFor="li-email" className={fieldLabelClass}>
            이메일
          </label>
          <input
            id="li-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
            aria-invalid={loginError ? true : undefined}
            aria-describedby={loginError ? 'li-err' : undefined}
          />
          <label htmlFor="li-pw" className={`${fieldLabelClass} mt-3`}>
            비밀번호
          </label>
          <input
            id="li-pw"
            type="password"
            autoComplete="current-password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="비밀번호"
            className={inputClass}
            aria-invalid={loginError ? true : undefined}
            aria-describedby={loginError ? 'li-err' : undefined}
          />
          {loginError && (
            <p id="li-err" role="alert" className="mt-2 text-[12.5px] font-semibold text-danger-text">
              ✕ {loginError}
            </p>
          )}
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-body">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[15px] w-[15px] accent-coral" />
            로그인 상태 유지
          </label>
          <button type="submit" disabled={loginBusy} className={buttonClass('primary', 'lg', 'mt-4 w-full')}>
            {loginBusy ? '로그인 중…' : '로그인'}
          </button>
          <div className="mt-3.5 text-center">
            <button
              type="button"
              onClick={() => {
                setScreen({ kind: 'forgot' });
                setForgotError(null);
              }}
              className="text-[12.5px] font-semibold text-coral-strong hover:underline"
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>
        </form>
      )}

      {/* LOGIN-08 · 이메일 회원가입 */}
      {screen.kind === 'signup' && (
        <form onSubmit={submitSignup} className="mt-[18px] text-left">
          <label htmlFor="su-email" className={fieldLabelClass}>
            이메일
          </label>
          <input
            id="su-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
            aria-invalid={signupError ? true : undefined}
            aria-describedby={signupError ? 'su-err' : undefined}
          />
          <label htmlFor="su-pw" className={`${fieldLabelClass} mt-3`}>
            비밀번호
          </label>
          <input
            id="su-pw"
            type="password"
            autoComplete="new-password"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            placeholder="8자 이상"
            className={inputClass}
            aria-invalid={signupError ? true : undefined}
            aria-describedby={signupError ? 'su-err' : undefined}
          />
          <label htmlFor="su-pw2" className={`${fieldLabelClass} mt-3`}>
            비밀번호 확인
          </label>
          <input
            id="su-pw2"
            type="password"
            autoComplete="new-password"
            value={signupPassword2}
            onChange={(e) => setSignupPassword2(e.target.value)}
            placeholder="비밀번호 다시 입력"
            className={inputClass}
            aria-invalid={signupError ? true : undefined}
            aria-describedby={signupError ? 'su-err' : undefined}
          />
          {signupError && (
            <p id="su-err" role="alert" className="mt-2 text-[12.5px] font-semibold text-danger-text">
              ✕ {signupError}
            </p>
          )}
          {signupDuplicate && (
            <button type="button" onClick={goLoginFromDuplicate} className="mt-2 block w-full text-center text-[12.5px] font-semibold text-coral-strong hover:underline">
              로그인 탭으로 이동 →
            </button>
          )}
          {/* LOGIN-03 · 이메일 가입은 명시적 동의 체크박스 필수 */}
          <label className="mt-3.5 flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-ink-body">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-[15px] w-[15px] accent-coral" />
            <span>
              <span className="font-bold text-coral-strong">[필수]</span> <span className="underline">이용약관</span> 및 <span className="underline">개인정보처리방침</span>에 동의합니다.
            </span>
          </label>
          <button type="submit" disabled={!signupValid || signupBusy} className={buttonClass('primary', 'lg', 'mt-4 w-full')}>
            {signupBusy ? '가입 중…' : '회원가입'}
          </button>
        </form>
      )}

      {/* LOGIN-10 · 비밀번호 찾기 */}
      {screen.kind === 'forgot' && (
        <form onSubmit={submitForgot} className="mt-[18px] text-left">
          <p className="mb-3.5 text-[13px] leading-relaxed text-ink-body">가입한 이메일을 입력하면 재설정 링크를 보내드립니다.</p>
          <label htmlFor="fg-email" className={fieldLabelClass}>
            이메일
          </label>
          <input
            id="fg-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
            aria-invalid={forgotError ? true : undefined}
            aria-describedby={forgotError ? 'fg-err' : undefined}
          />
          {forgotError && (
            <p id="fg-err" role="alert" className="mt-2 text-[12.5px] font-semibold text-danger-text">
              ✕ {forgotError}
            </p>
          )}
          <button type="submit" disabled={forgotBusy} className={buttonClass('primary', 'lg', 'mt-4 w-full')}>
            {forgotBusy ? '보내는 중…' : '재설정 링크 보내기'}
          </button>
          <div className="mt-3.5 text-center">
            <button type="button" onClick={() => goTab('login')} className="text-[12.5px] font-semibold text-ink-mute hover:underline">
              ← 로그인으로
            </button>
          </div>
        </form>
      )}

      {/* LOGIN-09 · 인증 메일 안내 (가입 완료 sent / 로그인 미인증 needed) */}
      {screen.kind === 'verify' && (
        <div className="mt-5 text-center">
          <p className="text-[15px] font-bold text-ink">{screen.variant === 'sent' ? '인증 메일을 보냈어요' : '이메일 인증이 필요합니다'}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">
            <span className="font-semibold text-ink-body">{screen.email}</span>{' '}
            {screen.variant === 'sent'
              ? '(으)로 보낸 메일의 링크를 눌러 인증을 완료해 주세요.'
              : '계정은 아직 인증되지 않았습니다. 받은 메일의 링크로 인증해 주세요.'}
          </p>
          <ResendVerifyButton
            email={screen.email}
            initialDevLink={screen.devLink}
            initialCooldownSec={screen.variant === 'sent' ? 60 : 0}
            className="mt-4 text-left"
          />
          <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-mute">인증을 마친 뒤 아래에서 로그인해 주세요.</p>
          <button type="button" onClick={() => goTab('login')} className="mt-1 text-[12.5px] font-semibold text-coral-strong hover:underline">
            ← 로그인으로
          </button>
        </div>
      )}

      {/* LOGIN-10 · 재설정 메일 발송 안내 (계정 존재 비노출) */}
      {screen.kind === 'forgotSent' && (
        <div className="mt-5 text-center">
          <p className="text-[15px] font-bold text-ink">메일을 보냈어요</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">입력하신 주소가 가입돼 있다면 비밀번호 재설정 링크를 보냈습니다. 받은 편지함을 확인해 주세요.</p>
          {screen.devLink && <DevLink href={screen.devLink} label="(dev) 재설정 링크 바로 열기" />}
          <div className="mt-4">
            <button type="button" onClick={() => goTab('login')} className="text-[12.5px] font-semibold text-coral-strong hover:underline">
              ← 로그인으로
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
