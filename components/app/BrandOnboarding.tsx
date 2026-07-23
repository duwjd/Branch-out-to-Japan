'use client';

/**
 * 온보딩 첫 브랜드 캡처(MAIN-13 / ONBOARD-01·02) — 브랜드 미등록 신규 유저의 first-run 카드.
 * 필수 3필드(브랜드명·카테고리·제품분류)만 받아 POST /api/brand로 브랜드 프로필을 만든다.
 * 성공 시 router.refresh() — 홈 서버 컴포넌트가 no-brand 분기를 벗어나 첫 방문 셋업 가이드(MAIN-06)로 재렌더된다.
 * 필드 정본은 ⓪ MAIN-01b′ 브랜드 추가 모달과 동일(같은 값 두 벌 정의 X).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonClass, cardClass, chipClass, fieldLabelClass, inputClass, selectClass } from '@/components/ui/primitives';

/** 카테고리 정본 — 리포트 입력폼과 동일(한/일 병기) */
const CATEGORIES = [
  { value: 'skincare', label: '스킨케어 / スキンケア' },
  { value: 'makeup', label: '메이크업 / メイク' },
  { value: 'suncare', label: '선케어 / 日焼け止め' },
  { value: 'cleansing', label: '클렌징 / クレンジング' },
] as const;

/** 제품분류 — 브랜드 도메인 4종(store BrandProductClass) */
const PRODUCT_CLASSES = ['화장품', '의약외품', '건강식품', '미상'] as const;

export function BrandOnboarding() {
  const router = useRouter();
  const [brandName, setBrandName] = useState('');
  const [category, setCategory] = useState('');
  const [productClass, setProductClass] = useState<string>('화장품');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = brandName.trim().length > 0 && category !== '' && !submitting;

  /** 제출 → 브랜드 생성 → 홈 재렌더(첫 방문 가이드) */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/brand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandName, category, productClass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '등록에 실패했습니다.');
      router.refresh();
    } catch (err) {
      setError(String((err as Error).message));
      setSubmitting(false);
    }
  }

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[560px] px-8 pt-14 pb-24 max-sm:px-5">
        <div className="text-center">
          <span className="inline-flex h-7 items-center rounded-full border border-coral/30 bg-coral-tint px-[13px] text-xs font-bold text-coral-strong">
            시작하기
          </span>
          <h1 className="mt-4 text-[clamp(28px,3.2vw,36px)] leading-[1.25] font-extrabold tracking-[-0.03em] text-ink">
            브랜드를 <b className="font-extrabold text-coral-strong">먼저</b> 등록해 주세요
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-mute [text-wrap:pretty]">
            브랜드·카테고리만 있으면 진단을 시작할 수 있어요. 제품·채널·용어집은 나중에 브랜드 관리에서 채우면 됩니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={cardClass('mt-6 p-6 sm:p-7')}>
          <div>
            <label htmlFor="obBrandName" className={fieldLabelClass}>
              브랜드명 <span className="text-coral-strong">*</span>
            </label>
            <input
              id="obBrandName"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              maxLength={40}
              placeholder="예: 하루온 HARUON"
              autoComplete="off"
              className={inputClass}
            />
          </div>

          <div className="mt-5">
            <span id="obCatLabel" className={fieldLabelClass}>
              카테고리 <span className="text-coral-strong">*</span>
            </span>
            <div role="radiogroup" aria-labelledby="obCatLabel" className="flex flex-wrap gap-2">
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

          <div className="mt-5">
            <label htmlFor="obClass" className={fieldLabelClass}>
              제품분류 <span className="font-normal text-ink-mute">(선택)</span>
            </label>
            <select
              id="obClass"
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

          <button type="submit" disabled={!canSubmit} className={buttonClass('primary', 'lg', 'mt-6 w-full')}>
            {submitting ? '등록 중…' : '진단 준비 시작 →'}
          </button>
          <p className="mt-2.5 text-center text-[13px] leading-relaxed text-ink-mute">
            {brandName.trim() && category ? '등록하면 홈 셋업 가이드로 이어집니다.' : '브랜드명·카테고리를 입력하면 시작할 수 있어요.'}
          </p>
          <p className="mt-4 border-t border-n-150 pt-4 text-center text-[12px] leading-relaxed text-ink-mute [text-wrap:pretty]">
            여기서 정한 브랜드를 ① 진단 · ② 생성 · ③ 운영 세 곳에서 그대로 씁니다.
          </p>
        </form>
      </div>
    </main>
  );
}
