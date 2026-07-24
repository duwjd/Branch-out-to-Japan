'use client';

/**
 * 브랜드 추가 모달(MAIN-01b′) — 스위처·마이페이지·온보딩 3진입점 공용.
 * 온보딩 카드(BrandOnboarding)와 같은 3필드·검증. 성공 시 활성 브랜드로 전환되고
 * ③ 브랜드 관리(빈 상태 BRAND-07)로 착지한다. 실패 시 모달·입력 유지.
 * Esc·바깥클릭·"나중에 하기"는 입력이 있으면 확인 후 닫는다.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { buttonClass, chipClass, fieldLabelClass, inputClass, selectClass } from '@/components/ui/primitives';
import { LoginGateModal } from '@/components/auth/LoginGateModal';
import { useLoginGate } from '@/components/auth/useLoginGate';

/** 카테고리 정본 — 온보딩·리포트 입력폼과 동일(한/일 병기) */
const CATEGORIES = [
  { value: 'skincare', label: '스킨케어 / スキンケア' },
  { value: 'makeup', label: '메이크업 / メイク' },
  { value: 'suncare', label: '선케어 / 日焼け止め' },
  { value: 'cleansing', label: '클렌징 / クレンジング' },
] as const;

/** 제품분류 — 브랜드 도메인 4종(store BrandProductClass) */
const PRODUCT_CLASSES = ['화장품', '의약외품', '건강식품', '미상'] as const;

export function AddBrandModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [brandName, setBrandName] = useState('');
  const [category, setCategory] = useState('');
  const [productClass, setProductClass] = useState<string>('화장품');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { gateOpen, openGate, closeGate, onAuthedGate } = useLoginGate();

  const dirty = brandName.trim() !== '' || category !== '';
  const canSubmit = brandName.trim() !== '' && category !== '' && !submitting;

  function reset() {
    setBrandName('');
    setCategory('');
    setProductClass('화장품');
    setError(null);
    setSubmitting(false);
  }

  /** Esc·바깥클릭·나중에 하기 — 입력이 있으면 확인 후 닫기(입력 소실 경고) */
  function requestClose() {
    if (submitting) return;
    if (dirty && !window.confirm('입력한 내용이 사라집니다. 닫을까요?')) return;
    reset();
    onClose();
  }

  /** 브랜드 추가 요청(파라미터 없는 재시도 함수) — 401이면 게이트를 열고 로그인 후 자동 재개 */
  async function doSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/brand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandName, category, productClass }),
      });
      if (res.status === 401) {
        setSubmitting(false);
        openGate(doSubmit); // 게이트는 이 모달 위에 열리고, 이 모달은 뒤에 그대로 유지된다
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '추가에 실패했습니다.');
      reset();
      onClose();
      // 성공 착지 = ③ 브랜드 관리 빈 상태(BRAND-07). 서버가 이미 활성 브랜드로 전환함
      router.push('/app/brand?added=1');
      router.refresh();
    } catch (err) {
      setError(String((err as Error).message));
      setSubmitting(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    void doSubmit();
  }

  return (
    <>
      <Modal open={open} onClose={requestClose} labelledBy="addBrandTitle">
        <form onSubmit={handleSubmit}>
        <h2 id="addBrandTitle" className="text-lg font-extrabold text-ink">
          브랜드 추가
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-mute">
          브랜드·카테고리만 있으면 추가할 수 있어요. 제품·채널·용어집은 브랜드 관리에서 채우면 됩니다.
        </p>

        <div className="mt-5">
          <label htmlFor="addBrandName" className={fieldLabelClass}>
            브랜드명 <span className="text-coral-strong">*</span>
          </label>
          <input
            id="addBrandName"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            maxLength={40}
            placeholder="예: 하루온 HARUON"
            autoComplete="off"
            className={inputClass}
          />
        </div>

        <div className="mt-4">
          <span id="addCatLabel" className={fieldLabelClass}>
            카테고리 <span className="text-coral-strong">*</span>
          </span>
          <div role="radiogroup" aria-labelledby="addCatLabel" className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={category === c.value}
                onClick={() => setCategory(c.value)}
                className={chipClass(category === c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="addClass" className={fieldLabelClass}>
            제품분류 <span className="font-normal text-ink-mute">(선택)</span>
          </label>
          <select
            id="addClass"
            value={productClass}
            onChange={(e) => setProductClass(e.target.value)}
            className={`${selectClass} w-full`}
          >
            {PRODUCT_CLASSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-[10px] border border-danger bg-danger-bg p-3 text-[13px] text-danger-text">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={requestClose} disabled={submitting} className={buttonClass('secondary', 'md', 'flex-1')}>
            나중에 하기
          </button>
          <button type="submit" disabled={!canSubmit} className={buttonClass('primary', 'md', 'flex-1')}>
            {submitting ? '추가 중…' : '추가하기'}
          </button>
        </div>
      </form>
      </Modal>
      <LoginGateModal open={gateOpen} onClose={closeGate} onAuthed={onAuthedGate} />
    </>
  );
}
