'use client';

/**
 * 마이페이지 브랜드 목록(MYPAGE-06) — 복수 브랜드. 각 행 "제품·리포트·썸네일" 카운트 + 「수정」.
 * 「수정」은 그 브랜드로 전환한 뒤 ③ 브랜드 관리로 이동한다. 「＋ 브랜드 추가」는 공용 모달(MAIN-01b′).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS, type Category } from '@/lib/engine/types';
import { AddBrandModal } from '@/components/app/AddBrandModal';
import { buttonClass } from '@/components/ui/primitives';

export interface MypageBrand {
  id: string;
  name: string;
  category: string;
  reportCount: number;
  thumbnailCount: number;
}

export function MypageBrands({ brands, activeBrandId }: { brands: MypageBrand[]; activeBrandId: string | null }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  /** 「수정」 — 활성 아니면 전환 후 편집 화면으로 */
  async function editBrand(id: string) {
    if (id !== activeBrandId) {
      setSwitching(id);
      await fetch(`/api/brand/${id}`, { method: 'POST' });
    }
    router.push('/app/brand');
    router.refresh();
  }

  return (
    <>
      <div className="divide-y divide-n-150">
        {brands.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
            <span
              aria-hidden="true"
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-linear-135 from-[#ffe9df] to-[#ffcfb8] text-[11px] font-extrabold text-amber-text"
            >
              {b.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[13px] font-bold text-ink">
                {b.name}
                {b.id === activeBrandId && (
                  <span className="inline-flex h-4 flex-none items-center rounded-full border border-coral/30 bg-coral-tint px-1.5 text-[9.5px] font-bold text-coral-strong">
                    현재
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-mute">
                {CATEGORY_LABELS[b.category as Category] ?? b.category} · 리포트 {b.reportCount} · 썸네일 {b.thumbnailCount}
              </p>
            </div>
            <button
              type="button"
              disabled={switching !== null}
              onClick={() => void editBrand(b.id)}
              className={buttonClass('secondary', 'sm', 'flex-none')}
            >
              {switching === b.id ? '여는 중…' : '수정'}
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-n-150 p-4 sm:px-5">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="text-[12.5px] font-semibold text-coral-strong transition-colors hover:underline"
        >
          ＋ 브랜드 추가
        </button>
      </div>
      <AddBrandModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
