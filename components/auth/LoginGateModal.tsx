'use client';

/**
 * 실행 직전 로그인 게이트 모달(GATE-01~03) — 게스트가 진단·생성·저장을 실행하는 순간에만
 * 뜬다. 로그인 카드(app/login/LoginCard)와 같은 소셜↔이메일 토글 구조를 재사용하되,
 * 성공 콜백(onAuthed)으로 "모달 닫고 원래 액션 재개"를 넘긴다(useLoginGate). 페이지 이동이
 * 없으므로 입력값은 호출측 state에 그대로 유지된다(GATE-04). 취소는 "계속 둘러보기"(GATE-03).
 */

import { useId, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { EmailAuthPanel } from '@/components/auth/EmailAuthPanel';
import { buttonClass } from '@/components/ui/primitives';
import { IconMail } from '@/components/ui/icons';

interface LoginGateModalProps {
  open: boolean;
  /** 취소(계속 둘러보기) — 재개하지 않고 닫는다 */
  onClose: () => void;
  /** 로그인 성공 — useLoginGate의 onAuthedGate(모달 닫고 원래 액션 재개) */
  onAuthed: () => void;
}

export function LoginGateModal({ open, onClose, onAuthed }: LoginGateModalProps) {
  const titleId = useId();
  const [mode, setMode] = useState<'social' | 'email'>('social');

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <h2 id={titleId} className="text-lg font-extrabold text-ink">
        가입하고 이어서 진행하세요
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">
        지금 입력한 내용은 그대로 유지됩니다. 로그인하면 방금 하려던 작업이 이어집니다.
      </p>

      {mode === 'social' ? (
        <>
          <SocialButtons onSuccess={onAuthed} />
          {/* 소셜 ↔ 이메일 전환(로그인 카드와 동일 구조) */}
          <div className="my-4 flex items-center gap-2.5">
            <span aria-hidden className="h-px flex-1 bg-hairline" />
            <span className="text-[11.5px] text-ink-mute">또는</span>
            <span aria-hidden className="h-px flex-1 bg-hairline" />
          </div>
          <button type="button" onClick={() => setMode('email')} className={buttonClass('secondary', 'lg', 'w-full')}>
            <IconMail size={16} />
            이메일로 계속하기
          </button>
        </>
      ) : (
        <div className="mt-3">
          <button type="button" onClick={() => setMode('social')} className="text-[12.5px] font-semibold text-ink-mute hover:underline">
            ← 소셜 로그인으로
          </button>
          <EmailAuthPanel onAuthed={onAuthed} compact />
        </div>
      )}

      {/* GATE-03 · 취소 = 화면·입력 유지하고 계속 둘러보기 */}
      <div className="mt-5 border-t border-hairline pt-4 text-center">
        <button type="button" onClick={onClose} className="text-[12.5px] font-semibold text-ink-mute hover:underline">
          취소하고 계속 둘러보기
        </button>
      </div>
    </Modal>
  );
}
