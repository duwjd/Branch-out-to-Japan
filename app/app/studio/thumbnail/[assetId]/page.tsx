'use client';

/**
 * ② 생성 결과 상세(RESULT-00~07) — 제출 직후 생성중 상태로 시작해 완료 시 결과로 전환.
 * /app/report/[id]의 폴링 문법 미러(2.5초 · 터미널 상태에서 정지).
 * 화면 정본: Figma 마케팅 스튜디오_썸네일 생성 결과 / 생성 실패 / 컨텐츠 생성 로딩(2026-08-18).
 * 좌: 생성 이미지 · 우: 제품명 → 원본 요약 → 카피 해설 카드(일본어 / 대응 한국어 원문 / 재설계 근거).
 */

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PLATFORM_LABELS, STUDIO_STAGE_LABELS, type Platform } from '@/lib/studio/platform';
import type { ExplanationJson, GateResult, GeneratedAssetStatus, PromoInput, ThumbnailProof } from '@/lib/db/store';
import { EmptyState, StatusBadge, buttonClass, cardClass } from '@/components/ui/primitives';
import { ContentBadge, StudioPageHeading, StudioSection, studioButtonClass } from '@/components/app/studioUi';
import { GateBadges, IndetBar, StageList } from '@/components/ui/progress';
import { IconAlertTriangle, IconCheck, IconChevronDown, IconChevronUp, IconDownload } from '@/components/ui/icons';
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

/** 로딩 카드 서브라인 — 단계 라벨과 달리 "지금 무슨 일이 벌어지는가"를 말한다 */
const LOADING_SUBLINE = '일본 고객 관점으로 카피 재설계 중';

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

/**
 * 실패 원인 → 사용자가 다음 행동을 고를 수 있는 문장(RESULT-06b).
 * 원문(asset.error)은 모델 SDK 메시지나 내부 사정이 섞여 있어 그대로 보이면 막다른 길이 된다.
 * 아는 사유는 "무엇 때문에 · 무엇을 하면 되는지"로 바꾸고, 모르는 사유만 일반 문장으로 받는다.
 * @param error 저장된 실패 사유 원문
 */
function failureCopy(error: string | null): string {
  const raw = error ?? '';
  if (/시간이 초과/.test(raw)) {
    return '생성이 예상보다 오래 걸려 중단했습니다. 같은 조건으로 한 번 더 시도하면 대개 통과합니다.';
  }
  if (/원본 이미지|찾을 수 없/.test(raw)) {
    return '올린 이미지를 다시 불러오지 못했습니다. 이미지를 다시 올려 주세요.';
  }
  if (/moderation|정책|안전/i.test(raw)) {
    return '이미지 생성 정책에 걸려 만들지 못했습니다. 인물·문구가 크게 들어간 컷이라면 제품 단독컷으로 바꿔 보세요.';
  }
  if (/rate|quota|한도|429/i.test(raw)) {
    return '지금 생성 요청이 몰려 있습니다. 잠시 뒤에 다시 시도해 주세요.';
  }
  if (/auth|key|인증|401/i.test(raw)) {
    return '이미지 생성 연결에 문제가 있습니다. 잠시 뒤에도 같으면 운영팀에 알려 주세요.';
  }
  return '썸네일을 만드는 도중 문제가 생겼습니다. 같은 조건으로 다시 시도하거나 템플릿을 바꿔 만들어 보세요.';
}

/** 카피 해설 카드 1장 — 일본어 카피 / 대응 한국어 원문 / 재설계 근거 (+ 각주가 있으면 한 줄 더) */
function AfterCard({ slot }: { slot: ExplanationJson['copySlots'][number] }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-[12px] border border-coral bg-canvas p-7 max-sm:p-5">
      <p lang="ja" className="text-[16px] leading-[1.5] font-semibold text-ink [text-wrap:pretty]">
        {slot.ja}
      </p>
      {slot.krSource && <p className="text-[14px] leading-[1.6] text-ink [text-wrap:pretty]">{slot.krSource}</p>}
      {slot.rationale && (
        <p className="flex gap-2.5 text-[12px] leading-[1.5] text-ink-mute">
          <IconCheck size={18} className="mt-px flex-none text-coral" />
          <span className="[text-wrap:pretty]">{slot.rationale}</span>
        </p>
      )}
      {slot.footnote && (
        <p lang="ja" className="border-t border-hairline pt-2.5 text-[12px] leading-[1.5] text-ink-faint">
          {slot.footnote}
        </p>
      )}
    </li>
  );
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
        <div className="mx-auto max-w-[1280px] px-8 py-16">
          <EmptyState
            title="썸네일을 찾을 수 없습니다"
            desc="주소의 자산 번호를 확인해 주세요. 스튜디오에서 다시 열어볼 수 있습니다."
            action={
              <Link href="/app/studio/thumbnail" className={buttonClass('primary', 'md', 'no-underline')}>
                썸네일 만들기로 →
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const explanation = asset?.explanationJson ?? null;
  // 플랫폼을 안 고르고 만들 수 있다 — 그때는 "미정"을 화면에 쓰지 않고 아예 뺀다
  const hasPlatform = Boolean(asset && asset.platform && asset.platform !== 'unset');
  const platformLabel = asset ? (PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform) : '';

  return (
    <main className="animate-fade-up">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-8 pt-[72px] pb-32 max-sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/app/studio/thumbnail"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-mute no-underline transition-colors hover:text-ink"
          >
            <span aria-hidden>←</span> 썸네일 만들기
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

        {/* ── 생성중(RESULT-06a) — 카드 하나로 상태를 다 말한다 ─────────── */}
        {asset?.status === 'generating' && (
          <div role="status" aria-live="polite" className={cardClass('mx-auto max-w-[1080px] p-11 max-sm:p-6')}>
            <h1 className="text-center text-xl leading-[1.4] font-extrabold tracking-[-0.01em] text-ink">
              일본향 썸네일을 만들고 있습니다…
            </h1>
            <p className="mt-1 text-center text-[14.5px] font-semibold text-coral-strong">{LOADING_SUBLINE}</p>

            {/* 업로드 원본을 흐리게 깔고 그 위로 사선 하이라이트가 지나간다 */}
            <div className="mx-auto mt-5 h-[298px] w-[298px] max-w-full overflow-hidden rounded-[18px] border border-card-border bg-n-200 shadow-card">
              <div className="relative h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.originalUrl} alt="" aria-hidden className="h-full w-full scale-110 object-cover opacity-70 blur-[9px]" />
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.72),transparent)]"
                />
              </div>
            </div>

            <IndetBar className="mt-6" />

            <StageList
              stages={STAGE_LABELS}
              activeIdx={stageIndexOf(asset.stage)}
              className="mt-5 border-t border-hairline pt-5"
            />

            <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ink-mute">
              몇 분 걸릴 수 있어요. 이 화면을 벗어나도 생성은 계속됩니다.
            </p>
          </div>
        )}

        {/* ── 실패(Figma 1:12134 · 1:12219) ────────────────────────────── */}
        {asset?.status === 'failed' && (
          <>
            <StudioPageHeading
              title="썸네일 생성 결과"
              descTone="mute"
              desc="한국 썸네일 또는 제품 단독컷 1장을 올려 주세요. 제품이 선명하고 가려지지 않아야 하며, 카피·뱃지가 있는 프로모 썸네일이어도 됩니다."
            />
            <StudioSection title="이미지 생성 실패">
              {/* Error Splash — 코랄 틴트 위에 원형 아이콘 + 사유 두 줄 */}
              <div className="flex items-center gap-4 rounded-[20px] bg-coral-tint p-5">
                <span
                  aria-hidden
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[rgba(255,84,73,0.12)] text-coral-strong"
                >
                  <IconAlertTriangle />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-[18px] font-bold text-coral-strong">썸네일 생성 실패</p>
                  <p className="text-[13px] leading-[1.5] text-cool-50 [text-wrap:pretty]">{failureCopy(asset.error)}</p>
                </div>
              </div>

              <div className="flex gap-6 max-sm:flex-col">
                <Link
                  href={`/app/studio/thumbnail?from=${asset.id}&style=${asset.styleCategory}`}
                  className="inline-flex flex-1 items-center justify-center rounded-[8px] bg-coral px-[22px] py-[13px] text-[15px] font-semibold text-white no-underline transition-colors hover:bg-coral-hover"
                >
                  다시 시도
                </Link>
                <Link
                  href="/app/studio"
                  className="inline-flex flex-1 items-center justify-center rounded-[8px] border border-coral bg-canvas px-[22px] py-[13px] text-[15px] font-semibold text-coral-strong no-underline transition-colors hover:bg-coral-tint"
                >
                  메인페이지
                </Link>
              </div>

              {asset.error && (
                <details className="border-t border-hairline pt-4">
                  <summary className="cursor-pointer text-[12px] font-semibold text-ink-mute">기술 정보 보기</summary>
                  <p className="mt-2 text-[12px] leading-relaxed break-words text-ink-faint">{asset.error}</p>
                </details>
              )}
            </StudioSection>
          </>
        )}

        {/* ── 완료(RESULT-01~05) ───────────────────────────────────────── */}
        {asset?.status === 'done' && asset.imageUrl && (
          <>
            <StudioPageHeading
              title="썸네일 생성 결과"
              descTone="mute"
              desc="한국 썸네일을 그대로 옮기지 않았습니다. 아래에서 어떤 문구를 왜 바꿨는지 확인해 보세요."
            />

            {/* 목 모드 이미지 고지(RESULT-01) — 작은 배지로 흘리지 않고 상단 배너로 명시 */}
            {asset.imageMode === 'mock' && (
              <div role="note" className="rounded-[10px] border border-amber bg-amber-bg px-4 py-3 text-[12.5px] leading-relaxed text-amber-text">
                <b className="font-bold">데모 이미지입니다.</b> 올린 제품컷이 반영되지 않은 샘플이며 다운로드 파일명에 <code>-demo</code>가 붙습니다. 이미지 API를 연결하면 실제 생성이 동작합니다.
              </div>
            )}

            <StudioSection
              title="생성된 이미지"
              desc={`${hasPlatform ? `${platformLabel} 기준 ` : ''}${asset.styleName} 문법으로 재설계한 결과입니다. 원본은 왼쪽 아래에서 비교할 수 있어요.`}
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,667px)_minmax(0,523px)]">
                {/* 좌 — 생성 이미지 + 원본 대조 */}
                <div>
                  <div className="relative aspect-square overflow-hidden rounded-card border border-card-border bg-n-200 shadow-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.imageUrl}
                      alt={`${asset.styleName}으로 재설계된 ${asset.brandNameSnapshot} 일본향 썸네일`}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-start gap-3">
                    <figure className="m-0 w-[104px]">
                      <div className="aspect-square overflow-hidden rounded-[10px] border border-card-border bg-n-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.originalUrl} alt="올린 원본 이미지" className="h-full w-full object-cover" />
                      </div>
                      <figcaption className="mt-1.5 text-center text-[11.5px] font-bold text-ink-mute">
                        {asset.modelImageUrl ? '원본 · 제품컷' : '원본'}
                      </figcaption>
                    </figure>
                    {asset.modelImageUrl && (
                      <figure className="m-0 w-[104px]">
                        <div className="aspect-square overflow-hidden rounded-[10px] border border-card-border bg-n-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={asset.modelImageUrl} alt="올린 모델컷" className="h-full w-full object-cover" />
                        </div>
                        <figcaption className="mt-1.5 text-center text-[11.5px] font-bold text-ink-mute">모델컷</figcaption>
                      </figure>
                    )}
                    {asset.gateResult && (
                      <div className="min-w-[180px] flex-1">
                        <StatusBadge tone="ok">검수 게이트 통과 ○</StatusBadge>
                        <GateBadges
                          items={asset.gateResult.checks.map((c) => ({ label: c.label, pass: c.pass !== false }))}
                          className="mt-2"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 우 — 제품명 → 원본 요약 → 카피 해설 → 다운로드 */}
                <div className="flex flex-col gap-[17px]">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-2xl leading-[1.4] font-bold text-ink [text-wrap:pretty]">
                        {explanation?.productName || asset.brandNameSnapshot}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <ContentBadge tone="violet">{asset.styleName}</ContentBadge>
                        <span className="text-[12.5px] text-ink-mute">
                          {hasPlatform ? `${platformLabel} · ` : ''}
                          {asset.createdAt.slice(0, 10)}
                        </span>
                        {asset.llmMode === 'mock' && <StatusBadge tone="warn">데모 해설 · 실제 진단이 아닙니다</StatusBadge>}
                      </div>
                    </div>
                    {explanation?.beforeSummary && (
                      <p className="text-[14px] leading-[1.6] text-ink-body [text-wrap:pretty]">{explanation.beforeSummary}</p>
                    )}
                  </div>

                  {explanation && explanation.copySlots.length > 0 && (
                    <section className="flex flex-col gap-[13px] rounded-[12px] bg-n-100 p-5">
                      <h4 className="text-[16px] leading-[1.5] font-semibold text-ink">카피 해설</h4>
                      <ul className="flex list-none flex-col gap-[13px]">
                        {explanation.copySlots.map((slot) => (
                          <AfterCard key={slot.slotKey} slot={slot} />
                        ))}
                      </ul>
                    </section>
                  )}

                  <div className="mt-6 flex-1" aria-hidden />

                  <div className="flex flex-col gap-2.5">
                    <button type="button" onClick={() => void handleDownload()} className={studioButtonClass('primary', 'w-full')}>
                      <IconDownload size={18} />
                      이미지 다운로드
                    </button>
                    <p className="text-[12px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                      AI 생성 이미지는 제안·데모용입니다. 실제 게시에 쓸 제품 본체 컷은 브랜드 실촬영을 권장합니다.
                    </p>
                    <Link
                      href={`/app/studio/thumbnail?from=${asset.id}`}
                      className="text-[13px] font-semibold text-coral-strong hover:underline"
                    >
                      같은 이미지로 다른 템플릿 만들기 →
                    </Link>
                  </div>
                </div>
              </div>
            </StudioSection>

            {/* 자세한 재설계 근거 — 기본 접힘(점진적 공개). 원본 요소 처리 표 + 배지 고지 */}
            {explanation && (
              <section className={cardClass('overflow-hidden')}>
                <button
                  type="button"
                  aria-expanded={detailOpen}
                  onClick={() => setDetailOpen((v) => !v)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-6 py-4 text-left"
                >
                  <h2 className="text-[14px] font-extrabold text-ink">무엇을 바꿨는지 자세히 보기</h2>
                  {explanation.krElementMap.length > 0 &&
                    (() => {
                      const c = legendCounts(explanation.krElementMap);
                      return (
                        <span className="flex flex-wrap gap-1.5">
                          {c.remove > 0 && (
                            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-danger-bg px-2.5 text-[11.5px] font-bold text-danger-text">
                              ✕ 제거 {c.remove}
                            </span>
                          )}
                          {c.redesign > 0 && (
                            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-bg px-2.5 text-[11.5px] font-bold text-amber-text">
                              △ 재설계 {c.redesign}
                            </span>
                          )}
                          {c.keep > 0 && (
                            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-green-bg px-2.5 text-[11.5px] font-bold text-green-text">
                              ○ 유지 {c.keep}
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  <span aria-hidden className="ml-auto text-ink-faint">
                    {detailOpen ? <IconChevronUp /> : <IconChevronDown />}
                  </span>
                </button>
                {detailOpen && (
                  <div className="border-t border-hairline px-6 pb-6 animate-fade-in">
                    {explanation.styleReason && (
                      <p className="mt-4 text-[13.5px] leading-[1.75] text-ink-body [text-wrap:pretty]">
                        {explanation.styleReason}
                      </p>
                    )}

                    {!asset.proof && (
                      <p className="mt-4 rounded-[8px] bg-amber-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-text">
                        실적을 입력하지 않아 배지 없이 만들었습니다. 배지 없음이 기본값이고 근거를 입력하면 배지가 들어갑니다.
                      </p>
                    )}

                    {explanation.krElementMap.length > 0 && (
                      <>
                        <h3 className="mt-6 text-[13px] font-extrabold text-ink">원본 요소를 어떻게 처리했나</h3>
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
                              {explanation.krElementMap.map((row, i) => {
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
            )}
          </>
        )}
      </div>
    </main>
  );
}
