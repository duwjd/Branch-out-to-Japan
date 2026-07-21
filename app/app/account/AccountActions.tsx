'use client';

/**
 * 마이페이지 전환·위험 액션 — 플랜 변경(MYPAGE-04a)·회원 탈퇴(MYPAGE-07b) 확인 모달.
 * 둘 다 실제 백엔드 연동이 없다 — 확인 후 "준비 중" 안내로 전환하고 닫는다.
 */

import { useId, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { buttonClass, type ButtonVariant } from '@/components/ui/primitives';

/** 플랜 변경 CTA + 확인 모달 — 결제 연동 전까지 실제 변경 없이 준비 중 안내로 전환한다 */
export function PlanChangeButton({
  planName,
  variant = 'secondary',
  className = '',
}: {
  planName: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const titleId = useId();

  function close() {
    setOpen(false);
    setPending(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant, 'sm', className)}>
        이 플랜으로 변경
      </button>
      <Modal open={open} onClose={close} labelledBy={titleId}>
        {pending ? (
          <>
            <h3 id={titleId} className="text-base leading-relaxed font-extrabold text-ink">
              플랜 변경은 준비 중입니다 — 커머셜 연동(미정)
            </h3>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={close} className={buttonClass('secondary', 'sm')}>
                닫기
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 id={titleId} className="text-base font-extrabold text-ink">
              &apos;{planName}&apos;으로 변경할까요?
            </h3>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-body">
              실비(기프팅·인플루언서 사례비)는 플랜과 별개로 브랜드 부담입니다.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className={buttonClass('secondary', 'sm')}>
                취소
              </button>
              <button type="button" onClick={() => setPending(true)} className={buttonClass('primary', 'sm')}>
                변경하기
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

/** 회원 탈퇴 링크 버튼 + 확인 모달 — 실제 탈퇴 API는 없다(데이터 보존·삭제 정책 미정) */
export function WithdrawButton({
  reportCount,
  thumbnailCount,
  brandName,
}: {
  reportCount: number;
  thumbnailCount: number;
  brandName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const titleId = useId();

  function close() {
    setOpen(false);
    setPending(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border-none bg-transparent p-0 text-[12.5px] font-semibold text-danger-text underline-offset-2 hover:underline"
      >
        회원 탈퇴
      </button>
      <Modal open={open} onClose={close} labelledBy={titleId}>
        {pending ? (
          <>
            <h3 id={titleId} className="text-base leading-relaxed font-extrabold text-ink">
              회원 탈퇴는 준비 중입니다 — 지원 채널로 문의해 주세요
            </h3>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={close} className={buttonClass('secondary', 'sm')}>
                닫기
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 id={titleId} className="text-base font-extrabold text-ink">
              정말 탈퇴하시겠어요?
            </h3>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-body">탈퇴하면 아래 데이터가 삭제되며 되돌릴 수 없습니다.</p>
            <ul className="mt-2.5 list-none p-0 text-[12.5px] leading-[1.8] text-ink-body">
              <li>
                · 진단 리포트 {reportCount}건 · 생성 썸네일 {thumbnailCount}건
              </li>
              <li>· 브랜드 킷{brandName ? ` — ${brandName}` : ' (등록 없음)'}</li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className={buttonClass('secondary', 'sm')}>
                돌아가기
              </button>
              <button type="button" onClick={() => setPending(true)} className={buttonClass('danger', 'sm')}>
                탈퇴하기
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
