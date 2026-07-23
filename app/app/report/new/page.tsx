'use client';

/**
 * ① 진단 입력폼 — 브랜드 우선 2단 구조(스펙 §3 v4). 디자인 정본: docs/specs/01-report/1-input.html.
 * 브랜드 섹션(필수: 브랜드명·포지셔닝·카테고리)이 전면, 제품 섹션(분류·제품명·성분·가격·상세페이지 콘텐츠)이 뒤따른다.
 * 게이트: 제출된 콘텐츠에만 50자 하드/200자 소프트 발동(gates.ts 단일 정의) — 서버에서도 재검증.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HARD_GATE_CHARS, SOFT_LINE_CHARS, contentCharCount } from '@/lib/engine/rules/gates';
import {
  POSITIONING_NOTE_MAX,
  POSITIONING_TAGS,
  POSITIONING_TAGS_MAX,
  POSITIONING_TAGS_MIN,
} from '@/lib/engine/rules/positioning';
import { SectionCard, StatusBadge, buttonClass, chipClass, fieldLabelClass, inputClass, textareaClass } from '@/components/ui/primitives';

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

/** 라디오형 칩(카테고리·제품 분류 공용) — role="radio" 버튼 */
function RadioChip({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} onClick={onSelect} className={chipClass(checked)}>
      {label}
    </button>
  );
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
  // v7: 이미지 업로드(기본) + 텍스트(보조). URL 제거
  const [sourceType, setSourceType] = useState<'image' | 'text'>('image');
  const [sourceText, setSourceText] = useState('');
  const [sourceImages, setSourceImages] = useState<{ key: string; file: File; url: string; lowRes: boolean }[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ storeKind: string; llmMode: string } | null>(null);
  // 브랜드 프로필에서 이어받은 필드가 있으면 캡션 노출(온보딩 도입 · INPUT-02·05)
  const [prefilled, setPrefilled] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const imgKeyRef = useRef(0);

  useEffect(() => {
    fetch('/api/report')
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  /**
   * 브랜드 프로필로 브랜드 필드 프리필(INPUT-02·05).
   * force=false(진입): 사용자가 먼저 입력했으면 덮지 않는다.
   * force=true(브랜드 전환 MAIN-01b″): 브랜드 종속 필드(브랜드명·카테고리·포지셔닝·한줄소개·타깃)를
   *   새 브랜드로 교체한다. 제품 콘텐츠(브랜드 무관)는 이 함수가 건드리지 않아 유지된다.
   */
  const loadBrandPrefill = useCallback((force: boolean) => {
    fetch('/api/brand')
      .then((res) => res.json())
      .then((data) => {
        const p = data?.profile;
        if (!p) {
          if (force) {
            setBrandName('');
            setCategory('');
            setPositioningTags([]);
            setPositioningNote('');
            setTargetMemo('');
            setPrefilled(false);
          }
          return;
        }
        if (force) {
          setBrandName(p.brandName || '');
          setCategory(p.category || '');
          setPositioningTags(Array.isArray(p.positioningTags) ? p.positioningTags : []);
          setPositioningNote('');
          setTargetMemo('');
        } else {
          setBrandName((prev) => prev || p.brandName || '');
          setCategory((prev) => prev || p.category || '');
          setPositioningTags((prev) => (prev.length ? prev : Array.isArray(p.positioningTags) ? p.positioningTags : []));
        }
        setPrefilled(Boolean(p.brandName));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBrandPrefill(false);
    // 브랜드 전환 시 브랜드 종속 필드만 새 브랜드로 교체(MAIN-01b″)
    const onSwitch = () => loadBrandPrefill(true);
    window.addEventListener('kglow:brand-switched', onSwitch);
    return () => window.removeEventListener('kglow:brand-switched', onSwitch);
  }, [loadBrandPrefill]);

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

  /** 상세페이지 이미지 채택(INPUT-03 3e) — 형식·용량·장수 검증 + 512px 저해상 경고(차단 X) */
  function addImages(list: FileList) {
    setImageError(null);
    const room = 10 - sourceImages.length;
    const accepted: { key: string; file: File; url: string; lowRes: boolean }[] = [];
    for (const f of Array.from(list)) {
      if (accepted.length >= room) {
        setImageError('최대 10장까지 올릴 수 있어요.');
        break;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        setImageError('JPG·PNG·WebP 파일만 올릴 수 있어요.');
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setImageError('장당 10MB 이하로 올려 주세요.');
        continue;
      }
      const url = URL.createObjectURL(f);
      const item = { key: `si-${imgKeyRef.current++}`, file: f, url, lowRes: false };
      accepted.push(item);
      // 512px 저해상 검사(비동기 · 경고 배지만)
      const probe = new window.Image();
      probe.onload = () => {
        if (probe.naturalWidth < 512 || probe.naturalHeight < 512) {
          setSourceImages((prev) => prev.map((p) => (p.key === item.key ? { ...p, lowRes: true } : p)));
        }
      };
      probe.src = url;
    }
    if (accepted.length) setSourceImages((prev) => [...prev, ...accepted]);
  }

  function removeImage(key: string) {
    setSourceImages((prev) => {
      const t = prev.find((p) => p.key === key);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((p) => p.key !== key);
    });
  }

  /** 순서 이동(위→아래 = 상세페이지 순서) */
  function moveImage(idx: number, dir: -1 | 1) {
    setSourceImages((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  const brandReady = Boolean(brandName.trim() && positioningTags.length >= POSITIONING_TAGS_MIN && category);
  const charCount = useMemo(() => contentCharCount(sourceText), [sourceText]);
  // 콘텐츠는 선택(§3.3) — 비우면 브랜드 진단. 게이트는 "넣다 만" 입력에만 발동한다
  const contentProvided = sourceType === 'image' ? sourceImages.length > 0 : charCount > 0;
  const hardGateBlocked = sourceType === 'text' && charCount > 0 && charCount < HARD_GATE_CHARS;
  const softLimited = sourceType === 'text' && charCount >= HARD_GATE_CHARS && charCount < SOFT_LINE_CHARS;
  const fullPrecision = sourceType === 'text' && charCount >= SOFT_LINE_CHARS;
  // 이미지 모드는 폼에서 글자수 게이트 발동 X — 추출 후 파이프라인에서 판정(PROCESS-02)
  const contentOk = !hardGateBlocked;
  const canSubmit = brandReady && contentOk && !submitting;

  /** 제출 → 요청 생성 → 진행 화면으로 이동 */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // v7: 이미지 업로드가 기본이라 multipart FormData로 전송(브라우저가 content-type 자동 설정)
      const form = new FormData();
      form.set('brandName', brandName);
      form.set('positioningTags', JSON.stringify(positioningTags));
      form.set('positioningNote', positioningNote);
      form.set('category', category);
      form.set('targetMemo', targetMemo);
      form.set('productClass', productClass);
      form.set('productName', productName);
      form.set('keyIngredients', keyIngredients);
      form.set('priceJpy', priceJpy);
      form.set('sourceType', sourceType);
      if (sourceType === 'text') form.set('sourceText', sourceText);
      if (sourceType === 'image') sourceImages.forEach((im) => form.append('images', im.file));
      const res = await fetch('/api/report', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출에 실패했습니다.');
      router.push(`/app/report/${data.id}`);
    } catch (err) {
      setError(String((err as Error).message));
      setSubmitting(false);
    }
  }

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[768px] px-6 pt-14 pb-24">
        <p className="text-xs font-extrabold tracking-wide text-coral-strong">KGLOW 진단 리포트</p>
        <h1 className="mt-2.5 text-[30px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
          일본 시장 진입 진단 리포트
        </h1>
        <p className="mt-3.5 text-[15px] leading-[1.7] text-ink-body [text-wrap:pretty]">
          브랜드가 무엇을 지향하는지 알려주시면 일본 고객 관점의 페르소나·USP 재설계가 생성됩니다. 상세페이지 카피까지
          넣으면 <span lang="ja">薬機法</span> 전수 감사·일본 문법 점수·재작성이 열립니다.
        </p>
        {meta && (meta.storeKind === 'file' || meta.llmMode === 'mock') && (
          <p className="mt-3 flex flex-wrap gap-1.5">
            {meta.storeKind === 'file' && <StatusBadge tone="off">로컬 저장(dev) — Supabase 미연결</StatusBadge>}
            {meta.llmMode === 'mock' && <StatusBadge tone="off">목(mock) 모드 — 판정은 데모용</StatusBadge>}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-9 space-y-5">
          {/* 브랜드 — 필수 */}
          <SectionCard title="브랜드" pill="필수" pillTone="required">
            {prefilled && (
              <p className="mb-5 rounded-[8px] bg-coral-tint px-3 py-2.5 text-[12.5px] leading-relaxed text-coral-strong">
                브랜드 관리에서 이어받았어요. 필요하면 바꿔도 됩니다.
              </p>
            )}
            <div>
              <label htmlFor="brandName" className={fieldLabelClass}>
                브랜드명 <span className="text-coral-strong">*</span>
              </label>
              <input
                id="brandName"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                maxLength={60}
                placeholder="예: HARUON"
                className={inputClass}
              />
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap items-baseline gap-2">
                <span id="positioning-label" className="text-[13.5px] font-semibold text-ink">
                  브랜드 포지셔닝 <span className="text-coral-strong">*</span>{' '}
                  <span className="font-normal text-ink-mute">— 1~{POSITIONING_TAGS_MAX}개 선택</span>
                </span>
                <span className="ml-auto text-[12.5px] text-ink-mute">
                  <b className="tnum text-ink">{positioningTags.length}</b> / {POSITIONING_TAGS_MAX} 선택
                </span>
              </div>
              <p className="mt-1.5 mb-3 text-[13px] leading-relaxed text-ink-mute">
                브랜드가 지향하는 것을 고르세요. 일본 고객 페르소나·USP 재정의의 근거가 됩니다.
              </p>
              <div role="group" aria-labelledby="positioning-label" className="flex flex-wrap gap-2">
                {POSITIONING_TAGS.map((t) => {
                  const on = positioningTags.includes(t.value);
                  return (
                    <button key={t.value} type="button" aria-pressed={on} onClick={() => toggleTag(t.value)} className={chipClass(on)}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4">
                <label htmlFor="positioningNote" className={fieldLabelClass}>
                  한 줄 소개 <span className="font-normal text-ink-mute">(선택)</span>
                </label>
                <textarea
                  id="positioningNote"
                  value={positioningNote}
                  onChange={(e) => setPositioningNote(e.target.value)}
                  rows={2}
                  maxLength={POSITIONING_NOTE_MAX}
                  placeholder="예: 민감성 피부를 위한 저자극 시카 스킨케어 — 피부과 테스트를 마친 성분만 씁니다"
                  className={textareaClass}
                />
              </div>
            </div>

            <div className="mt-6">
              <span id="category-label" className={fieldLabelClass}>
                카테고리 <span className="text-coral-strong">*</span>
              </span>
              <div role="radiogroup" aria-labelledby="category-label" className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <RadioChip key={c.value} label={c.label} checked={category === c.value} onSelect={() => setCategory(c.value)} />
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="targetMemo" className={fieldLabelClass}>
                타깃/고민 메모 <span className="font-normal text-ink-mute">(선택)</span>
              </label>
              <textarea
                id="targetMemo"
                value={targetMemo}
                onChange={(e) => setTargetMemo(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="예: 민감성 피부, 20~30대"
                className={textareaClass}
              />
            </div>
          </SectionCard>

          {/* 제품 정보 — 선택 */}
          <SectionCard
            title="제품 정보"
            pill="선택"
            pillTone="optional"
            desc={
              <>
                상세페이지 카피를 넣으면 <span lang="ja">薬機法</span> 전수 감사·문법 점수·재작성이 열립니다. 비우고
                제출하면 브랜드 진단으로 생성됩니다.
              </>
            }
          >
            <div>
              <span id="class-label" className={fieldLabelClass}>제품 분류</span>
              <div role="radiogroup" aria-labelledby="class-label" className="flex flex-wrap gap-2">
                {PRODUCT_CLASSES.map((c) => (
                  <RadioChip key={c.value} label={c.label} checked={productClass === c.value} onSelect={() => setProductClass(c.value)} />
                ))}
              </div>
              {productClass === '미상' && (
                <p className="mt-2.5 rounded-[8px] bg-amber-bg p-2.5 text-[12.5px] leading-relaxed text-amber-text">
                  콘텐츠 감사 시 화장품으로 가정해 진단하고, 리포트에 &ldquo;분류 미확인&rdquo; 경고를 표기합니다.
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="productName" className={fieldLabelClass}>제품명</label>
                <input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={120}
                  placeholder="예: CICA 진정 앰플" className={inputClass} />
              </div>
              <div>
                <label htmlFor="priceJpy" className={fieldLabelClass}>예상 판매가 (엔)</label>
                <input id="priceJpy" type="number" min={0} value={priceJpy} onChange={(e) => setPriceJpy(e.target.value)}
                  placeholder="2980" className={inputClass} />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="keyIngredients" className={fieldLabelClass}>
                핵심 성분 <span className="font-normal text-ink-mute">(쉼표 구분 · 최대 8개)</span>
              </label>
              <input id="keyIngredients" value={keyIngredients} onChange={(e) => setKeyIngredients(e.target.value)}
                placeholder="예: 센텔라, 나이아신아마이드" className={inputClass} />
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">
                상세페이지 콘텐츠와 함께 제출될 때 루브릭 채점에 반영됩니다.
              </p>
            </div>

            <div className="mt-7">
              <span className={fieldLabelClass}>
                진단 대상 콘텐츠 <span className="font-normal text-ink-mute">(상세페이지 카피)</span>
              </span>
              <div className="inline-flex gap-0.5 rounded-[10px] bg-n-100 p-1">
                <button
                  type="button"
                  aria-pressed={sourceType === 'image'}
                  onClick={() => setSourceType('image')}
                  className={`h-[34px] rounded-lg px-4 text-[13.5px] transition-colors ${
                    sourceType === 'image' ? 'bg-canvas font-bold text-ink shadow-card' : 'bg-transparent font-medium text-ink-mute'
                  }`}
                >
                  이미지 업로드 (권장)
                </button>
                <button
                  type="button"
                  aria-pressed={sourceType === 'text'}
                  onClick={() => setSourceType('text')}
                  className={`h-[34px] rounded-lg px-4 text-[13.5px] transition-colors ${
                    sourceType === 'text' ? 'bg-canvas font-bold text-ink shadow-card' : 'bg-transparent font-medium text-ink-mute'
                  }`}
                >
                  텍스트 붙여넣기
                </button>
              </div>

              {sourceType === 'image' ? (
                <div className="mt-3">
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files) addImages(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  {sourceImages.length === 0 ? (
                    <button
                      type="button"
                      aria-label="상세페이지 이미지 업로드"
                      onClick={() => imgInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files) addImages(e.dataTransfer.files);
                      }}
                      className="flex min-h-[150px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-input-border bg-n-50 p-6 text-center transition-colors hover:border-coral hover:bg-coral-tint"
                    >
                      <span className="text-[14px] font-semibold text-ink-body">
                        상세페이지 캡처를 끌어다 놓거나 <span className="text-coral-strong">클릭해서 선택</span>
                      </span>
                      <span className="text-[12px] text-ink-mute">JPG · PNG · WebP / 장당 10MB / 1~10장 · 위에서부터 순서대로</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {sourceImages.map((im, i) => (
                        <div key={im.key} className="relative w-[92px]">
                          <span className="block h-[92px] w-[92px] overflow-hidden rounded-[10px] border border-input-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={im.url} alt={`상세페이지 이미지 ${i + 1}`} className="h-full w-full object-cover" />
                          </span>
                          <span className="absolute top-1 left-1 rounded-[5px] bg-[rgba(16,18,20,.62)] px-1.5 text-[9px] font-bold text-white">{i + 1}</span>
                          {im.lowRes && (
                            <span className="absolute bottom-1 left-1 rounded-[5px] bg-amber-bg px-1 text-[8.5px] font-bold text-amber-text">△ 저해상</span>
                          )}
                          <button
                            type="button"
                            aria-label={`이미지 ${i + 1} 삭제`}
                            onClick={() => removeImage(im.key)}
                            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white"
                          >
                            ✕
                          </button>
                          <div className="mt-1 flex justify-center gap-1">
                            <button type="button" aria-label="앞으로" disabled={i === 0} onClick={() => moveImage(i, -1)} className="text-[13px] text-ink-mute disabled:opacity-30">◀</button>
                            <button type="button" aria-label="뒤로" disabled={i === sourceImages.length - 1} onClick={() => moveImage(i, 1)} className="text-[13px] text-ink-mute disabled:opacity-30">▶</button>
                          </div>
                        </div>
                      ))}
                      {sourceImages.length < 10 && (
                        <button
                          type="button"
                          onClick={() => imgInputRef.current?.click()}
                          className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-input-border text-[11px] font-semibold text-ink-mute hover:border-coral hover:text-coral-strong"
                        >
                          ＋<span className="text-[9px]">추가</span>
                        </button>
                      )}
                    </div>
                  )}
                  {imageError && <p className="mt-2 text-[12.5px] font-semibold text-danger-text">{imageError}</p>}
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-mute">
                    상세페이지를 위에서부터 순서대로 캡처해 올려 주세요. 글자가 보이면 충분해요. 이미지에서 문구를 읽어 진단합니다.
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <label htmlFor="sourceText" className="sr-only">상세페이지 카피</label>
                  <textarea
                    id="sourceText"
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    rows={7}
                    placeholder="상세페이지의 문구를 붙여넣어 주세요. 문장 단위로 전수 감사됩니다. (이미지 위주 상세라면 이미지 속 문구를 옮겨 적어 주세요)"
                    className={`${textareaClass} min-h-[150px] ${hardGateBlocked ? 'border-danger' : ''}`}
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5" aria-live="polite">
                    <span className={`text-[12.5px] font-semibold ${hardGateBlocked ? 'text-danger-text' : 'font-medium text-ink-mute'}`}>
                      {charCount}자(공백 제외)
                    </span>
                    {hardGateBlocked && (
                      <span className="inline-flex h-6 items-center rounded-[6px] bg-danger-bg px-2.5 text-xs font-semibold whitespace-nowrap text-danger-text">
                        ✕ 최소 50자 이상 콘텐츠가 필요합니다
                      </span>
                    )}
                    {softLimited && (
                      <span className="inline-flex h-6 items-center rounded-[6px] bg-amber-bg px-2.5 text-xs font-semibold whitespace-nowrap text-amber-text">
                        △ 정밀도 제한 — 200자 이상이면 더 정밀해집니다
                      </span>
                    )}
                    {fullPrecision && (
                      <span className="inline-flex h-6 items-center rounded-[6px] bg-green-bg px-2.5 text-xs font-semibold whitespace-nowrap text-green-text">
                        ○ 브랜드+제품 진단 — 리포트 전체 산출
                      </span>
                    )}
                    {charCount === 0 && <span className="text-xs font-medium text-ink-mute">브랜드 진단으로 진행</span>}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {error && (
            <p role="alert" className="rounded-[10px] border border-danger bg-danger-bg p-3 text-[13px] text-danger-text">
              {error}
            </p>
          )}

          <div>
            <button type="submit" disabled={!canSubmit} className={buttonClass('primary', 'lg', 'w-full')}>
              {submitting ? '제출 중…' : '진단 리포트 생성'}
            </button>
            {!brandReady ? (
              <p className="mt-3 text-center text-[13px] leading-relaxed text-ink-mute">
                브랜드명·포지셔닝·카테고리를 채우면 진단할 수 있어요.
              </p>
            ) : hardGateBlocked ? (
              <p className="mt-3 text-center text-[13px] leading-relaxed text-ink-mute">
                콘텐츠는 50자 이상이어야 합니다 — 비우고 제출하면 브랜드 진단으로 생성됩니다.
              </p>
            ) : sourceType === 'image' && sourceImages.length > 0 ? (
              <p className="mt-3 text-center text-[13px] leading-relaxed text-ink-mute">
                이미지 {sourceImages.length}장에서 문구를 읽어 진단합니다 — 글자를 읽지 못하면 텍스트 붙여넣기로 안내해 드려요.
              </p>
            ) : !contentProvided ? (
              <p className="mt-3 text-center text-[13px] leading-relaxed text-ink-mute">
                지금 제출하면 <strong className="font-semibold text-ink">브랜드 진단</strong>(페르소나·USP·벤치마크)으로
                생성됩니다 — 상세페이지 카피를 넣으면 약기법 감사·문법 점수까지 포함됩니다.
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
}
