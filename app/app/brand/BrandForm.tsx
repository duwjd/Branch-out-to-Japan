'use client';

/**
 * 브랜드 킷 편집 폼(BRAND-02~06) — 4섹션: 프로필·제품·채널·일본향 용어집/톤.
 * 저장값은 다음 진단·생성부터 반영 — 발행된 리포트·자산에 불소급(tierInput 스냅샷 원칙).
 */

import { useRef, useState } from 'react';
import { POSITIONING_TAGS, POSITIONING_TAGS_MAX } from '@/lib/engine/rules/positioning';
import { CATEGORY_LABELS, type Category } from '@/lib/engine/types';
import type { BrandProductClass, BrandProfileRecord } from '@/lib/db/store';

const PRODUCT_CLASSES: BrandProductClass[] = ['화장품', '의약외품', '건강식품', '미상'];
const JP_CHANNELS = [
  { value: 'qoo10', label: 'Qoo10' },
  { value: 'rakuten', label: '라쿠텐' },
  { value: 'amazon-jp', label: '아마존JP' },
  { value: 'undecided', label: '미정' },
];

/** 섹션 카드 공통 래퍼 */
function SectionCard({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 p-5">
      <h2 className="text-sm font-bold">{title}</h2>
      {caption && <p className="mt-1 text-xs text-neutral-500">{caption}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

const inputClass = 'mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm';

export function BrandForm({
  initialProfile,
  storeKind,
}: {
  initialProfile: BrandProfileRecord | null;
  storeKind: 'supabase' | 'file';
}) {
  const p = initialProfile;
  const [brandName, setBrandName] = useState(p?.brandName ?? '');
  const [category, setCategory] = useState<Category | ''>(p?.category ?? '');
  const [productClass, setProductClass] = useState<BrandProductClass>(p?.productClass ?? '미상');
  const [tags, setTags] = useState<string[]>(p?.positioningTags ?? []);
  const [targetMemo, setTargetMemo] = useState(p?.targetMemo ?? '');
  const [productInfoMemo, setProductInfoMemo] = useState(p?.productInfoMemo ?? '');
  const [krUrl, setKrUrl] = useState(p?.channels.krUrl ?? '');
  const [jpChannels, setJpChannels] = useState<{ channel: string; url: string }[]>(p?.channels.jp ?? []);
  const [productNamesJa, setProductNamesJa] = useState(p?.brandKit.productNamesJa ?? []);
  const [forbiddenTerms, setForbiddenTerms] = useState(p?.brandKit.forbiddenTerms ?? []);
  const [toneGuide, setToneGuide] = useState(p?.brandKit.toneGuide ?? '');
  const [detailDocName, setDetailDocName] = useState(p?.detailDocName ?? null);
  const [hasProfile, setHasProfile] = useState(p !== null);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const canSave = Boolean(brandName.trim() && category && tags.length >= 1);

  function toggleTag(value: string) {
    setTags((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : prev.length < POSITIONING_TAGS_MAX ? [...prev, value] : prev,
    );
  }

  function toggleJpChannel(channel: string) {
    setJpChannels((prev) =>
      prev.some((c) => c.channel === channel) ? prev.filter((c) => c.channel !== channel) : [...prev, { channel, url: '' }],
    );
  }

  /** 저장(BRAND-06) — 서버가 동일 규칙으로 재검증한다 */
  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch('/api/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          category,
          productClass,
          positioningTags: tags,
          targetMemo,
          productInfoMemo,
          channels: { krUrl, jp: jpChannels },
          brandKit: { productNamesJa, forbiddenTerms, toneGuide },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setHasProfile(true);
      setSavedMsg('저장되었습니다 — 다음 생성부터 반영됩니다');
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  /** 상세페이지 문서 업로드(BRAND-03) — 프로필 저장 후에만 가능 */
  async function handleDocUpload(file: File) {
    setDocError(null);
    const form = new FormData();
    form.set('doc', file);
    const res = await fetch('/api/brand/doc', { method: 'POST', body: form });
    if (!res.ok) {
      setDocError((await res.json()).error ?? `HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    setDetailDocName(data.detailDocName);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 pb-28">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-[#D93636]">KGLOW 운영</p>
          {storeKind === 'file' && (
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">로컬 저장(dev)</span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-bold">브랜드 관리</h1>
        <p className="mt-2 text-sm text-neutral-600">
          여기 저장한 브랜드 킷이 진단과 썸네일 생성의 입력이 됩니다. 한 번 정리하면 다시 입력하지 않습니다.
        </p>
      </header>

      <div className="mt-6 space-y-5">
        {/* 브랜드 프로필(BRAND-02) */}
        <SectionCard title="브랜드 프로필" caption="수정해도 이미 발행된 리포트는 바뀌지 않습니다 — 다음 진단·생성부터 반영됩니다">
          <label className="block text-xs font-medium text-neutral-700">
            브랜드명 <span className="text-[#D93636]">*</span>
            <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={60} className={inputClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-neutral-700">
              카테고리 <span className="text-[#D93636]">*</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass}>
                <option value="">선택</option>
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-neutral-700">
              제품분류
              <select value={productClass} onChange={(e) => setProductClass(e.target.value as BrandProductClass)} className={inputClass}>
                {PRODUCT_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-700">
              포지셔닝 태그 <span className="text-[#D93636]">*</span> <span className="font-normal text-neutral-500">1~5개 · ① 진단 입력과 동일 칩</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {POSITIONING_TAGS.map((tag) => {
                const on = tags.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTag(tag.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      on ? 'border-[#D93636] bg-[#FFF8F8] font-semibold text-[#D93636]' : 'border-neutral-300'
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block text-xs font-medium text-neutral-700">
            타깃 메모 (선택)
            <input type="text" value={targetMemo} onChange={(e) => setTargetMemo(e.target.value)} maxLength={500} className={inputClass} placeholder="예: 민감성 피부, 20~30대" />
          </label>
        </SectionCard>

        {/* 제품 정보(BRAND-03) */}
        <SectionCard title="제품 정보">
          <label className="block text-xs font-medium text-neutral-700">
            제품 정보 메모
            <textarea value={productInfoMemo} onChange={(e) => setProductInfoMemo(e.target.value)} maxLength={1000} rows={3} className={inputClass} placeholder="주력 제품·핵심 성분·가격대 등" />
          </label>
          <div className="text-xs">
            <p className="font-medium text-neutral-700">상세페이지 문서</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-neutral-600">{detailDocName ?? '업로드된 문서 없음'}</span>
              <input
                ref={docInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleDocUpload(f);
                }}
              />
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                disabled={!hasProfile}
                className={`rounded-lg border px-2.5 py-1 font-medium ${
                  hasProfile ? 'border-neutral-300 hover:border-[#D93636] hover:text-[#D93636]' : 'cursor-not-allowed border-neutral-200 text-neutral-400'
                }`}
              >
                {detailDocName ? '재업로드' : '업로드'} (PDF·이미지)
              </button>
              {!hasProfile && <span className="text-neutral-400">프로필을 먼저 저장해 주세요</span>}
            </div>
            {docError && <p role="alert" className="mt-1 text-[#B3271D]">{docError}</p>}
          </div>
        </SectionCard>

        {/* 채널(BRAND-04) */}
        <SectionCard title="채널" caption="기업 매칭 신청 시 자동 첨부에 포함됩니다">
          <label className="block text-xs font-medium text-neutral-700">
            KR 채널 URL
            <input type="url" value={krUrl} onChange={(e) => setKrUrl(e.target.value)} className={inputClass} placeholder="https://" />
          </label>
          <div>
            <p className="text-xs font-medium text-neutral-700">JP 채널 (복수 선택)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {JP_CHANNELS.map((ch) => {
                const on = jpChannels.some((c) => c.channel === ch.value);
                return (
                  <button
                    key={ch.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleJpChannel(ch.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      on ? 'border-[#D93636] bg-[#FFF8F8] font-semibold text-[#D93636]' : 'border-neutral-300'
                    }`}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </div>
            {jpChannels.filter((c) => c.channel !== 'undecided').map((c) => (
              <label key={c.channel} className="mt-2 block text-xs text-neutral-600">
                {JP_CHANNELS.find((ch) => ch.value === c.channel)?.label} URL
                <input
                  type="url"
                  value={c.url}
                  onChange={(e) =>
                    setJpChannels((prev) => prev.map((x) => (x.channel === c.channel ? { ...x, url: e.target.value } : x)))
                  }
                  className={inputClass}
                  placeholder="https://"
                />
              </label>
            ))}
          </div>
        </SectionCard>

        {/* 일본향 용어집·톤 가이드(BRAND-05) */}
        <SectionCard title="일본향 용어집 · 톤 가이드" caption="일본 고객 관점 메시지 재설계의 입력입니다 — 범용 번역 사전이 아닙니다">
          <div>
            <p className="text-xs font-medium text-neutral-700">제품명 일본어 표기</p>
            {productNamesJa.map((row, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={row.kr}
                  placeholder="KR 제품명"
                  onChange={(e) => setProductNamesJa((prev) => prev.map((x, j) => (j === i ? { ...x, kr: e.target.value } : x)))}
                  className="w-1/2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  lang="ja"
                  value={row.ja}
                  placeholder="JA 표기"
                  onChange={(e) => setProductNamesJa((prev) => prev.map((x, j) => (j === i ? { ...x, ja: e.target.value } : x)))}
                  className="w-1/2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <button type="button" aria-label="행 삭제" onClick={() => setProductNamesJa((prev) => prev.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-[#B3271D]">
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setProductNamesJa((prev) => [...prev, { kr: '', ja: '' }])} className="mt-2 text-xs font-semibold text-[#D93636] underline">
              + 표기 쌍 추가
            </button>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-700">금지 표현 <span className="font-normal text-neutral-500">사유 없이 등록되지 않습니다 (증거 원칙)</span></p>
            {forbiddenTerms.map((row, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={row.term}
                  placeholder="금지 표현"
                  onChange={(e) => setForbiddenTerms((prev) => prev.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)))}
                  className="w-2/5 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={row.reason}
                  placeholder="사유 (약기법·플랫폼 규정 등)"
                  onChange={(e) => setForbiddenTerms((prev) => prev.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))}
                  className="w-3/5 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <button type="button" aria-label="행 삭제" onClick={() => setForbiddenTerms((prev) => prev.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-[#B3271D]">
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setForbiddenTerms((prev) => [...prev, { term: '', reason: '' }])} className="mt-2 text-xs font-semibold text-[#D93636] underline">
              + 금지 표현 추가
            </button>
          </div>
          <label className="block text-xs font-medium text-neutral-700">
            톤 가이드 <span className="font-normal text-neutral-500">{toneGuide.length}/300</span>
            <textarea value={toneGuide} onChange={(e) => setToneGuide(e.target.value.slice(0, 300))} rows={3} className={inputClass} placeholder="일본 고객 대상 톤 1~3문장" />
            <span className="mt-1 block font-normal text-neutral-500">다음 생성부터 입력으로 전달할 준비를 하고 있습니다</span>
          </label>
        </SectionCard>
      </div>

      {/* 저장 바(BRAND-06) — 화면 유일 primary */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-neutral-500" role="status">
            {savedMsg ?? (!canSave ? '브랜드명·카테고리·포지셔닝 1개 이상이 필요합니다' : '')}
          </p>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void handleSave()}
            className={`rounded-lg px-6 py-2.5 text-sm font-bold text-white ${
              canSave && !saving ? 'bg-[#FF6464] hover:bg-[#D93636]' : 'cursor-not-allowed bg-neutral-300'
            }`}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mx-auto mt-2 max-w-3xl text-xs text-[#B3271D]">{error}</p>
        )}
      </div>
    </main>
  );
}
