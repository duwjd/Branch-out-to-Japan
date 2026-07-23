'use client';

/**
 * 생성 퍼널 폼(HOME-02~08) — 원본 업로드·플랫폼·템플릿·실적을 한 화면에서 받아 제출한다.
 * 클라이언트 검증은 서버(POST /api/studio/thumbnail)와 동일 규칙 이중 적용.
 * 디자인 정본: docs/specs/02-studio/1-home.html
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PLATFORMS, PLATFORM_LABELS, STUDIO_STAGE_LABELS, type Platform } from '@/lib/studio/platform';
import { ThumbPreview } from '@/components/app/AssetPreview';
import {
  SectionCard,
  StatusBadge,
  buttonClass,
  cardClass,
  chipClass,
  fieldLabelClass,
  inputClass,
} from '@/components/ui/primitives';
import { IconChevronDown, IconChevronUp, IconUpload } from '@/components/ui/icons';

interface StyleCard {
  id: string;
  slug: string;
  nameKo: string;
  description: string;
  platformFit: string[];
  needsProof: boolean;
  needsModel: boolean;
  needsPromo: boolean;
  previewSrc: string;
}

interface RecentAsset {
  id: string;
  status: 'generating' | 'done' | 'failed';
  stage: string | null;
  styleName: string;
  platform: string;
  createdAt: string;
  imageUrl: string | null;
  originalUrl: string;
}

interface StudioMeta {
  storeKind: 'supabase' | 'file';
  llmMode: 'real' | 'mock';
  imageMode: 'real' | 'mock';
  recent: RecentAsset[];
}

const FIT_LABELS: Record<string, string> = {
  'amazon-jp': '아마존JP',
  rakuten: '라쿠텐',
  qoo10: 'Qoo10',
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function StudioForm({ styles, byPlatform }: { styles: StyleCard[]; byPlatform: Record<string, string[]> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unset');
  const [styleId, setStyleId] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [proof, setProof] = useState({ rankTitle: '', genre: '', aggregationDate: '' });
  // F 모델컷(HOME-02b) — 브랜드 종속. G 프로모 입력(HOME-05b) — 브랜드 무관
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelPreviewUrl, setModelPreviewUrl] = useState<string | null>(null);
  const [modelFileError, setModelFileError] = useState<string | null>(null);
  const [modelConsent, setModelConsent] = useState(false);
  const [promo, setPromo] = useState({
    setTitle: '',
    salePrice: '',
    normalPrice: '',
    normalPriceVerified: false,
    discountRate: '',
    gift: '',
    qualifiers: '',
    footnote: '',
  });
  // 제품컷 소스(HOME-02) — 직접 업로드 | 브랜드 자산 피커. 브랜드 종속
  const [sourceTab, setSourceTab] = useState<'upload' | 'brand'>('upload');
  const [products, setProducts] = useState<{ id: string; nameKr: string; images: { fileId: string; isPrimary: boolean }[] }[]>([]);
  const [pickedFileId, setPickedFileId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [meta, setMeta] = useState<StudioMeta | null>(null);

  /** 파일 채택 — 포맷·용량 검증(HOME-02c) 후 미리보기 치환 */
  const acceptFile = useCallback((f: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setFileError('JPG·PNG·WebP만 업로드할 수 있습니다');
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setFileError('10MB 이하 이미지만 업로드할 수 있습니다');
      return;
    }
    setFileError(null);
    setPickedFileId(null); // 직접 업로드 = 피커 선택 해제
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, []);

  /** 브랜드 제품 자산 로드(HOME-02 피커) — 등록 제품 있으면 기본 탭을 '브랜드 자산'으로 */
  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.products ?? [];
      setProducts(list);
      setSourceTab((prev) => (prev === 'upload' && list.length > 0 ? 'brand' : prev));
    } catch {
      /* 피커는 보조 — 실패를 화면 오류로 승격하지 않는다 */
    }
  }, []);

  /** 모델컷 채택(HOME-02b) — 제품컷과 동일 규칙 */
  const acceptModelFile = useCallback((f: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setModelFileError('JPG·PNG·WebP만 업로드할 수 있습니다');
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setModelFileError('10MB 이하 이미지만 업로드할 수 있습니다');
      return;
    }
    setModelFileError(null);
    setModelFile(f);
    setModelPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, []);

  /** URL 이미지를 File로 가져온다 — 프리필(RESULT-05·06) 전용 */
  const loadFromUrl = useCallback(
    async (url: string, name: string) => {
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      acceptFile(new File([blob], name, { type: blob.type }));
    },
    [acceptFile],
  );

  /** 브랜드 자산 피커에서 제품컷 선택(HOME-02) — 이미지를 File로 채택하고 선택 표시 유지 */
  async function pickBrandImage(fileId: string, name: string) {
    await loadFromUrl(`/api/files/${fileId}`, `${name || 'product'}.png`);
    setPickedFileId(fileId); // acceptFile이 해제한 선택을 다시 세운다(피커 선택 유지)
  }

  // 프리필 진입(HOME-00) — ?from={assetId}(원본), ?style={id}(실패 재시도 시 템플릿까지)
  useEffect(() => {
    const from = searchParams.get('from');
    const style = searchParams.get('style');
    if (style && styles.some((s) => s.id === style)) setStyleId(style);
    if (from) {
      void (async () => {
        const res = await fetch(`/api/studio/thumbnail/${from}`);
        if (!res.ok) return;
        const asset = await res.json();
        if (asset.originalUrl) await loadFromUrl(asset.originalUrl, 'original.png');
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 브랜드 전환 시 제품컷(브랜드 종속) 초기화 — 플랫폼·템플릿·실적은 유지(MAIN-01b″)
  useEffect(() => {
    const onSwitch = () => {
      setFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setFileError(null);
      // 모델컷도 브랜드 종속 — 초기화(프로모·실적·플랫폼·템플릿은 유지)
      setModelFile(null);
      setModelPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setModelConsent(false);
      setModelFileError(null);
      // 제품 자산은 브랜드별 — 새 브랜드 것으로 다시 불러오고 선택 해제
      setPickedFileId(null);
      void loadProducts();
    };
    window.addEventListener('kglow:brand-switched', onSwitch);
    return () => window.removeEventListener('kglow:brand-switched', onSwitch);
  }, [loadProducts]);

  // 진입 시 브랜드 제품 자산 로드(HOME-02 피커 소스)
  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // 실행 모드 메타 + 최근 생성 스트립(HOME-07) — 생성중이 있으면 2.5초 폴링
  const pollMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/thumbnail', { cache: 'no-store' });
      if (res.ok) setMeta(await res.json());
    } catch {
      /* 스트립은 보조 표면 — 로드 실패를 화면 오류로 승격하지 않는다 */
    }
  }, []);

  useEffect(() => {
    void pollMeta();
  }, [pollMeta]);

  useEffect(() => {
    if (!meta?.recent.some((r) => r.status === 'generating')) return;
    const timer = setInterval(() => void pollMeta(), 2500);
    return () => clearInterval(timer);
  }, [meta, pollMeta]);

  const selected = styles.find((s) => s.id === styleId) ?? null;
  const proofComplete = Boolean(proof.rankTitle.trim() && proof.genre.trim() && proof.aggregationDate.trim());
  const recommended = platform === 'unset' ? [] : (byPlatform[platform] ?? []);

  // 제출 활성 조건(HOME-06b) + 안내 우선순위(HOME-06c)
  let guidance = '약 1~2분 걸립니다. 결과 화면에서 완성되는 과정을 볼 수 있고, 기다리지 않고 다른 작업을 하셔도 됩니다.';
  let canSubmit = true;
  if (!file) {
    guidance = '제품 이미지를 올리면 시작할 수 있어요.';
    canSubmit = false;
  } else if (!selected) {
    guidance = '템플릿을 1개 선택해 주세요.';
    canSubmit = false;
  } else if (selected.needsModel && !modelFile) {
    guidance = '모델컷을 업로드해 주세요.';
    canSubmit = false;
  } else if (selected.needsModel && !modelConsent) {
    guidance = '모델 사용 권한에 동의해야 생성할 수 있어요.';
    canSubmit = false;
  } else if (selected.needsProof && !proofComplete) {
    guidance = '수상 실적을 입력해야 이 템플릿을 생성할 수 있어요.';
    canSubmit = false;
  } else if (selected.needsPromo && (!promo.setTitle.trim() || !promo.salePrice.trim())) {
    guidance = '세트명과 판매가를 입력해야 이 템플릿을 생성할 수 있어요.';
    canSubmit = false;
  }

  /** 제출(HOME-06d) — 성공 시 결과 화면 생성중 상태로 이동 */
  async function handleSubmit() {
    if (!canSubmit || !file || !selected || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const form = new FormData();
      form.set('image', file);
      form.set('platform', platform);
      form.set('styleId', selected.id);
      form.set('proofRankTitle', proof.rankTitle);
      form.set('proofGenre', proof.genre);
      form.set('proofDate', proof.aggregationDate);
      // F 모델컷 + 동의(HOME-02b)
      if (selected.needsModel && modelFile) {
        form.set('modelImage', modelFile);
        form.set('modelConsent', String(modelConsent));
      }
      // G 프로모 입력(HOME-05b)
      if (selected.needsPromo) {
        form.set('promoSetTitle', promo.setTitle);
        form.set('promoSalePrice', promo.salePrice);
        form.set('promoNormalPrice', promo.normalPrice);
        form.set('promoNormalPriceVerified', String(promo.normalPriceVerified));
        form.set('promoDiscountRate', promo.discountRate);
        form.set('promoGift', promo.gift);
        form.set('promoQualifiers', promo.qualifiers);
        form.set('promoFootnote', promo.footnote);
      }
      const res = await fetch('/api/studio/thumbnail', { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const { id } = await res.json();
      router.push(`/app/studio/thumbnail/${id}`);
    } catch (err) {
      setSubmitError(String((err as Error).message));
      setSubmitting(false);
    }
  }

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[768px] px-8 pb-32 max-sm:px-5">
        {/* 페이지 헤더(HOME-01a) */}
        <header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">KGLOW 마케팅 스튜디오</p>
            <div className="flex gap-1.5">
              {meta?.storeKind === 'file' && <StatusBadge tone="off">로컬 저장(dev)</StatusBadge>}
              {meta && (meta.llmMode === 'mock' || meta.imageMode === 'mock') && <StatusBadge tone="off">목 모드(dev)</StatusBadge>}
            </div>
          </div>
          <h1 className="mt-2.5 text-[30px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
            일본향 썸네일 스튜디오
          </h1>
          <p className="mt-3.5 text-[15px] leading-[1.7] text-ink-body [text-wrap:pretty]">
            한국 썸네일을 그대로 옮기지 않습니다. 일본 고객이 신뢰하는 썸네일 문법 8종으로, 카피의 의도부터 재설계합니다.
          </p>
        </header>

        {/* 모듈 탭(HOME-01b) */}
        <div role="tablist" aria-label="스튜디오 모듈" className="mt-7 flex gap-0.5 border-b border-hairline">
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className="-mb-px border-b-2 border-coral px-3.5 py-2.5 text-sm font-bold text-coral-strong"
          >
            썸네일
          </button>
          {['상세페이지 전환', '인스타 피드'].map((label) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected="false"
              aria-disabled="true"
              tabIndex={-1}
              className="flex cursor-default items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-ink-faint"
            >
              {label} <StatusBadge tone="off">준비 중</StatusBadge>
            </button>
          ))}
        </div>

        {/* 원본 이미지(HOME-02) */}
        <SectionCard
          step={1}
          title="원본 이미지"
          pill="필수 · 1장"
          pillTone="required"
          className="mt-8"
          desc="한국 썸네일 또는 제품 단독컷 1장을 올려 주세요. 제품이 선명하고 가려지지 않아야 하며, 카피·뱃지가 있는 프로모 썸네일이어도 됩니다."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
            }}
          />
          {/* 소스 2탭(HOME-02) — 직접 업로드 | 브랜드 자산에서 선택 */}
          <div role="tablist" aria-label="제품컷 소스" className="mb-4 flex gap-0.5 rounded-[10px] bg-n-100 p-1">
            {(
              [
                ['upload', '직접 업로드'],
                ['brand', '브랜드 자산에서 선택'],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={sourceTab === tab}
                onClick={() => setSourceTab(tab)}
                className={`flex-1 rounded-[7px] px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                  sourceTab === tab ? 'bg-canvas text-coral-strong shadow-1' : 'text-ink-mute hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {sourceTab === 'brand' ? (
            products.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-input-border bg-n-50 p-6 text-center">
                <p className="text-[13.5px] font-semibold text-ink">등록한 제품이 없습니다</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-mute">
                  브랜드 관리에서 제품을 등록하면 제품컷을 여기서 바로 골라 쓸 수 있어요.
                </p>
                <Link href="/app/brand" className={buttonClass('secondary', 'sm', 'mt-3 no-underline')}>
                  브랜드 관리로 가기
                </Link>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {products.flatMap((p) =>
                    p.images.map((im) => (
                      <button
                        key={im.fileId}
                        type="button"
                        onClick={() => void pickBrandImage(im.fileId, p.nameKr)}
                        className={`relative block overflow-hidden rounded-[10px] border-2 text-left transition-colors ${
                          pickedFileId === im.fileId ? 'border-coral' : 'border-hairline hover:border-coral'
                        }`}
                      >
                        <span className="block aspect-square bg-n-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/files/${im.fileId}`} alt={`${p.nameKr} 제품컷`} className="h-full w-full object-cover" />
                        </span>
                        {pickedFileId === im.fileId && (
                          <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[11px] font-bold text-white">
                            ✓
                          </span>
                        )}
                        <span className="block truncate bg-canvas px-1.5 py-1 text-[10px] font-semibold text-ink-mute">{p.nameKr}</span>
                      </button>
                    )),
                  )}
                </div>
                <p className="mt-2.5 text-[11.5px] text-ink-faint">
                  {pickedFileId ? '브랜드 자산 · 선택한 제품컷으로 생성합니다.' : '여기서는 조회·선택만 합니다 — 등록·삭제는 브랜드 관리에서.'}
                </p>
              </div>
            )
          ) : previewUrl ? (
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-[200px] w-[200px] flex-none overflow-hidden rounded-xl border border-card-border bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="업로드한 원본 이미지 미리보기" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-[220px] flex-1">
                <p className="text-[13.5px] font-bold break-all text-ink">
                  {file?.name}{' '}
                  <span className="font-medium text-ink-mute">{file ? `· ${(file.size / 1024 / 1024).toFixed(1)}MB` : ''}</span>
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                  프로모 썸네일이면 기존 한국어 오버레이(카피·뱃지·테두리)는 걷어내고, 일본 문법으로 재설계합니다.
                </p>
                <button type="button" onClick={() => fileInputRef.current?.click()} className={buttonClass('secondary', 'sm', 'mt-3')}>
                  이미지 교체
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              aria-label="이미지 업로드 — 클릭하거나 파일을 끌어다 놓기"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) acceptFile(f);
              }}
              className={`flex min-h-[240px] w-full flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed p-7 text-center transition-colors ${
                isDragOver ? 'border-coral bg-coral-tint' : 'border-input-border bg-n-50 hover:border-coral hover:bg-coral-tint'
              }`}
            >
              <IconUpload size={34} className="text-ink-faint" />
              <p className="text-[14.5px] font-semibold text-ink-body">
                이미지를 끌어다 놓거나 <span className="text-coral-strong">클릭해서 선택</span>
              </p>
              <p className="text-[12.5px] leading-relaxed text-ink-mute">JPG · PNG · WebP / 10MB 이하 / 권장 1024px 이상 정방형</p>
            </button>
          )}
          {fileError && (
            <p role="alert" className="mt-2.5 text-[12.5px] font-semibold text-danger-text">
              {fileError}
            </p>
          )}
        </SectionCard>

        {/* 타깃 플랫폼(HOME-03) */}
        <SectionCard
          step={2}
          title="타깃 플랫폼"
          pill="선택"
          pillTone="optional"
          className="mt-5"
          desc="올릴 플랫폼을 고르면 그 플랫폼 문법에 맞는 템플릿을 추천해 드립니다. 규정에 어긋나는 조합은 표시만 하고 선택은 막지 않습니다."
        >
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="타깃 플랫폼">
            {PLATFORMS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={platform === p} onClick={() => setPlatform(p)} className={chipClass(platform === p)}>
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* 템플릿 선택(HOME-04) */}
        <SectionCard
          step={3}
          title="템플릿"
          pill="필수 · 1개"
          pillTone="required"
          className="mt-5"
          desc="라쿠텐·아마존JP·Qoo10 실측 썸네일 120장에서 역설계한 일본 썸네일 문법 8종입니다. 카드 이미지는 각 문법의 실측 참고 컷이며, 생성 결과가 아닙니다."
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="radiogroup" aria-label="템플릿 8종">
            {styles.map((s) => {
              const isRecommended = recommended.includes(s.id);
              const isDimmed = platform !== 'unset' && !isRecommended;
              const isSelected = styleId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setStyleId(s.id);
                    if (s.needsProof) setProofOpen(true); // 수상 스택형 → 실적 영역 자동 펼침(HOME-04a)
                  }}
                  className={`relative flex flex-col rounded-xl border p-2.5 text-left transition-colors ${
                    isSelected ? 'border-[1.5px] border-coral bg-coral-tint' : 'border-card-border bg-canvas hover:border-coral'
                  } ${isDimmed ? 'opacity-60 grayscale-[.4] hover:opacity-100 hover:grayscale-0 focus-visible:opacity-100 focus-visible:grayscale-0' : ''}`}
                >
                  <span className="relative block aspect-square overflow-hidden rounded-[8px] border border-hairline">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.previewSrc} alt={`${s.nameKo} 실측 참고 컷`} className="h-full w-full object-cover" />
                    {(isRecommended || isDimmed) && (
                      <span
                        className={`absolute top-1.5 left-1.5 z-1 inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-bold ${
                          isRecommended ? 'bg-green-bg text-green-text' : 'bg-amber-bg text-amber-text'
                        }`}
                      >
                        {isRecommended ? '추천' : '△ 부적합'}
                      </span>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 z-1 inline-flex h-[19px] items-center rounded-[5px] bg-[rgba(16,18,20,.62)] px-1.5 text-[10px] font-bold text-white backdrop-blur-[3px]">
                      실측 · {s.platformFit.map((f) => FIT_LABELS[f] ?? f).join('·')}
                    </span>
                    {isSelected && (
                      <span
                        aria-hidden
                        className="absolute top-1.5 right-1.5 z-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-coral text-xs font-extrabold text-white"
                      >
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="mt-2.5 block text-[13px] font-bold text-ink">{s.nameKo}</span>
                  <span className="clamp-2 mt-[3px] block text-[11.5px] leading-snug text-ink-mute">{s.description}</span>
                  <span className="mt-1.5 block text-[10.5px] font-semibold text-ink-mute">
                    {s.platformFit.map((f) => FIT_LABELS[f] ?? f).join(' · ')}
                  </span>
                  {(s.needsProof || s.needsModel || s.needsPromo) && (
                    <span className="mt-auto inline-flex h-[19px] w-fit items-center self-start rounded-full bg-amber-bg px-[7px] text-[10px] font-bold text-amber-text">
                      {s.needsProof ? '실적 입력 필요' : s.needsModel ? '모델컷 필요' : '가격 입력 필요'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {platform === 'amazon-jp' && (
            <p className="mt-3.5 rounded-[8px] bg-amber-bg px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-text">
              아마존JP에 부적합 {styles.length - recommended.length}종 — 아마존 메인 이미지는 오버레이(텍스트·배지) 금지 규정이 있습니다
            </p>
          )}
          {platform !== 'unset' && platform !== 'amazon-jp' && recommended.length > 0 && (
            <p className="mt-3.5 text-[12.5px] leading-relaxed text-ink-mute">
              {PLATFORM_LABELS[platform]} 추천 문법 밖 템플릿은 플랫폼 관례와 충돌할 수 있습니다 — 선택은 막지 않습니다
            </p>
          )}
        </SectionCard>

        {/* 모델컷(HOME-02b) — 모델+카피형(F) 선택 시만. 필수 1장 + 사용 권한 동의 */}
        {selected?.needsModel && (
          <SectionCard
            title="모델컷"
            pill="필수 · 1장 + 동의"
            pillTone="required"
            className="mt-5"
            desc="브랜드가 보유·촬영한 모델컷을 올려 주세요. 업로드한 모델컷을 그대로 쓰며, 얼굴을 새로 만들지 않습니다."
          >
            <input
              ref={modelInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) acceptModelFile(f);
              }}
            />
            {modelPreviewUrl ? (
              <div className="flex flex-wrap items-start gap-4">
                <div className="h-[160px] w-[160px] flex-none overflow-hidden rounded-xl border border-card-border bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={modelPreviewUrl} alt="업로드한 모델컷 미리보기" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-[220px] flex-1">
                  <p className="text-[13.5px] font-bold break-all text-ink">
                    {modelFile?.name}{' '}
                    <span className="font-medium text-ink-mute">
                      {modelFile ? `· ${(modelFile.size / 1024 / 1024).toFixed(1)}MB` : ''}
                    </span>
                  </p>
                  <button type="button" onClick={() => modelInputRef.current?.click()} className={buttonClass('secondary', 'sm', 'mt-3')}>
                    모델컷 교체
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                aria-label="모델컷 업로드"
                onClick={() => modelInputRef.current?.click()}
                className="flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-input-border bg-n-50 p-6 text-center transition-colors hover:border-coral hover:bg-coral-tint"
              >
                <IconUpload size={28} className="text-ink-faint" />
                <p className="text-[13.5px] font-semibold text-ink-body">
                  모델컷을 <span className="text-coral-strong">클릭해서 선택</span>
                </p>
                <p className="text-[12px] text-ink-mute">JPG · PNG · WebP / 10MB 이하</p>
              </button>
            )}
            {modelFileError && (
              <p role="alert" className="mt-2.5 text-[12.5px] font-semibold text-danger-text">
                {modelFileError}
              </p>
            )}
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-input-border bg-n-50 p-3.5">
              <input
                type="checkbox"
                checked={modelConsent}
                onChange={(e) => setModelConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none accent-coral"
              />
              <span className="text-[12.5px] leading-relaxed text-ink-body">
                <b className="font-bold text-ink">모델 사용 권한에 동의합니다.</b> 업로드한 모델컷을 이 브랜드의 썸네일 생성에 쓸 권한이 있습니다. 미체크 시 생성할 수 없습니다.
              </span>
            </label>
          </SectionCard>
        )}

        {/* 프로모션 입력(HOME-05b) — 프로모션 강조형(G) 선택 시만. 세트명·판매가 필수 + 이중가격 게이트 */}
        {selected?.needsPromo && (
          <SectionCard
            title="프로모션 입력"
            pill="필수 · 세트명·판매가"
            pillTone="required"
            className="mt-5"
            desc="입력한 가격·특전만 그대로 렌더됩니다. 통상가 취소선은 실제 판매 실적이 있을 때만 표기합니다(有利誤認 방지)."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={fieldLabelClass}>
                세트명 <span className="text-coral-strong">*</span>
                <input
                  type="text"
                  lang="ja"
                  value={promo.setTitle}
                  onChange={(e) => setPromo((p) => ({ ...p, setTitle: e.target.value }))}
                  placeholder="선케어 2개 세트"
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
              <label className={fieldLabelClass}>
                판매가 (엔) <span className="text-coral-strong">*</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={promo.salePrice}
                  onChange={(e) => setPromo((p) => ({ ...p, salePrice: e.target.value }))}
                  placeholder="2980"
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
              <label className={fieldLabelClass}>
                통상가 (엔)
                <input
                  type="text"
                  inputMode="numeric"
                  value={promo.normalPrice}
                  disabled={!promo.normalPriceVerified}
                  onChange={(e) => setPromo((p) => ({ ...p, normalPrice: e.target.value }))}
                  placeholder="3980"
                  className={`mt-1.5 ${inputClass} disabled:opacity-50`}
                />
              </label>
              <label className={fieldLabelClass}>
                할인율 (%)
                <input
                  type="text"
                  inputMode="numeric"
                  value={promo.discountRate}
                  onChange={(e) => setPromo((p) => ({ ...p, discountRate: e.target.value }))}
                  placeholder="25"
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={promo.normalPriceVerified}
                onChange={(e) => setPromo((p) => ({ ...p, normalPriceVerified: e.target.checked }))}
                className="mt-0.5 h-4 w-4 flex-none accent-coral"
              />
              <span className="text-[12.5px] leading-relaxed text-ink-body">
                통상가로 <b className="font-bold text-ink">실제 판매한 실적</b>이 있습니다 — 체크해야 취소선 통상가가 표기됩니다. 미체크면 통상가는 반영되지 않습니다.
              </span>
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={fieldLabelClass}>
                GIFT (선택)
                <input
                  type="text"
                  lang="ja"
                  value={promo.gift}
                  onChange={(e) => setPromo((p) => ({ ...p, gift: e.target.value }))}
                  placeholder="ミニサイズ プレゼント"
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
              <label className={fieldLabelClass}>
                한정 칩 (쉼표 구분)
                <input
                  type="text"
                  lang="ja"
                  value={promo.qualifiers}
                  onChange={(e) => setPromo((p) => ({ ...p, qualifiers: e.target.value }))}
                  placeholder="数量限定, 今だけ"
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
            </div>
            <label className={`${fieldLabelClass} mt-4 block`}>
              ※ 각주 (선택)
              <input
                type="text"
                lang="ja"
                value={promo.footnote}
                onChange={(e) => setPromo((p) => ({ ...p, footnote: e.target.value }))}
                placeholder="※価格・特典は予告なく変更される場合があります"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
            {promo.normalPrice && !promo.normalPriceVerified && (
              <p className="mt-3 text-[12.5px] font-semibold text-amber-text">
                통상가는 실적 확인 체크가 있어야 반영됩니다 — 현재는 취소선 없이 판매가만 표기됩니다.
              </p>
            )}
          </SectionCard>
        )}

        {/* 실적 배지(HOME-05) — 접이식 */}
        <section className={cardClass('mt-5 overflow-hidden')}>
          <button
            type="button"
            aria-expanded={proofOpen}
            onClick={() => setProofOpen((v) => !v)}
            className="flex w-full flex-wrap items-center gap-2.5 px-6 py-5 text-left sm:px-8"
          >
            <span
              aria-hidden
              className="inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-coral/35 bg-coral-tint text-[11.5px] font-extrabold text-coral-strong"
            >
              4
            </span>
            <h2 className="text-[16px] font-bold text-ink">랭킹·수상 실적이 있다면 추가하세요</h2>
            {selected?.needsProof && (
              <span className="inline-flex h-[19px] items-center rounded-full bg-coral-tint px-[7px] text-[10px] font-bold text-coral-strong">
                필수 — 수상 실적 스택형
              </span>
            )}
            <span aria-hidden className="ml-auto text-ink-faint">
              {proofOpen ? <IconChevronUp /> : <IconChevronDown />}
            </span>
            <span className="basis-full text-[12.5px] leading-relaxed text-ink-mute">
              근거가 없으면 배지는 생성되지 않습니다. 이것이 기본값입니다.
            </span>
          </button>
          {proofOpen && (
            <div className="border-t border-hairline px-6 pt-5 pb-7 sm:px-8">
              <div className="grid gap-3.5 sm:grid-cols-3">
                {(
                  [
                    ['rankTitle', '실적명', '楽天ランキング1位'],
                    ['genre', '부문·장르', '日焼け止め'],
                    ['aggregationDate', '집계일·기간', '2026/6/14更新 [集計日6/13]'],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <label key={key} className={fieldLabelClass}>
                    {label}
                    <input
                      type="text"
                      lang="ja"
                      value={proof[key]}
                      placeholder={placeholder}
                      onChange={(e) => setProof((prev) => ({ ...prev, [key]: e.target.value }))}
                      className={`mt-1.5 ${inputClass}`}
                    />
                  </label>
                ))}
              </div>
              {!proofComplete && (proof.rankTitle || proof.genre || proof.aggregationDate) && (
                <p className="mt-3 text-[12.5px] font-semibold text-amber-text">실적명·부문·집계일이 모두 있어야 배지가 들어갑니다.</p>
              )}
              <p className="mt-3 text-[12px] leading-relaxed text-ink-mute">
                입력한 사실 그대로만 렌더됩니다. 근거 없는 랭킹·수상 배지는 경품표시법 리스크가 있어 생성 자체가 되지 않습니다.
              </p>
            </div>
          )}
        </section>

        {/* 재설계 고지(HOME-06a) */}
        <div className="mt-6 rounded-card border border-coral/35 bg-coral-tint p-5">
          <p className="text-[13px] leading-[1.7] text-ink-body [text-wrap:pretty]">
            <b className="text-coral-strong">일본어 카피는 자동 번역이 아닙니다.</b> 한국 카피의 의도를 추출해 일본 고민 어휘·관례어로
            재설계하고, <span lang="ja">薬機法</span> 1차 스크리닝을 통과한 문구만 이미지에 들어갑니다.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-mute">
            「쿨톤 치트키」 → <span lang="ja" className="font-bold text-ink">「白浮きしない、透け感トーンアップUV」</span>{' '}
            <span className="ml-1 inline-flex h-[18px] items-center rounded-full bg-n-150 px-[7px] text-[10.5px] font-bold text-ink-mute">
              예시
            </span>
          </p>
        </div>

        {/* 최근 생성 스트립(HOME-07) — 자산 0건이면 영역 미출력 */}
        {meta && meta.recent.length > 0 && (
          <section className="mt-14">
            <div className="flex flex-wrap items-baseline justify-between gap-2.5">
              <h2 className="text-base font-extrabold tracking-[-0.01em] text-ink">최근 생성</h2>
              <p className="text-[12.5px] text-ink-mute">
                전체 자산은 ③ 운영 자산 라이브러리{' '}
                <Link href="/app/library" className="font-bold text-coral-strong hover:underline">
                  자산 라이브러리 열기
                </Link>
                에 모입니다
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {meta.recent.map((a) =>
                a.status === 'generating' ? (
                  <Link
                    key={a.id}
                    href={`/app/studio/thumbnail/${a.id}`}
                    role="status"
                    aria-live="polite"
                    className="block overflow-hidden rounded-2xl border border-card-border bg-canvas shadow-card"
                  >
                    <span className="relative block aspect-square overflow-hidden bg-n-150">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.originalUrl} alt="" aria-hidden className="h-full w-full scale-110 object-cover opacity-40 blur-sm" />
                      <span
                        aria-hidden
                        className="absolute inset-0 animate-shimmer bg-[length:420px_100%] bg-no-repeat bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,.62)_50%,transparent_80%)]"
                      />
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-canvas/40 p-3 text-center">
                        <span aria-hidden className="h-[18px] w-[18px] animate-spin rounded-full border-[2.5px] border-coral border-t-transparent" />
                        <span className="text-[11px] font-bold text-ink-body">
                          {a.stage ? (STUDIO_STAGE_LABELS[a.stage] ?? a.stage) : '대기 중'}
                        </span>
                      </span>
                    </span>
                    <span className="block px-3 pt-2.5 pb-3">
                      <span className="block truncate text-[11.5px] font-bold text-ink">{a.styleName}</span>
                      <span className="mt-1 block text-[11px] leading-normal text-ink-mute">
                        완료되면 여기에 표시됩니다. 결과 화면에서도 볼 수 있습니다.
                      </span>
                    </span>
                  </Link>
                ) : (
                  <Link
                    key={a.id}
                    href={`/app/studio/thumbnail/${a.id}`}
                    className="block overflow-hidden rounded-2xl border border-card-border bg-canvas shadow-card transition-[border-color,box-shadow] hover:border-coral hover:shadow-2"
                  >
                    <span className="relative block aspect-square overflow-hidden">
                      <ThumbPreview src={a.imageUrl ?? a.originalUrl} alt={`${a.styleName} 썸네일`} />
                      {a.status === 'failed' && (
                        <span aria-hidden className="absolute inset-0 bg-danger-bg/80" />
                      )}
                    </span>
                    <span className="block px-3 pt-2.5 pb-3">
                      <span className={`block truncate text-[11.5px] font-bold ${a.status === 'failed' ? 'text-danger-text' : 'text-ink'}`}>
                        {a.status === 'failed' ? '생성 실패 — ' : ''}
                        {a.styleName}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-mute">{a.createdAt.slice(0, 10)}</span>
                    </span>
                  </Link>
                ),
              )}
            </div>
          </section>
        )}
      </div>

      {/* 하단 sticky 제출 바(HOME-06b·6c) — 전폭 primary + 힌트 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/95 px-6 py-4 backdrop-blur left-0 lg:left-sidebar">
        <div className="mx-auto max-w-[768px]">
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => void handleSubmit()}
            className={buttonClass('primary', 'lg', 'w-full')}
          >
            {submitting ? '생성 시작 중…' : '일본향 썸네일 생성'}
          </button>
          <p className="mt-2.5 text-center text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">{guidance}</p>
          {submitError && (
            <p role="alert" className="mt-1.5 text-center text-xs text-danger-text">
              {submitError}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
