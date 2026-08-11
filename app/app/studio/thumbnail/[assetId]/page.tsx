'use client';

/**
 * ② 생성 결과 상세(RESULT-00~07) — 제출 직후 생성중 상태로 시작해 완료 시 결과로 전환.
 * /app/report/[id]의 폴링 문법 미러(2.5초 · 터미널 상태에서 정지).
 * 디자인 정본: docs/specs/02-studio/2-result.html
 */

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PLATFORM_LABELS, STUDIO_STAGE_LABELS, type Platform } from '@/lib/studio/platform';
import type { ExplanationJson, GateResult, GeneratedAssetStatus, PromoInput, ThumbnailProof } from '@/lib/db/store';
import { EmptyState, Skeleton, StatusBadge, buttonClass, cardClass } from '@/components/ui/primitives';
import { GateBadges, StageList } from '@/components/ui/progress';
import { IconChevronDown, IconChevronUp } from '@/components/ui/icons';
import { bytesUrl } from '@/lib/files/downloadUrl';

interface AssetPayload {
  id: string;
  status: GeneratedAssetStatus;
  stage: string | null;
  error: string | null;
  styleCategory: string;
  styleName: string;
  platform: string;
  gateResult: GateResult | null;
  explanationJson: ExplanationJson | null;
  proof: ThumbnailProof | null;
  modelImagePath: string | null;
  modelConsent: boolean;
  promoInput: PromoInput | null;
  brandNameSnapshot: string;
  createdAt: string;
  storeKind: 'supabase' | 'file';
  imageMode: 'real' | 'mock';
  llmMode: 'real' | 'mock';
  imageUrl: string | null;
  originalUrl: string;
  /** F 모델+카피형 Before 병기용 — 모델컷 없으면 null */
  modelImageUrl: string | null;
}

/** 생성중 파이프라인 단계 순서 — analyze가 분석+카피 재설계를 겸한다(STUDIO_STAGE_LABELS 정의) */
const STAGE_ORDER = ['analyze', 'assemble', 'generate', 'gate'] as const;
const STAGE_LABELS = STAGE_ORDER.map((key) => STUDIO_STAGE_LABELS[key]);

/** 현재 단계 인덱스 — 미상이면 -1(전부 대기) */
function stageIndexOf(stage: string | null): number {
  return stage ? STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]) : -1;
}

/** 무엇을 바꿨나(RESULT-03) 처리 분류 → 색+글자+기호 배지 */
const ACTION_BADGE: Record<ExplanationJson['krElementMap'][number]['action'], { cls: string; mark: string }> = {
  '유지·정제': { cls: 'bg-green-bg text-green-text', mark: '○' },
  재설계: { cls: 'bg-amber-bg text-amber-text', mark: '△' },
  제거: { cls: 'bg-danger-bg text-danger-text', mark: '✕' },
};

/** RESULT-01 1e · 변경 요약 레전드 카운트 — krElementMap 처리 분류(제거/재설계/유지) 집계 */
function legendCounts(map: ExplanationJson['krElementMap']) {
  return {
    remove: map.filter((r) => r.action === '제거').length,
    redesign: map.filter((r) => r.action === '재설계').length,
    keep: map.filter((r) => r.action === '유지·정제').length,
  };
}

export default function StudioResultPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params);
  const [asset, setAsset] = useState<AssetPayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/studio/thumbnail/${assetId}`, { cache: 'no-store' });
      if (res.status === 404) {
        setNotFound(true);
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data: AssetPayload = await res.json();
      setAsset(data);
      setFetchError(null);
      if (data.status !== 'generating' && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {
      setFetchError(String((err as Error).message));
    }
  }, [assetId]);

  useEffect(() => {
    void poll();
    timerRef.current = setInterval(() => void poll(), 2500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  /** 다운로드(RESULT-04) — 파일명 "{브랜드명}-{스타일 평문}-{플랫폼}[-demo].png". 목 모드는 데모 표기 전파 */
  async function handleDownload() {
    if (!asset?.imageUrl) return;
    const res = await fetch(bytesUrl(asset.imageUrl));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const demoSuffix = asset.imageMode === 'mock' ? '-demo' : '';
    a.download = `${asset.brandNameSnapshot}-${asset.styleName}-${PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform}${demoSuffix}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (notFound) {
    return (
      <main className="animate-fade-up">
        <div className="mx-auto max-w-[640px] px-6 py-16">
          <EmptyState
            title="썸네일을 찾을 수 없습니다"
            action={
              <Link href="/app/studio/thumbnail" className={buttonClass('primary', 'md', 'no-underline')}>
                스튜디오 홈으로 →
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[1120px] px-6 pt-11 pb-24 max-sm:px-5">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <Link href="/app/studio/thumbnail" className="text-[12.5px] font-bold text-coral-strong hover:underline">
            ← 스튜디오 홈
          </Link>
          {asset?.storeKind === 'file' && <StatusBadge tone="off">로컬 저장(dev)</StatusBadge>}
        </div>

        {!asset && !fetchError && (
          <p role="status" className="text-sm text-ink-mute">
            불러오는 중…
          </p>
        )}
        {fetchError && (
          <p role="alert" className="rounded-card border border-danger/35 bg-danger-bg p-3.5 text-sm text-danger-text">
            {fetchError}
          </p>
        )}

        {/* 생성중(RESULT-06a) */}
        {asset?.status === 'generating' && (
          <div className="grid gap-9 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start">
            <div className="lg:sticky lg:top-6">
              <div className="relative aspect-square overflow-hidden rounded-card border border-card-border bg-n-200 shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.originalUrl} alt="" aria-hidden className="h-full w-full scale-110 object-cover opacity-40 blur-md" />
                <span
                  aria-hidden
                  className="absolute inset-0 animate-shimmer bg-[length:840px_100%] bg-no-repeat bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,.62)_50%,transparent_80%)]"
                />
              </div>
              <div role="status" aria-live="polite" className={cardClass('mt-3.5 p-5')}>
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="h-[18px] w-[18px] flex-none animate-spin rounded-full border-[2.5px] border-coral border-t-transparent" />
                  <h2 className="text-[14.5px] font-extrabold text-ink">
                    {asset.stage ? (STUDIO_STAGE_LABELS[asset.stage] ?? asset.stage) : '대기 중'}
                  </h2>
                </div>
                <StageList stages={STAGE_LABELS} activeIdx={stageIndexOf(asset.stage)} className="mt-3.5 border-t border-hairline pt-3" />
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-mute">완료되면 이 페이지가 결과로 바뀝니다. 다른 작업을 하셔도 됩니다.</p>
            </div>

            <div>
              <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">생성 결과</p>
              <h1 className="mt-2 text-2xl leading-[1.35] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
                일본향 썸네일을 생성하고 있습니다…
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full border border-coral/35 bg-coral-tint px-2.5 text-xs font-bold text-coral-strong">
                  {asset.styleName}
                </span>
                <span className="text-[12.5px] text-ink-mute">{PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform}</span>
              </div>

              {/* 해설 자리 스켈레톤 — 아직 없는 데이터라는 것을 명시적으로 보인다 */}
              <div aria-hidden className="mt-6 space-y-3.5">
                <Skeleton className="h-[76px]" />
                <Skeleton className="h-[132px]" />
                <Skeleton className="h-24" />
              </div>
            </div>
          </div>
        )}

        {/* 실패(RESULT-06b) */}
        {asset?.status === 'failed' && (
          <div className="grid gap-9 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start">
            <div className="lg:sticky lg:top-6">
              <div className="relative aspect-square overflow-hidden rounded-card border-[1.5px] border-danger/50 bg-danger-bg shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.originalUrl} alt="" aria-hidden className="h-full w-full object-cover opacity-60 grayscale blur-md" />
                <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-danger-bg/80 p-6 text-center">
                  <span aria-hidden className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-danger text-xl font-extrabold text-white">
                    ✕
                  </span>
                  <span className="text-[16px] font-extrabold text-danger-text">생성 실패</span>
                </span>
              </div>
            </div>

            <div>
              <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">생성 결과</p>
              <h1 className="mt-2 text-2xl leading-[1.35] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
                썸네일 생성에 실패했습니다
              </h1>

              <div className="mt-4.5 rounded-card border border-danger/35 bg-canvas p-5 shadow-card">
                <p className="text-[13.5px] font-bold text-danger-text">생성 중 오류가 발생했습니다</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-body [text-wrap:pretty]">{asset.error}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link href={`/app/studio/thumbnail?from=${asset.id}&style=${asset.styleCategory}`} className={buttonClass('primary', 'md', 'no-underline')}>
                  다시 시도
                </Link>
                <Link href="/app/studio/thumbnail" className={buttonClass('secondary', 'md', 'no-underline')}>
                  스튜디오 홈으로
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 완료(RESULT-01~05) */}
        {asset?.status === 'done' && asset.imageUrl && (
          <div className="grid gap-9 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start">
            <div className="lg:sticky lg:top-6">
              {/* 목 모드 이미지 고지(RESULT-01) — 작은 배지로 흘리지 않고 상단 배너로 명시 */}
              {asset.imageMode === 'mock' && (
                <div role="note" className="mb-3.5 rounded-[10px] border border-amber bg-amber-bg px-4 py-3 text-[12.5px] leading-relaxed text-amber-text">
                  <b className="font-bold">데모 이미지입니다.</b> 업로드한 제품컷이 반영되지 않은 샘플이며, 다운로드 파일명에 <code>-demo</code>가 붙습니다. 실제 생성은 이미지 API 연결 후 동작합니다.
                </div>
              )}
              {/* RESULT-01 1a · 입력 원본(Before) ↔ 생성 결과(After) 대등 병기 (2026-07-24) */}
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <figure className="m-0 flex min-w-0 flex-col gap-2">
                  <div className="relative aspect-square overflow-hidden rounded-card border border-card-border bg-n-200 shadow-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.originalUrl} alt="입력 원본 이미지" className="h-full w-full object-cover" />
                  </div>
                  <figcaption className="m-0 text-center text-[12px] font-bold text-ink-mute">
                    {asset.modelImageUrl ? '입력 원본 · 제품컷' : '입력 원본'}
                  </figcaption>
                  {/* 모델+카피형 — 제품컷과 함께 모델컷도 입력 원본으로 병기 */}
                  {asset.modelImageUrl && (
                    <>
                      <div className="relative aspect-square overflow-hidden rounded-card border border-card-border bg-n-200 shadow-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.modelImageUrl} alt="입력 모델컷" className="h-full w-full object-cover" />
                      </div>
                      <figcaption className="m-0 text-center text-[12px] font-bold text-ink-mute">모델컷</figcaption>
                    </>
                  )}
                </figure>
                <figure className="m-0 flex min-w-0 flex-col gap-2">
                  <div className="relative aspect-square overflow-hidden rounded-card border border-card-border bg-n-200 shadow-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.imageUrl}
                      alt={`${asset.styleName}으로 재설계된 ${asset.brandNameSnapshot} 일본향 썸네일`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <figcaption className="m-0 text-center text-[12px] font-bold text-ink-mute">생성 결과</figcaption>
                </figure>
              </div>

              {asset.gateResult && (
                <div className={cardClass('mt-3.5 p-4')}>
                  <StatusBadge tone="ok">검수 게이트 통과 ○</StatusBadge>
                  <GateBadges
                    items={asset.gateResult.checks.map((c) => ({ label: c.label, pass: asset.gateResult!.passed }))}
                    className="mt-2.5"
                  />
                </div>
              )}

              <button type="button" onClick={() => void handleDownload()} className={buttonClass('primary', 'lg', 'mt-3.5 w-full')}>
                이미지 다운로드 (PNG · 1024×1024)
              </button>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                AI 생성 이미지는 제안·데모용입니다. 플랫폼 게시용 제품 본체 컷은 브랜드 실촬영을 권장합니다
              </p>

              <div className="mt-4 border-t border-hairline pt-4">
                <Link href={`/app/studio/thumbnail?from=${asset.id}`} className="text-[13px] font-semibold text-coral-strong hover:underline">
                  같은 이미지로 다른 템플릿 생성 →
                </Link>
              </div>
            </div>

            <div>
              <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">생성 결과</p>
              <h1 className="mt-2 text-2xl leading-[1.35] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
                {asset.brandNameSnapshot} — 일본향 썸네일
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full border border-coral/35 bg-coral-tint px-2.5 text-xs font-bold text-coral-strong">
                  {asset.styleName}
                </span>
                <span className="text-[12.5px] text-ink-mute">
                  {PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform} · {asset.createdAt.slice(0, 10)}
                </span>
              </div>

              {/* 재설계 해설(RESULT-01·02·03) — 스캔형 재구성(2026-07-24) */}
              {asset.explanationJson && (
                <>
                  {/* RESULT-01 1e · 무엇이 달라졌나 한 줄 요약 */}
                  <p className="mt-4.5 text-[14px] leading-[1.7] text-ink-body [text-wrap:pretty]">
                    {asset.explanationJson.styleReason}
                    {asset.llmMode === 'mock' && (
                      <span className="ml-1.5 inline-flex h-5 items-center rounded-full bg-amber-bg px-2.5 align-middle text-[11px] font-bold text-amber-text">
                        데모 해설 · 실제 진단이 아닙니다
                      </span>
                    )}
                  </p>

                  {/* RESULT-01 · 변경 요약 레전드 (제거/재설계/유지 카운트 — 상세는 아코디언 표) */}
                  {asset.explanationJson.krElementMap.length > 0 &&
                    (() => {
                      const c = legendCounts(asset.explanationJson.krElementMap);
                      return (
                        <div className="mt-3.5 flex flex-wrap gap-2" role="list" aria-label="원본 요소 처리 요약">
                          {c.remove > 0 && (
                            <span role="listitem" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-danger-bg px-3 text-[12.5px] font-bold text-danger-text">
                              ✕ 제거 <b className="font-extrabold">{c.remove}</b>
                            </span>
                          )}
                          {c.redesign > 0 && (
                            <span role="listitem" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-amber-bg px-3 text-[12.5px] font-bold text-amber-text">
                              △ 재설계 <b className="font-extrabold">{c.redesign}</b>
                            </span>
                          )}
                          {c.keep > 0 && (
                            <span role="listitem" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-green-bg px-3 text-[12.5px] font-bold text-green-text">
                              ○ 유지 <b className="font-extrabold">{c.keep}</b>
                            </span>
                          )}
                        </div>
                      );
                    })()}

                  {/* RESULT-02b · 핵심 카피 재설계 컴팩트 칩 (KR 의도 → JP 재설계) */}
                  {asset.explanationJson.copySlots.length > 0 && (
                    <>
                      <p className="mt-5 text-[11.5px] font-bold tracking-[0.01em] text-ink-mute">핵심 카피 재설계 · KR → JP</p>
                      <div className="mt-2 space-y-2">
                        {asset.explanationJson.copySlots.map((slot) => (
                          <div key={slot.slotKey} className="rounded-[10px] border border-hairline p-3">
                            <div className="flex items-center justify-between gap-2.5">
                              <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink-mute">{slot.krIntent}</p>
                              {slot.footnote && (
                                <span className="inline-flex h-5 flex-none items-center rounded-full bg-n-100 px-2 text-[11px] font-bold text-ink-body">※ 각주</span>
                              )}
                            </div>
                            <p lang="ja" className="mt-1.5 text-[14px] leading-[1.5] font-extrabold text-ink">
                              {slot.ja}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* RESULT-02·03 · 자세한 재설계 근거 — 기본 접힘(점진적 공개). 슬롯 상세 + 원본 요소 처리 표 통합 */}
                  <section className={cardClass('mt-4 overflow-hidden')}>
                    <button
                      type="button"
                      aria-expanded={detailOpen}
                      onClick={() => setDetailOpen((v) => !v)}
                      className="flex w-full items-center gap-2.5 px-5 py-4 text-left sm:px-[22px]"
                    >
                      <h2 className="text-[14px] font-extrabold text-ink">자세한 재설계 근거 보기</h2>
                      {asset.llmMode === 'mock' && <StatusBadge tone="warn">데모 해설</StatusBadge>}
                      <span aria-hidden className="ml-auto text-ink-faint">
                        {detailOpen ? <IconChevronUp /> : <IconChevronDown />}
                      </span>
                    </button>
                    {detailOpen && (
                      <div className="border-t border-hairline px-5 pb-5 sm:px-[22px]">
                        {/* 카피는 이렇게 재설계됐다 — 슬롯별 근거 */}
                        <h3 className="mt-4 text-[13px] font-extrabold text-ink">카피는 이렇게 재설계됐다</h3>
                        <div className="mt-2.5 space-y-3">
                          {asset.explanationJson.copySlots.map((slot) => (
                            <div key={slot.slotKey} className="rounded-[10px] border border-hairline p-3.5">
                              <p lang="ja" className="text-[15px] leading-[1.5] font-extrabold text-ink">
                                {slot.ja}
                              </p>
                              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-mute">
                                <span className="font-bold text-ink-body">한국 카피 의도</span> — {slot.krIntent}
                              </p>
                              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-mute">
                                <span className="font-bold text-ink-body">근거</span> — {slot.rationale}
                              </p>
                              {slot.footnote && (
                                <p lang="ja" className="mt-1 text-[12px] text-ink-faint">각주 — {slot.footnote}</p>
                              )}
                            </div>
                          ))}
                          {!asset.proof && (
                            <p className="rounded-[8px] bg-amber-bg px-3 py-2.5 text-[12px] leading-relaxed text-amber-text">
                              실적을 입력하지 않아 배지 없이 생성됐습니다. 배지 없음이 기본값이고, 근거를 입력하면 배지가 들어갑니다.
                            </p>
                          )}
                        </div>

                        {/* 무엇을 바꿨나 · 원본 요소 처리 표 */}
                        {asset.explanationJson.krElementMap.length > 0 && (
                          <>
                            <h3 className="mt-5 text-[13px] font-extrabold text-ink">무엇을 바꿨나 · 원본 요소 처리</h3>
                            <div className="mt-2.5 overflow-x-auto">
                              <table className="w-full min-w-[460px] border-collapse text-[12.5px]">
                                <thead>
                                  <tr className="text-left text-ink-mute">
                                    <th className="py-2 pr-2.5 font-bold">원본 요소</th>
                                    <th className="w-[92px] py-2 pr-2.5 font-bold">처리</th>
                                    <th className="py-2 font-bold">근거</th>
                                  </tr>
                                </thead>
                                <tbody className="text-ink-body">
                                  {asset.explanationJson.krElementMap.map((row, i) => {
                                    const badge = ACTION_BADGE[row.action];
                                    return (
                                      <tr key={i} className="border-t border-n-200 align-top">
                                        <td className="py-2.5 pr-2.5">{row.element}</td>
                                        <td className="py-2.5 pr-2.5">
                                          <span className={`inline-flex h-[21px] items-center rounded-full px-2 text-[11px] font-bold ${badge.cls}`}>
                                            {badge.mark} {row.action}
                                          </span>
                                        </td>
                                        <td className="py-2.5 leading-relaxed">{row.reason}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
