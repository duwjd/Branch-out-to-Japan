'use client';

/**
 * ① 티어 입력폼 — 기능 검증 빌드(디자인 교체 전제).
 * 정본: 01-report-spec §3(필드·게이트) · 08 §3.1(프리필 관계 — 인증 생략 단계라 프리필 없음, Tier1 직접 입력).
 * 게이트: 50자 미만 제출 잠금(하드) · 50~199자 "정밀도 제한" 안내(소프트) — 서버에서도 재검증.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CATEGORIES = [
  { value: 'skincare', label: '스킨케어 / スキンケア' },
  { value: 'makeup', label: '메이크업 / メイク' },
  { value: 'suncare', label: '선케어 / 日焼け止め' },
  { value: 'cleansing', label: '클렌징 / クレンジング' },
] as const;

const PRODUCT_CLASSES = [
  { value: '화장품', label: '화장품' },
  { value: '의약외품', label: '의약외품(医薬部外品)' },
  { value: '미상', label: '잘 모르겠음' },
] as const;

export default function ReportNewPage() {
  const router = useRouter();
  const [category, setCategory] = useState<string>('');
  const [productClass, setProductClass] = useState<string>('');
  const [sourceType, setSourceType] = useState<'text' | 'url'>('text');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [brandName, setBrandName] = useState('');
  const [productName, setProductName] = useState('');
  const [keyIngredients, setKeyIngredients] = useState('');
  const [priceJpy, setPriceJpy] = useState('');
  const [targetMemo, setTargetMemo] = useState('');
  const [reviewSourceUrl, setReviewSourceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ storeKind: string; llmMode: string } | null>(null);

  useEffect(() => {
    fetch('/api/report')
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  const charCount = useMemo(() => sourceText.replace(/\s/g, '').length, [sourceText]);
  const hardGateBlocked = sourceType === 'text' && charCount < 50;
  const softLimited = sourceType === 'text' && charCount >= 50 && charCount < 200;
  const urlInvalid = sourceType === 'url' && !/^https?:\/\//.test(sourceUrl.trim());
  const canSubmit = Boolean(category && productClass) && !(sourceType === 'text' ? hardGateBlocked : urlInvalid) && !submitting;

  /** 제출 → 요청 생성 → 진행 화면으로 이동 */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category,
          productClass,
          sourceType,
          sourceText: sourceType === 'text' ? sourceText : undefined,
          sourceUrl: sourceType === 'url' ? sourceUrl : undefined,
          brandName: brandName || undefined,
          productName: productName || undefined,
          keyIngredients: keyIngredients || undefined,
          priceJpy: priceJpy || undefined,
          targetMemo: targetMemo || undefined,
          reviewSourceUrl: reviewSourceUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출에 실패했습니다.');
      router.push(`/app/report/${data.id}`);
    } catch (err) {
      setError(String((err as Error).message));
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-[#D93636] underline">← 메인으로</Link>
      </nav>
      <h1 className="text-2xl font-bold">일본 시장 진입 진단 리포트</h1>
      <p className="mt-2 text-neutral-700">
        상세페이지 카피를 넣으면 薬機法 전수 감사·일본 문법 점수·재설계안이 담긴 리포트가 생성됩니다.
      </p>
      {meta && (
        <p className="mt-2 flex flex-wrap gap-2 text-xs">
          {meta.storeKind === 'file' && (
            <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-900">
              로컬 저장(dev) — Supabase 미연결 (docs/setup-supabase.md)
            </span>
          )}
          {meta.llmMode === 'mock' && (
            <span className="rounded bg-sky-100 px-2 py-1 font-medium text-sky-900">
              목(mock) 모드 — ANTHROPIC_API_KEY 없음 · 판정은 데모용
            </span>
          )}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {/* Tier 0 — 필수 */}
        <fieldset className="space-y-5">
          <legend className="text-lg font-semibold">필수 정보 (이것만으로 리포트가 완성됩니다)</legend>

          <div>
            <p className="mb-2 text-sm font-medium" id="category-label">카테고리 *</p>
            <div role="radiogroup" aria-labelledby="category-label" className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                    category === c.value ? 'border-[#D93636] bg-[#FFF8F8] font-semibold text-[#D93636]' : 'border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c.value}
                    checked={category === c.value}
                    onChange={() => setCategory(c.value)}
                    className="sr-only"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium" id="class-label">제품 분류 *</p>
            <div role="radiogroup" aria-labelledby="class-label" className="flex flex-wrap gap-2">
              {PRODUCT_CLASSES.map((c) => (
                <label
                  key={c.value}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                    productClass === c.value ? 'border-[#D93636] bg-[#FFF8F8] font-semibold text-[#D93636]' : 'border-neutral-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="productClass"
                    value={c.value}
                    checked={productClass === c.value}
                    onChange={() => setProductClass(c.value)}
                    className="sr-only"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            {productClass === '미상' && (
              <p className="mt-1 text-xs text-neutral-500">화장품으로 가정해 진단하고, 리포트에 &ldquo;분류 미확인&rdquo; 경고를 표기합니다.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">진단 대상 콘텐츠 *</p>
            <div className="mb-2 flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setSourceType('text')}
                aria-pressed={sourceType === 'text'}
                className={`rounded px-3 py-1 ${sourceType === 'text' ? 'bg-neutral-900 text-white' : 'border border-neutral-300'}`}
              >
                텍스트 붙여넣기 (권장)
              </button>
              <button
                type="button"
                onClick={() => setSourceType('url')}
                aria-pressed={sourceType === 'url'}
                className={`rounded px-3 py-1 ${sourceType === 'url' ? 'bg-neutral-900 text-white' : 'border border-neutral-300'}`}
              >
                URL
              </button>
            </div>
            {sourceType === 'text' ? (
              <>
                <label htmlFor="sourceText" className="sr-only">상세페이지 카피</label>
                <textarea
                  id="sourceText"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  rows={8}
                  placeholder="상세페이지의 문구를 붙여넣어 주세요. 문장 단위로 전수 감사됩니다. (이미지 위주 상세라면 이미지 속 문구를 옮겨 적어 주세요)"
                  className="w-full rounded-lg border border-neutral-300 p-3 text-sm"
                />
                <p className="mt-1 text-xs" aria-live="polite">
                  <span className={hardGateBlocked ? 'font-semibold text-[#F0483C]' : 'text-neutral-500'}>
                    {charCount}자(공백 제외)
                  </span>
                  {hardGateBlocked && ' — 최소 50자 이상 콘텐츠가 필요합니다'}
                  {softLimited && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
                      정밀도 제한 — 200자 이상이면 더 정밀해집니다
                    </span>
                  )}
                </p>
              </>
            ) : (
              <>
                <label htmlFor="sourceUrl" className="sr-only">상세페이지 URL</label>
                <input
                  id="sourceUrl"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https:// 상세페이지 주소"
                  className="w-full rounded-lg border border-neutral-300 p-3 text-sm"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  이미지 위주 상세는 텍스트가 적게 추출될 수 있습니다 — 실패 시 텍스트 붙여넣기로 안내됩니다.
                </p>
              </>
            )}
          </div>
        </fieldset>

        {/* Tier 1/2 — 선택(정밀도 게이지) */}
        <details className="rounded-xl border border-neutral-200 p-4">
          <summary className="cursor-pointer font-medium">
            선택 정보 — 넣을수록 &ldquo;우리 제품 실측형&rdquo;으로 정밀해집니다
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="brandName" className="text-sm font-medium">브랜드명</label>
              <input id="brandName" value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={60}
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
            </div>
            <div>
              <label htmlFor="productName" className="text-sm font-medium">제품명</label>
              <input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={120}
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
            </div>
            <div>
              <label htmlFor="keyIngredients" className="text-sm font-medium">핵심 성분 (쉼표 구분, 최대 8)</label>
              <input id="keyIngredients" value={keyIngredients} onChange={(e) => setKeyIngredients(e.target.value)}
                placeholder="예: 센텔라, 나이아신아마이드"
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
            </div>
            <div>
              <label htmlFor="priceJpy" className="text-sm font-medium">예상 판매가 (엔)</label>
              <input id="priceJpy" type="number" min={0} value={priceJpy} onChange={(e) => setPriceJpy(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="targetMemo" className="text-sm font-medium">타깃/고민 메모</label>
              <textarea id="targetMemo" value={targetMemo} onChange={(e) => setTargetMemo(e.target.value)} rows={2} maxLength={500}
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="reviewSourceUrl" className="text-sm font-medium">리뷰 페이지 URL (楽天/Qoo10/@cosme)</label>
              <input id="reviewSourceUrl" type="url" value={reviewSourceUrl} onChange={(e) => setReviewSourceUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
              <p className="mt-1 text-xs text-neutral-500">
                이번 버전은 카테고리 일반형으로 분석합니다 — URL 기반 실측 리뷰 분석은 v2에서 열립니다.
              </p>
            </div>
          </div>
        </details>

        {error && (
          <p role="alert" className="rounded-lg border border-[#F0483C] bg-red-50 p-3 text-sm text-[#B3271D]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full rounded-lg px-6 py-3 text-lg font-bold text-white ${
            canSubmit ? 'bg-[#FF6464] hover:bg-[#D93636]' : 'cursor-not-allowed bg-neutral-300'
          }`}
        >
          {submitting ? '제출 중…' : '진단 리포트 생성'}
        </button>
        {!category || !productClass ? (
          <p className="text-center text-xs text-neutral-500">카테고리와 제품 분류를 선택하면 진단할 수 있어요.</p>
        ) : hardGateBlocked ? (
          <p className="text-center text-xs text-neutral-500">콘텐츠 50자 이상이면 버튼이 활성화됩니다.</p>
        ) : null}
      </form>
    </main>
  );
}
