'use client';

/**
 * 생성 퍼널 폼(HOME-02~08) — 원본 업로드·플랫폼·템플릿·실적을 한 화면에서 받아 제출한다.
 * 클라이언트 검증은 서버(POST /api/studio/thumbnail)와 동일 규칙 이중 적용.
 * 2026-08-18: 하단 '최근 생성' 스트립 제거 — 생성 화면은 만들기에만 집중하고, 만든 자산은
 * ③ 운영 자산 라이브러리와 결과 화면에서 본다(같은 목록을 세 곳에 두지 않는다).
 * 디자인 정본: docs/specs/02-studio/1-home.html
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PLATFORMS, PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
import {
  StatusBadge,
  buttonClass,
  cardClass,
} from '@/components/ui/primitives';
import { IconChevronDown, IconChevronUp, IconUpload } from '@/components/ui/icons';
import { bytesUrl } from '@/lib/files/downloadUrl';
import { EXPIRED_LOGIN_PATH } from '@/components/auth/authUtils';
import {
  ContentBadge,
  SegmentedControl,
  StudioActionBar,
  StudioPageHeading,
  StudioSection,
  studioButtonClass,
  studioChipClass,
  studioInputClass,
  studioLabelClass,
} from '@/components/app/studioUi';

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

interface StudioMeta {
  storeKind: 'supabase' | 'file';
  llmMode: 'real' | 'mock';
  imageMode: 'real' | 'mock';
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
      const res = await fetch(bytesUrl(url));
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

  // 진입 시 브랜드 제품 자산 로드(HOME-02 피커 소스)
  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // 실행 모드 메타(dev 배지) — 최근 생성 스트립을 뺀 뒤로 폴링할 이유가 없어 진입 시 1회만 읽는다
  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/thumbnail', { cache: 'no-store' });
      if (res.ok) setMeta(await res.json());
    } catch {
      /* 배지는 보조 표면 — 로드 실패를 화면 오류로 승격하지 않는다 */
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

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
      if (res.status === 401) {
        setSubmitting(false);
        router.replace(EXPIRED_LOGIN_PATH); // 세션 만료 — 서비스 안에는 로그인 동선이 없다
        return;
      }
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
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-8 pt-[72px] pb-8 max-sm:px-5">
        {/* 페이지 헤더 — 스튜디오 메뉴에서 들어온다(Figma 1:11394) */}
        <div className="flex flex-col gap-3">
          <Link
            href="/app/studio"
            className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-ink-mute no-underline transition-colors hover:text-ink"
          >
            <span aria-hidden>←</span> 마케팅 스튜디오
          </Link>
          <StudioPageHeading
            title="썸네일 만들기"
            desc="제품 이미지를 일본향 스타일의 썸네일 이미지로 변환"
            trailing={
              <>
                {meta?.storeKind === 'file' && <StatusBadge tone="off">로컬 저장(dev)</StatusBadge>}
                {meta && (meta.llmMode === 'mock' || meta.imageMode === 'mock') && <StatusBadge tone="off">목 모드(dev)</StatusBadge>}
              </>
            }
          />
        </div>

        {/* 이미지 업로드(Figma 1:11399) */}
        <StudioSection title="이미지 업로드" desc="한국 썸네일 또는 제품 이미지를 선택해주세요">
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
          {/* 소스 선택 — 직접 업로드 | 브랜드 자산에서 선택 */}
          <SegmentedControl
            label="제품컷 소스"
            value={sourceTab}
            onChange={setSourceTab}
            options={[
              { value: 'upload', label: '직접 업로드' },
              { value: 'brand', label: '브랜드 자산에서 선택' },
            ] as const}
          />
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
                <p className="text-[12px] font-bold text-ink-mute">업로드한 이미지</p>
                <p className="mt-1 text-[13.5px] font-bold break-all text-ink">
                  {file?.name}{' '}
                  <span className="font-medium text-ink-mute">{file ? `· ${(file.size / 1024 / 1024).toFixed(1)}MB` : ''}</span>
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                  프로모 썸네일이면 기존 한국어 오버레이(카피·뱃지·테두리)는 걷어내고 일본 문법으로 재설계합니다.
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
              className={`flex h-[295px] min-h-[240px] w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed p-7 text-center transition-colors ${
                isDragOver ? 'border-coral bg-coral-tint' : 'border-input-border bg-n-50 hover:border-coral hover:bg-coral-tint'
              }`}
            >
              <IconUpload size={34} className="text-ink-faint" />
              <p className="text-[14.5px] leading-[21.75px] font-semibold text-ink-body">
                이미지를 끌어다 놓거나 <span className="text-coral-strong">클릭하여 업로드</span>
              </p>
              <p className="text-[12.5px] leading-[20.3px] text-ink-mute">JPG · PNG · WebP / 10MB 이하 / 권장 1024px 이상 정방형</p>
            </button>
          )}
          {fileError && (
            <p role="alert" className="mt-2.5 text-[12.5px] font-semibold text-danger-text">
              {fileError}
            </p>
          )}
        </StudioSection>

        {/* 템플릿 선택(Figma 1:11418) */}
        <StudioSection title="템플릿" desc="생성할 썸네일 이미지의 템플릿을 선택해주세요">
          {/* 플랫폼 필터 — 고른 플랫폼의 문법에 맞는 템플릿을 앞세운다(Figma 1:11426) */}
          <div className="flex flex-wrap items-center gap-2.5" role="radiogroup" aria-label="타깃 플랫폼">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={platform === p}
                onClick={() => setPlatform(p)}
                className={studioChipClass(platform === p)}
              >
                {/* 필터 줄에서만 '전체'로 읽는다 — 저장값(unset)의 표시 라벨('미정')은 결과 화면 몫이다 */}
                {p === 'unset' ? '전체' : PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4" role="radiogroup" aria-label="템플릿 8종">
            {styles.map((s, styleIdx) => {
              const isRecommended = recommended.includes(s.id);
              const isDimmed = platform !== 'unset' && !isRecommended;
              const isSelected = styleId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setStyleId(s.id)}
                  /* 카드가 순서대로 들어온다 — 마운트 1회뿐이라 선택할 때 다시 뜨지 않는다 */
                  style={{ animationDelay: `${styleIdx * 40}ms` }}
                  className={`relative flex animate-tile-in flex-col rounded-xl border p-2.5 text-left transition-colors ${
                    isSelected ? 'border-[1.5px] border-coral bg-coral-tint' : 'border-card-border bg-canvas hover:border-coral'
                  } ${isDimmed ? 'opacity-60 grayscale-[.4] hover:opacity-100 hover:grayscale-0 focus-visible:opacity-100 focus-visible:grayscale-0' : ''}`}
                >
                  <span className="relative block aspect-square overflow-hidden rounded-[8px] border border-hairline">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.previewSrc} alt={`${s.nameKo} 실측 참고 컷`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
        </StudioSection>

        {/* 랭킹·수상 실적(Figma 1:11456) — 근거가 있어야 배지가 붙는다 */}
        <StudioSection
          title="랭킹·수상 실적"
          badge={selected?.needsProof ? '필수' : '선택'}
          gap={20}
          desc="제품의 랭킹 기록이나, 수상 기록을 추가해주세요."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['rankTitle', '실적명', '楽天ランキング1位'],
                ['genre', '부문, 장르', '日焼け止め'],
                ['aggregationDate', '수상일', '2026/6/14更新 [集計日6/13]'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className={studioLabelClass}>
                {label}
                <input
                  type="text"
                  lang="ja"
                  value={proof[key]}
                  placeholder={placeholder}
                  onChange={(e) => setProof((prev) => ({ ...prev, [key]: e.target.value }))}
                  className={studioInputClass}
                />
              </label>
            ))}
          </div>
          {!proofComplete && (proof.rankTitle || proof.genre || proof.aggregationDate) && (
            <p className="mt-3 text-[12.5px] font-semibold text-amber-text">실적명·부문·집계일이 모두 있어야 배지가 들어갑니다.</p>
          )}
          <p className="text-[12px] leading-relaxed text-ink-mute">
            입력한 사실 그대로만 그립니다. 근거 없는 랭킹·수상 배지는 경품표시법 리스크가 있어 아예 만들지 않습니다.
          </p>
        </StudioSection>

        {/*
          프로모션(HOME-05b) — 화면에서는 자리를 늘 지킨다(무엇을 넣을 수 있는지 먼저 보이게).
          다만 값을 실제로 쓰는 건 프로모션 강조형(G)뿐이라, 다른 템플릿에서는 입력 대신 그 사실을 말한다.
        */}
        {selected?.needsPromo ? (
          <StudioSection
            title="프로모션"
            badge="필수"
            gap={20}
            desc="입력한 가격·특전만 그대로 그립니다. 통상가 취소선은 실제 판매 실적이 있을 때만 표기합니다(有利誤認 방지)."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={studioLabelClass}>
                프로모션 이름 <span className="text-coral-strong">*</span>
                <input
                  type="text"
                  lang="ja"
                  value={promo.setTitle}
                  onChange={(e) => setPromo((p) => ({ ...p, setTitle: e.target.value }))}
                  placeholder="선케어 2개 세트"
                  className={studioInputClass}
                />
              </label>
              <label className={studioLabelClass}>
                할인 가격 (엔) <span className="text-coral-strong">*</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={promo.salePrice}
                  onChange={(e) => setPromo((p) => ({ ...p, salePrice: e.target.value }))}
                  placeholder="2980"
                  className={studioInputClass}
                />
              </label>
              <label className={studioLabelClass}>
                정가 (엔)
                <input
                  type="text"
                  inputMode="numeric"
                  value={promo.normalPrice}
                  disabled={!promo.normalPriceVerified}
                  onChange={(e) => setPromo((p) => ({ ...p, normalPrice: e.target.value }))}
                  placeholder="3980"
                  className={`${studioInputClass} disabled:opacity-50`}
                />
              </label>
              <label className={studioLabelClass}>
                할인율 (%)
                <input
                  type="text"
                  inputMode="numeric"
                  value={promo.discountRate}
                  onChange={(e) => setPromo((p) => ({ ...p, discountRate: e.target.value }))}
                  placeholder="25"
                  className={studioInputClass}
                />
              </label>
            </div>
            {/* Figma "취소선 가격 이미지 만들기" — 정가 취소선은 실판매 실적이 있을 때만 그린다 */}
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={promo.normalPriceVerified}
                onChange={(e) => setPromo((p) => ({ ...p, normalPriceVerified: e.target.checked }))}
                className="mt-0.5 h-[18px] w-[18px] flex-none rounded-[5px] accent-coral"
              />
              <span className="text-[13px] leading-[1.5] text-ink-mute">
                취소선 가격 이미지 만들기 — 정가로 <b className="font-semibold text-ink-body">실제 판매한 실적</b>이 있을 때만 체크해 주세요.
              </span>
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={studioLabelClass}>
                증정품 (선택)
                <input
                  type="text"
                  lang="ja"
                  value={promo.gift}
                  onChange={(e) => setPromo((p) => ({ ...p, gift: e.target.value }))}
                  placeholder="ミニサイズ プレゼント"
                  className={studioInputClass}
                />
              </label>
              <label className={studioLabelClass}>
                한정 칩 텍스트 (선택)
                <input
                  type="text"
                  lang="ja"
                  value={promo.qualifiers}
                  onChange={(e) => setPromo((p) => ({ ...p, qualifiers: e.target.value }))}
                  placeholder="数量限定, 今だけ"
                  className={studioInputClass}
                />
              </label>
            </div>
            <label className={`${studioLabelClass} block`}>
              ※ 각주 (선택)
              <input
                type="text"
                lang="ja"
                value={promo.footnote}
                onChange={(e) => setPromo((p) => ({ ...p, footnote: e.target.value }))}
                placeholder="※価格・特典は予告なく変更される場合があります"
                className={studioInputClass}
              />
            </label>
            {promo.normalPrice && !promo.normalPriceVerified && (
              <p className="text-[12.5px] font-semibold text-amber-text">
                정가는 실적 확인 체크가 있어야 반영됩니다 — 지금은 취소선 없이 할인 가격만 그립니다.
              </p>
            )}
          </StudioSection>
        ) : (
          <StudioSection title="프로모션" badge="선택 안 함" gap={20}>
            <p className="text-[13px] leading-[1.7] text-ink-mute">
              {selected
                ? `${selected.nameKo}은 가격·특전을 이미지에 넣지 않는 문법입니다. 세트가·증정을 강조하려면 프로모션 강조형을 골라 주세요.`
                : '프로모션 강조형 템플릿을 고르면 프로모션 이름·정가·할인 가격을 여기에 입력할 수 있습니다.'}
            </p>
          </StudioSection>
        )}

        {/* 모델컷(HOME-02b) — 프로모션과 같은 원칙. 실제로 쓰는 건 모델+카피형(F)뿐이다 */}
        {selected?.needsModel ? (
          <StudioSection
            title="모델컷"
            badge="필수"
            gap={20}
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
                <b className="font-bold text-ink">모델 사용 권한에 동의합니다.</b> 올린 모델컷을 이 브랜드의 썸네일 생성에 쓸 권한이 있습니다. 체크하지 않으면 만들 수 없습니다.
              </span>
            </label>
          </StudioSection>
        ) : (
          <StudioSection title="모델컷" badge="선택 안 함" gap={20}>
            <p className="text-[13px] leading-[1.7] text-ink-mute">
              {selected
                ? `${selected.nameKo}은 모델컷을 쓰지 않는 문법입니다. 모델을 앞세우려면 모델+카피형을 골라 주세요.`
                : '모델+카피형 템플릿을 고르면 브랜드가 촬영한 모델컷을 여기에 올릴 수 있습니다.'}
            </p>
          </StudioSection>
        )}

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
      </div>

      {/* 하단 sticky 제출 바(HOME-06b·6c) — 전폭 primary + 힌트 */}
      <StudioActionBar>
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={() => void handleSubmit()}
          className={studioButtonClass('primary', 'w-full')}
        >
          {submitting ? '생성 시작 중…' : '생성하기'}
        </button>
        <p className="mt-2.5 text-center text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">{guidance}</p>
        {submitError && (
          <p role="alert" className="mt-1.5 text-center text-xs text-danger-text">
            {submitError}
          </p>
        )}
      </StudioActionBar>
    </main>
  );
}
