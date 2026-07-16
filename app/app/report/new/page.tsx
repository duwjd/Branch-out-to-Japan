'use client';

/**
 * ① 진단 입력폼 — 브랜드 우선 2단 구조(스펙 §3 v4 · 기능 검증 빌드, 디자인 교체 전제).
 * 브랜드 섹션(필수: 브랜드명·포지셔닝·카테고리)이 전면, 제품 섹션(분류·제품명·성분·가격·상세페이지 콘텐츠)은 접힌 선택.
 * 게이트: 제출된 콘텐츠에만 50자 하드/200자 소프트 발동(gates.ts 단일 정의) — 서버에서도 재검증.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HARD_GATE_CHARS, SOFT_LINE_CHARS, contentCharCount, isValidHttpUrl } from '@/lib/engine/rules/gates';
import {
  POSITIONING_NOTE_MAX,
  POSITIONING_TAGS,
  POSITIONING_TAGS_MAX,
  POSITIONING_TAGS_MIN,
} from '@/lib/engine/rules/positioning';

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

/** 칩(라디오·체크 공용) 스타일 — 선택 시 코랄 강조 */
function chipClass(on: boolean): string {
  return `cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
    on ? 'border-[#D93636] bg-[#FFF8F8] font-semibold text-[#D93636]' : 'border-neutral-300'
  }`;
}

export default function ReportNewPage() {
  const router = useRouter();
  // 브랜드 섹션 (필수 3종 + 선택 1)
  const [brandName, setBrandName] = useState('');
  const [positioningTags, setPositioningTags] = useState<string[]>([]);
  const [positioningNote, setPositioningNote] = useState('');
  const [category, setCategory] = useState<string>('');
  const [targetMemo, setTargetMemo] = useState('');
  // 제품 섹션 (전부 선택)
  const [productClass, setProductClass] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [keyIngredients, setKeyIngredients] = useState('');
  const [priceJpy, setPriceJpy] = useState('');
  const [sourceType, setSourceType] = useState<'text' | 'url'>('text');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ storeKind: string; llmMode: string } | null>(null);

  useEffect(() => {
    fetch('/api/report')
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  /** 포지셔닝 칩 토글 — 최대 개수를 넘기면 무시 */
  function toggleTag(value: string) {
    setPositioningTags((prev) =>
      prev.includes(value)
        ? prev.filter((t) => t !== value)
        : prev.length >= POSITIONING_TAGS_MAX
          ? prev
          : [...prev, value],
    );
  }

  const brandReady = Boolean(brandName.trim() && positioningTags.length >= POSITIONING_TAGS_MIN && category);
  const charCount = useMemo(() => contentCharCount(sourceText), [sourceText]);
  // 콘텐츠는 선택(§3.3) — 비우면 브랜드 진단. 게이트는 "넣다 만" 입력에만 발동한다
  const contentProvided = sourceType === 'text' ? charCount > 0 : sourceUrl.trim().length > 0;
  const hardGateBlocked = sourceType === 'text' && charCount > 0 && charCount < HARD_GATE_CHARS;
  const softLimited = sourceType === 'text' && charCount >= HARD_GATE_CHARS && charCount < SOFT_LINE_CHARS;
  const urlInvalid = sourceType === 'url' && sourceUrl.trim().length > 0 && !isValidHttpUrl(sourceUrl);
  const contentOk = !hardGateBlocked && !urlInvalid;
  const canSubmit = brandReady && contentOk && !submitting;

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
          brandName,
          positioning: { tags: positioningTags, note: positioningNote },
          category,
          targetMemo: targetMemo || undefined,
          productClass: productClass || undefined,
          productName: productName || undefined,
          keyIngredients: keyIngredients || undefined,
          priceJpy: priceJpy || undefined,
          sourceType,
          sourceText: sourceType === 'text' ? sourceText : undefined,
          sourceUrl: sourceType === 'url' ? sourceUrl : undefined,
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
        브랜드가 무엇을 지향하는지 알려주시면 일본 고객 관점의 페르소나·USP 재설계가 생성됩니다.
        상세페이지 카피까지 넣으면 薬機法 전수 감사·일본 문법 점수·재작성이 열립니다.
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
        {/* 브랜드 — 필수 (스펙 §3.1) */}
        <fieldset className="space-y-5">
          <legend className="text-lg font-semibold">브랜드 (필수)</legend>

          <div>
            <label htmlFor="brandName" className="text-sm font-medium">브랜드명 *</label>
            <input
              id="brandName"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              maxLength={60}
              placeholder="예: HARUON"
              className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 text-sm"
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium" id="positioning-label">
              브랜드 포지셔닝 * <span className="font-normal text-neutral-500">— 1~{POSITIONING_TAGS_MAX}개 선택</span>
            </p>
            <p className="mb-2 text-xs text-neutral-500">
              브랜드가 지향하는 것을 고르세요. 일본 고객 페르소나·USP 재정의의 근거가 됩니다.
            </p>
            <div role="group" aria-labelledby="positioning-label" className="flex flex-wrap gap-2">
              {POSITIONING_TAGS.map((t) => {
                const on = positioningTags.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTag(t.value)}
                    className={chipClass(on)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <label htmlFor="positioningNote" className="mt-3 block text-sm font-medium">
              한 줄 소개 <span className="font-normal text-neutral-500">(선택)</span>
            </label>
            <textarea
              id="positioningNote"
              value={positioningNote}
              onChange={(e) => setPositioningNote(e.target.value)}
              rows={2}
              maxLength={POSITIONING_NOTE_MAX}
              placeholder="예: 민감성 피부를 위한 저자극 시카 스킨케어 — 피부과 테스트를 마친 성분만 씁니다"
              className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 text-sm"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium" id="category-label">카테고리 *</p>
            <div role="radiogroup" aria-labelledby="category-label" className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <label key={c.value} className={chipClass(category === c.value)}>
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
            <label htmlFor="targetMemo" className="text-sm font-medium">
              타깃/고민 메모 <span className="font-normal text-neutral-500">(선택)</span>
            </label>
            <textarea
              id="targetMemo"
              value={targetMemo}
              onChange={(e) => setTargetMemo(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="예: 민감성 피부, 20~30대"
              className="mt-1 w-full rounded-lg border border-neutral-300 p-2.5 text-sm"
            />
          </div>
        </fieldset>

        {/* 제품 — 선택 (스펙 §3.2) · 콘텐츠를 넣으면 감사·점수·재작성이 열린다 */}
        <details className="rounded-xl border border-neutral-200 p-4" open>
          <summary className="cursor-pointer font-medium">
            제품 정보 (선택) — 상세페이지 카피를 넣으면 薬機法 전수 감사·문법 점수·재작성이 열립니다
          </summary>
          <div className="mt-4 space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium" id="class-label">제품 분류</p>
              <div role="radiogroup" aria-labelledby="class-label" className="flex flex-wrap gap-2">
                {PRODUCT_CLASSES.map((c) => (
                  <label key={c.value} className={chipClass(productClass === c.value)}>
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
                <p className="mt-1 text-xs text-neutral-500">
                  콘텐츠 감사 시 화장품으로 가정해 진단하고, 리포트에 &ldquo;분류 미확인&rdquo; 경고를 표기합니다.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="productName" className="text-sm font-medium">제품명</label>
                <input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={120}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
              </div>
              <div>
                <label htmlFor="priceJpy" className="text-sm font-medium">예상 판매가 (엔)</label>
                <input id="priceJpy" type="number" min={0} value={priceJpy} onChange={(e) => setPriceJpy(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="keyIngredients" className="text-sm font-medium">핵심 성분 (쉼표 구분, 최대 8)</label>
                <input id="keyIngredients" value={keyIngredients} onChange={(e) => setKeyIngredients(e.target.value)}
                  placeholder="예: 센텔라, 나이아신아마이드"
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm" />
                <p className="mt-1 text-xs text-neutral-500">상세페이지 콘텐츠와 함께 제출될 때 루브릭 채점에 반영됩니다.</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">진단 대상 콘텐츠 (상세페이지 카피)</p>
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
        {!brandReady ? (
          <p className="text-center text-xs text-neutral-500">브랜드명·포지셔닝·카테고리를 채우면 진단할 수 있어요.</p>
        ) : hardGateBlocked ? (
          <p className="text-center text-xs text-neutral-500">
            콘텐츠는 50자 이상이어야 합니다 — 비우고 제출하면 브랜드 진단으로 생성됩니다.
          </p>
        ) : urlInvalid ? (
          <p className="text-center text-xs text-neutral-500">
            http(s)로 시작하는 URL을 입력해 주세요 — 비우고 제출하면 브랜드 진단으로 생성됩니다.
          </p>
        ) : !contentProvided ? (
          <p className="text-center text-xs text-neutral-500">
            지금 제출하면 <strong>브랜드 진단</strong>(페르소나·USP·벤치마크)으로 생성됩니다 — 상세페이지 카피를 넣으면
            약기법 감사·문법 점수까지 포함됩니다.
          </p>
        ) : null}
      </form>
    </main>
  );
}
