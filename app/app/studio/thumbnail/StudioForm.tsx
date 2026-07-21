'use client';

/**
 * 생성 퍼널 폼(HOME-02~08) — 원본 업로드·플랫폼·템플릿·실적을 한 화면에서 받아 제출한다.
 * 클라이언트 검증은 서버(POST /api/studio/thumbnail)와 동일 규칙 이중 적용.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PLATFORMS, PLATFORM_LABELS, STUDIO_STAGE_LABELS, type Platform } from '@/lib/studio/platform';

interface StyleCard {
  id: string;
  slug: string;
  nameKo: string;
  description: string;
  platformFit: string[];
  needsProof: boolean;
  needsModel: boolean;
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

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>('unset');
  const [styleId, setStyleId] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [proof, setProof] = useState({ rankTitle: '', genre: '', aggregationDate: '' });
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
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, []);

  /** URL 이미지를 File로 가져온다 — 예시 채우기·프리필(RESULT-05·06) 공용 */
  const loadFromUrl = useCallback(
    async (url: string, name: string) => {
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      acceptFile(new File([blob], name, { type: blob.type }));
    },
    [acceptFile],
  );

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
  } else if (selected.needsModel) {
    guidance = '모델컷 업로드는 준비 중입니다 — 다른 템플릿을 선택해 주세요.';
    canSubmit = false;
  } else if (selected.needsProof && !proofComplete) {
    guidance = '수상 실적을 입력해야 이 템플릿을 생성할 수 있어요.';
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
    <main className="mx-auto max-w-4xl px-6 py-10 pb-32">
      {/* 페이지 헤더 + 모듈 탭(HOME-01) */}
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-[#D93636]">KGLOW 마케팅 스튜디오</p>
          <div className="flex gap-1.5">
            {meta?.storeKind === 'file' && (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">로컬 저장(dev)</span>
            )}
            {meta && (meta.llmMode === 'mock' || meta.imageMode === 'mock') && (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">목 모드(dev)</span>
            )}
          </div>
        </div>
        <h1 className="mt-1 text-2xl font-bold">일본향 썸네일 스튜디오</h1>
        <p className="mt-2 text-sm text-neutral-600">
          한국 썸네일을 그대로 옮기지 않습니다. 일본 고객이 신뢰하는 썸네일 문법 8종으로, 카피의 의도부터 재설계합니다.
        </p>
        <div className="mt-4 flex gap-2 border-b border-neutral-200 text-sm" role="tablist" aria-label="스튜디오 모듈">
          <span role="tab" aria-selected="true" className="border-b-2 border-[#FF6464] px-3 py-2 font-semibold text-[#D93636]">
            썸네일
          </span>
          {['상세페이지 전환', '인스타 피드'].map((label) => (
            <span key={label} role="tab" aria-selected="false" aria-disabled="true" className="px-3 py-2 text-neutral-400">
              {label} <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]">준비 중</span>
            </span>
          ))}
        </div>
      </header>

      {/* 원본 이미지(HOME-02) */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">
            원본 이미지 <span className="text-[#D93636]">*</span>
          </h2>
          <button
            type="button"
            onClick={() => void loadFromUrl('/studio-templates/haruon-before.jpg', 'haruon-before.jpg')}
            className="text-xs text-neutral-500 underline hover:text-[#D93636]"
          >
            예시 이미지 — HARUON 톤업 선크림
          </button>
        </div>
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
        {previewUrl ? (
          <div className="mt-2 flex items-center gap-4 rounded-2xl border border-neutral-200 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="업로드한 원본 이미지 미리보기" className="h-28 w-28 rounded-lg object-cover" />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{file?.name}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{file ? `${(file.size / 1024 / 1024).toFixed(1)}MB` : ''}</p>
              <p className="mt-1 text-xs text-neutral-500">
                기존 한국어 오버레이는 걷어내고 일본 문법으로 재설계합니다
              </p>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs font-semibold text-[#D93636] underline">
                교체
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) acceptFile(f);
            }}
            className="mt-2 flex h-[260px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 text-sm text-neutral-600 hover:border-[#FF6464]"
          >
            <span className="font-semibold">한국 썸네일 또는 제품 단독컷 1장을 올려 주세요</span>
            <span className="text-xs text-neutral-500">제품이 선명하고 가려지지 않아야 합니다 · JPG·PNG·WebP / 10MB 이하 / 권장 1024px 이상</span>
            <span className="mt-2 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium">클릭 또는 드래그해서 업로드</span>
          </button>
        )}
        {fileError && (
          <p role="alert" className="mt-2 rounded-lg border border-[#F0483C] bg-red-50 p-2.5 text-xs text-[#B3271D]">
            {fileError}
          </p>
        )}
      </section>

      {/* 타깃 플랫폼(HOME-03) */}
      <section className="mt-8">
        <h2 className="text-sm font-bold">타깃 플랫폼 (선택)</h2>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="타깃 플랫폼">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={platform === p}
              onClick={() => setPlatform(p)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                platform === p ? 'border-[#D93636] bg-[#FFF8F8] font-semibold text-[#D93636]' : 'border-neutral-300'
              }`}
            >
              {PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>
      </section>

      {/* 템플릿 선택(HOME-04) */}
      <section className="mt-8">
        <h2 className="text-sm font-bold">
          템플릿 <span className="text-[#D93636]">*</span>
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4" role="radiogroup" aria-label="템플릿 8종">
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
                className={`rounded-xl border p-2 text-left ${
                  isSelected ? 'border-[1.5px] border-[#D93636]' : 'border-neutral-200'
                } ${isDimmed ? 'opacity-50 saturate-50' : 'hover:border-neutral-400'}`}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.previewSrc} alt={`${s.nameKo} 실측 참고 컷`} className="aspect-square w-full rounded-lg object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                    실측 · {s.platformFit.map((f) => FIT_LABELS[f] ?? f).join('·')}
                  </span>
                  {isSelected && (
                    <span aria-hidden className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6464] text-xs font-bold text-white">
                      ✓
                    </span>
                  )}
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-1 text-xs font-bold">
                  {s.nameKo}
                  {isRecommended && <span className="rounded bg-[#FFF1F1] px-1.5 py-0.5 text-[10px] font-semibold text-[#D93636]">추천</span>}
                  {isDimmed && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">△ 부적합</span>}
                  {s.needsProof && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">실적 입력 필요</span>}
                  {s.needsModel && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">모델컷 필요</span>}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-neutral-500">{s.description}</p>
              </button>
            );
          })}
        </div>
        {platform === 'amazon-jp' && (
          <p className="mt-2 text-xs text-neutral-500">
            아마존JP에 부적합 {styles.length - recommended.length}종 — 아마존 메인 이미지는 오버레이(텍스트·배지) 금지 규정이 있습니다
          </p>
        )}
        {platform !== 'unset' && platform !== 'amazon-jp' && recommended.length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            {PLATFORM_LABELS[platform]} 추천 문법 밖 템플릿은 플랫폼 관례와 충돌할 수 있습니다 — 선택은 막지 않습니다
          </p>
        )}
        {selected?.needsModel && (
          <p role="status" className="mt-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
            브랜드 보유 모델컷이 있을 때만 쓸 수 있습니다 — 임의 인물은 생성하지 않습니다. 모델컷 업로드는 (추후 기획).
            텍스처 스와치·캐치카피+성분 비주얼형을 권장합니다.
          </p>
        )}
      </section>

      {/* 실적 배지(HOME-05) */}
      <section className="mt-8 rounded-2xl border border-neutral-200">
        <button
          type="button"
          aria-expanded={proofOpen}
          onClick={() => setProofOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold"
        >
          랭킹·수상 실적이 있다면 추가하세요 {selected?.needsProof && <span className="text-[#D93636]">*</span>}
          <span aria-hidden className="text-neutral-400">{proofOpen ? '▲' : '▼'}</span>
        </button>
        <p className="px-4 pb-3 text-xs text-neutral-500">근거가 없으면 배지는 생성되지 않습니다. 이것이 기본값입니다</p>
        {proofOpen && (
          <div className="grid gap-3 border-t border-neutral-100 p-4 sm:grid-cols-3">
            {(
              [
                ['rankTitle', '실적명', '楽天ランキング1位'],
                ['genre', '부문·장르', '日焼け止め'],
                ['aggregationDate', '집계일·기간', '2026/6/14更新 [集計日6/13]'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="text-xs font-medium text-neutral-700">
                {label}
                <input
                  type="text"
                  lang="ja"
                  value={proof[key]}
                  placeholder={placeholder}
                  onChange={(e) => setProof((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
            ))}
            {!proofComplete && (proof.rankTitle || proof.genre || proof.aggregationDate) && (
              <p className="text-xs text-amber-800 sm:col-span-3">실적명·부문·집계일이 모두 있어야 배지가 들어갑니다</p>
            )}
          </div>
        )}
      </section>

      {/* 재설계 고지(HOME-06a) */}
      <section className="mt-8 rounded-2xl bg-[#FFF8F8] p-4 text-sm">
        <p className="font-medium">
          일본어 카피는 자동 번역이 아닙니다 — 한국 카피의 의도를 추출해 일본 고민 어휘·관례어로 재설계하고,{' '}
          <span lang="ja">薬機法</span> 1차 스크리닝을 통과한 문구만 이미지에 들어갑니다.
        </p>
        <p className="mt-1.5 text-xs text-neutral-600">
          「쿨톤 치트키」 → <span lang="ja">「白浮きしない、透け感トーンアップUV」</span>{' '}
          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#D93636]">예시</span>
        </p>
      </section>

      {/* 최근 생성 스트립(HOME-07) — 자산 0건이면 영역 미출력 */}
      {meta && meta.recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold">최근 생성</h2>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {meta.recent.map((a) =>
              a.status === 'generating' ? (
                <Link
                  key={a.id}
                  href={`/app/studio/thumbnail/${a.id}`}
                  role="status"
                  aria-live="polite"
                  className="relative block h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-neutral-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.originalUrl} alt="" aria-hidden className="h-full w-full object-cover opacity-40 blur-sm" />
                  <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] font-medium text-neutral-700">
                    {a.stage ? STUDIO_STAGE_LABELS[a.stage] ?? a.stage : '대기 중'}
                  </span>
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 animate-pulse bg-[#FF6464]" />
                </Link>
              ) : (
                <Link key={a.id} href={`/app/studio/thumbnail/${a.id}`} className="block w-32 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.imageUrl ?? a.originalUrl}
                    alt={`${a.styleName} 썸네일`}
                    className={`h-32 w-32 rounded-xl border border-neutral-200 object-cover ${a.status === 'failed' ? 'opacity-40' : ''}`}
                  />
                  <p className="mt-1 truncate text-[11px] text-neutral-600">
                    {a.status === 'failed' ? '생성 실패 — ' : ''}
                    {a.styleName}
                  </p>
                </Link>
              ),
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            전체 자산은 ③ 운영 자산 라이브러리{' '}
            <Link href="/app/library" className="text-[#D93636] underline">
              자산 라이브러리 열기
            </Link>
          </p>
        </section>
      )}

      {/* 하단 sticky 제출 바(HOME-06b·6c) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <p className={`text-xs ${canSubmit ? 'text-neutral-500' : 'text-neutral-600'}`}>{guidance}</p>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => void handleSubmit()}
            className={`rounded-lg px-6 py-2.5 text-sm font-bold text-white ${
              canSubmit && !submitting ? 'bg-[#FF6464] hover:bg-[#D93636]' : 'cursor-not-allowed bg-neutral-300'
            }`}
          >
            {submitting ? '생성 시작 중…' : '일본향 썸네일 생성'}
          </button>
        </div>
        {submitError && (
          <p role="alert" className="mx-auto mt-2 max-w-4xl text-xs text-[#B3271D]">
            {submitError}
          </p>
        )}
      </div>
    </main>
  );
}
