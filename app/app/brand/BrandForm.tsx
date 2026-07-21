'use client';

/**
 * 브랜드 킷 편집 폼(BRAND-02~06) — 4섹션: 프로필·제품·채널·일본향 용어집/톤.
 * 저장값은 다음 진단·생성부터 반영 — 발행된 리포트·자산에 불소급(tierInput 스냅샷 원칙).
 * 디자인 정본: docs/specs/04-operations/3-brand.html
 */

import { useRef, useState } from 'react';
import { POSITIONING_TAGS, POSITIONING_TAGS_MAX } from '@/lib/engine/rules/positioning';
import { CATEGORY_LABELS, type Category } from '@/lib/engine/types';
import type { BrandProductClass, BrandProfileRecord } from '@/lib/db/store';
import {
  SectionCard,
  StatusBadge,
  buttonClass,
  chipClass,
  fieldLabelClass,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/ui/primitives';
import { IconDoc } from '@/components/ui/icons';

const PRODUCT_CLASSES: BrandProductClass[] = ['화장품', '의약외품', '건강식품', '미상'];
const JP_CHANNELS = [
  { value: 'qoo10', label: 'Qoo10' },
  { value: 'rakuten', label: '라쿠텐' },
  { value: 'amazon-jp', label: '아마존JP' },
  { value: 'undecided', label: '미정' },
];

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

  const saveMsgClass = error ? 'text-danger-text' : savedMsg ? 'text-green-text' : 'text-ink-mute';

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[760px] px-6 pt-11 pb-28 max-sm:px-5">
        {/* 상단 영역(BRAND-01) — primary는 하단 저장 바의 「저장」 1개 */}
        <header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">KGLOW 운영</p>
            {storeKind === 'file' && <StatusBadge tone="off">로컬 저장(dev)</StatusBadge>}
          </div>
          <h1 className="mt-2.5 text-[30px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
            브랜드 관리
          </h1>
          <p className="mt-3.5 text-[15px] leading-[1.7] text-ink-body [text-wrap:pretty]">
            여기 저장한 브랜드 킷이 진단과 썸네일 생성의 입력이 됩니다. 한 번 정리하면 다시 입력하지 않습니다.
          </p>
          <p className="mt-1.5 text-[12.5px] text-ink-faint">
            수정해도 이미 발행된 리포트는 바뀌지 않습니다 — 다음 생성부터 반영됩니다.
          </p>
        </header>

        <div className="mt-7 flex flex-col gap-4">
          {/* 브랜드 프로필(BRAND-02) */}
          <SectionCard title="브랜드 프로필">
            <div className="space-y-5">
              <div>
                <label htmlFor="brandName" className={fieldLabelClass}>
                  브랜드명 <span className="text-coral-strong">*</span>
                </label>
                <input
                  id="brandName"
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  maxLength={60}
                  className={inputClass}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="category" className={fieldLabelClass}>
                    카테고리 <span className="text-coral-strong">*</span>
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className={`${selectClass} w-full`}
                  >
                    <option value="">선택</option>
                    {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="productClass" className={fieldLabelClass}>
                    제품분류
                  </label>
                  <select
                    id="productClass"
                    value={productClass}
                    onChange={(e) => setProductClass(e.target.value as BrandProductClass)}
                    className={`${selectClass} w-full`}
                  >
                    {PRODUCT_CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <fieldset className="border-0 p-0">
                <legend className={fieldLabelClass}>
                  포지셔닝 태그 <span className="text-coral-strong">*</span>{' '}
                  <span className="font-semibold text-ink-mute">
                    1~5개 · <span className="tnum">{tags.length}</span>/5
                  </span>
                </legend>
                <p className="mt-0.5 mb-2 text-[11.5px] text-ink-faint">
                  ① 진단 입력폼과 같은 목록입니다. 저장하면 다음 진단에서 미리 채워집니다.
                </p>
                <div className="flex flex-wrap gap-2">
                  {POSITIONING_TAGS.map((tag) => (
                    <button
                      key={tag.value}
                      type="button"
                      aria-pressed={tags.includes(tag.value)}
                      onClick={() => toggleTag(tag.value)}
                      className={chipClass(tags.includes(tag.value))}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="targetMemo" className={fieldLabelClass}>
                  타깃 메모 <span className="font-semibold text-ink-mute">(선택)</span>
                </label>
                <textarea
                  id="targetMemo"
                  value={targetMemo}
                  onChange={(e) => setTargetMemo(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="일본에서 만나고 싶은 고객을 자유롭게 적어 주세요"
                  className={textareaClass}
                />
              </div>
            </div>
          </SectionCard>

          {/* 제품 정보(BRAND-03) */}
          <SectionCard title="제품 정보">
            <div className="space-y-4">
              <div>
                <label htmlFor="productInfoMemo" className={fieldLabelClass}>
                  제품 정보 메모
                </label>
                <textarea
                  id="productInfoMemo"
                  value={productInfoMemo}
                  onChange={(e) => setProductInfoMemo(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="주력 제품·핵심 성분·가격대 등"
                  className={textareaClass}
                />
              </div>
              <div>
                <p className={fieldLabelClass}>상세페이지 문서</p>
                <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-card-border bg-n-50 px-3 py-2.5">
                  <IconDoc size={15} className="flex-none text-ink-mute" />
                  <span className="flex-1 text-[12.5px] font-semibold text-ink">{detailDocName ?? '업로드된 문서 없음'}</span>
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
                    className={buttonClass('secondary', 'sm')}
                  >
                    {detailDocName ? '재업로드' : '업로드'} (PDF·이미지)
                  </button>
                </div>
                {!hasProfile && <p className="mt-1.5 text-[11.5px] text-ink-faint">프로필을 먼저 저장해 주세요</p>}
                {docError && (
                  <p role="alert" className="mt-1.5 text-[12px] font-semibold text-danger-text">
                    {docError}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 채널(BRAND-04) */}
          <SectionCard title="채널" desc="기업 매칭 신청 시 자동 첨부에 포함됩니다">
            <div className="space-y-4">
              <div>
                <label htmlFor="krUrl" className={fieldLabelClass}>
                  KR 채널 URL
                </label>
                <input
                  id="krUrl"
                  type="url"
                  value={krUrl}
                  onChange={(e) => setKrUrl(e.target.value)}
                  placeholder="https://"
                  className={inputClass}
                />
              </div>
              <fieldset className="border-0 p-0">
                <legend className={fieldLabelClass}>
                  JP 채널 <span className="font-semibold text-ink-mute">(복수 선택)</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {JP_CHANNELS.map((ch) => {
                    const on = jpChannels.some((c) => c.channel === ch.value);
                    return (
                      <button key={ch.value} type="button" aria-pressed={on} onClick={() => toggleJpChannel(ch.value)} className={chipClass(on)}>
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
                {jpChannels.filter((c) => c.channel !== 'undecided').length > 0 && (
                  <div className="mt-3 space-y-3">
                    {jpChannels
                      .filter((c) => c.channel !== 'undecided')
                      .map((c) => (
                        <div key={c.channel}>
                          <label htmlFor={`jpUrl-${c.channel}`} className="mb-1.5 block text-xs font-semibold text-ink-mute">
                            {JP_CHANNELS.find((ch) => ch.value === c.channel)?.label} URL
                          </label>
                          <input
                            id={`jpUrl-${c.channel}`}
                            type="url"
                            value={c.url}
                            onChange={(e) =>
                              setJpChannels((prev) => prev.map((x) => (x.channel === c.channel ? { ...x, url: e.target.value } : x)))
                            }
                            placeholder="https://"
                            className={inputClass}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </fieldset>
            </div>
          </SectionCard>

          {/* 일본향 용어집·톤 가이드(BRAND-05) */}
          <SectionCard title="일본향 용어집 · 톤 가이드" desc="일본 고객 관점 메시지 재설계의 입력입니다 — 범용 번역 사전이 아닙니다">
            <div className="space-y-6">
              {/* 제품명 일본어 표기(BRAND-05a) */}
              <div>
                <h3 className="text-[13px] font-bold text-ink">제품명 일본어 표기</h3>
                <div className="mt-2 space-y-2">
                  {productNamesJa.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.kr}
                        placeholder="KR 제품명"
                        aria-label="KR 제품명"
                        onChange={(e) => setProductNamesJa((prev) => prev.map((x, j) => (j === i ? { ...x, kr: e.target.value } : x)))}
                        className={`${inputClass} flex-1`}
                      />
                      <span aria-hidden className="flex-none text-xs font-bold text-ink-faint">
                        →
                      </span>
                      <input
                        type="text"
                        lang="ja"
                        value={row.ja}
                        placeholder="JA 표기"
                        aria-label="JA 표기"
                        onChange={(e) => setProductNamesJa((prev) => prev.map((x, j) => (j === i ? { ...x, ja: e.target.value } : x)))}
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        aria-label={`${row.kr || '제품명'} 표기 삭제`}
                        onClick={() => setProductNamesJa((prev) => prev.filter((_, j) => j !== i))}
                        className="flex-none text-ink-faint transition-colors hover:text-danger-text"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {productNamesJa.length === 0 && (
                    <p className="text-[12.5px] text-ink-mute">
                      아직 등록한 표기가 없습니다. 제품명을 일본어로 어떻게 쓸지 정해 두면 생성 문구가 흔들리지 않습니다.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setProductNamesJa((prev) => [...prev, { kr: '', ja: '' }])}
                  className="mt-2 text-xs font-bold text-coral-strong hover:underline"
                >
                  + 표기 쌍 추가
                </button>
              </div>

              {/* 금지 표현(BRAND-05b) */}
              <div>
                <h3 className="text-[13px] font-bold text-ink">금지 표현</h3>
                <p className="mt-1 text-[11.5px] text-ink-faint">
                  사유 없이 등록되지 않습니다(증거 원칙) — 약기법·플랫폼 규정 사유를 함께 적어 주세요.
                </p>
                <div className="mt-2.5 space-y-2">
                  {forbiddenTerms.map((row, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-8 items-center gap-1 rounded-full bg-danger-bg py-1 pr-1 pl-2.5">
                        <span aria-hidden className="text-xs font-bold text-danger-text">
                          ✕
                        </span>
                        <input
                          type="text"
                          value={row.term}
                          placeholder="금지 표현"
                          aria-label="금지 표현"
                          onChange={(e) => setForbiddenTerms((prev) => prev.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)))}
                          className="h-6 w-28 bg-transparent px-1 text-xs font-bold text-danger-text placeholder:text-danger-text/50 focus:outline-none"
                        />
                      </span>
                      <input
                        type="text"
                        value={row.reason}
                        placeholder="사유 (약기법·플랫폼 규정 등)"
                        aria-label="사유"
                        onChange={(e) => setForbiddenTerms((prev) => prev.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))}
                        className={`${inputClass} h-9 min-w-[220px] flex-1`}
                      />
                      <button
                        type="button"
                        aria-label={`${row.term || '금지 표현'} 삭제`}
                        onClick={() => setForbiddenTerms((prev) => prev.filter((_, j) => j !== i))}
                        className="flex-none text-ink-faint transition-colors hover:text-danger-text"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {forbiddenTerms.length === 0 && (
                    <p className="text-[12.5px] text-ink-mute">
                      아직 등록한 금지 표현이 없습니다. 진단 리포트의 약기법 판정에서 걸린 표현을 옮겨 두면 좋습니다.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setForbiddenTerms((prev) => [...prev, { term: '', reason: '' }])}
                  className="mt-2 text-xs font-bold text-coral-strong hover:underline"
                >
                  + 금지 표현 추가
                </button>
              </div>

              {/* 톤 가이드(BRAND-05c) */}
              <div>
                <label htmlFor="toneGuide" className={fieldLabelClass}>
                  톤 가이드 <span className="font-semibold text-ink-mute">{toneGuide.length}/300</span>
                </label>
                <textarea
                  id="toneGuide"
                  value={toneGuide}
                  onChange={(e) => setToneGuide(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="일본 고객 대상 톤 1~3문장"
                  className={textareaClass}
                />
                <p className="mt-1.5 text-[11.5px] text-ink-faint">다음 생성부터 입력으로 전달할 준비를 하고 있습니다.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* 저장 바(BRAND-06) — 화면 유일 primary */}
      <div className="fixed inset-x-0 bottom-0 left-0 z-40 border-t border-hairline bg-canvas/95 px-6 py-3.5 backdrop-blur lg:left-sidebar">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-3.5">
          <p role="status" className={`text-[12.5px] font-bold ${saveMsgClass}`}>
            {error ? `✕ ${error}` : savedMsg ? `○ ${savedMsg}` : !canSave ? '브랜드명·카테고리·포지셔닝 1개 이상이 필요합니다' : ''}
          </p>
          <button type="button" disabled={!canSave || saving} onClick={() => void handleSave()} className={buttonClass('primary', 'md', 'ml-auto')}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </main>
  );
}
