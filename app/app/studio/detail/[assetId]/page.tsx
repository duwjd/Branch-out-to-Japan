'use client';

/**
 * 상세페이지 생성 결과(RESULT-D01~06) — 생성중 폴링 → 완료/실패 3분기.
 * 썸네일 결과 화면과 달리 블록 단위 진행률("블록 7/14")과 블록별 재생성을 다룬다.
 */

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DETAIL_STAGE_LABELS, PLATFORM_LABELS } from '@/lib/studio/platform';
import { SectionCard, StatusBadge, buttonClass, cardClass } from '@/components/ui/primitives';
import { GateBadges, IndetBar } from '@/components/ui/progress';
import { IconDownload } from '@/components/ui/icons';

interface BlockView {
  id: string;
  seq: number;
  blockType: string;
  code: string;
  nameKo: string;
  role: string;
  renderKind: 'text' | 'ai-visual' | 'hybrid';
  status: 'pending' | 'generating' | 'done' | 'failed' | 'skipped';
  error: string | null;
  height: number | null;
  version: number;
  canRevert: boolean;
  slots: Record<string, string>;
  imageUrl: string | null;
}

interface DetailAssetView {
  id: string;
  status: 'generating' | 'done' | 'failed';
  stage: string | null;
  error: string | null;
  styleName: string;
  platform: string;
  brandNameSnapshot: string;
  blockTotal: number;
  blockDone: number;
  imageUrl: string | null;
  originalUrl: string;
  sliceUrls: string[];
  imageMode: 'real' | 'mock';
  gateResult: { passed: boolean; checks: { key: string; label: string; note: string; pass?: boolean }[] } | null;
  explanationJson: {
    styleReason: string;
    copySlots: { slotKey: string; ja: string; krIntent: string; rationale: string; footnote: string }[];
    krElementMap: { element: string; action: string; reason: string }[];
  } | null;
  blocks: BlockView[];
}

const POLL_MS = 2500;

export default function DetailResultPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params);
  const [asset, setAsset] = useState<DetailAssetView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busyBlock, setBusyBlock] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/studio/detail/${assetId}`);
    if (res.status === 404) {
      setNotFound(true);
      if (timer.current) clearInterval(timer.current);
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as DetailAssetView;
    setAsset(data);
    // 블록 재생성 중일 수 있으므로 자산이 done 이어도 블록이 generating 이면 계속 폴링한다
    const blockBusy = data.blocks.some((b) => b.status === 'generating');
    if (data.status !== 'generating' && !blockBusy && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [assetId]);

  useEffect(() => {
    void poll();
    timer.current = setInterval(() => void poll(), POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [poll]);

  /** 폴링이 멈춘 뒤 액션을 하면 다시 켠다 */
  const ensurePolling = () => {
    if (!timer.current) timer.current = setInterval(() => void poll(), POLL_MS);
  };

  const regenerate = async (block: BlockView, mode: 'visual' | 'both') => {
    setBusyBlock(block.id);
    await fetch(`/api/studio/detail/${assetId}/blocks/${block.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate', mode }),
    });
    setBusyBlock(null);
    ensurePolling();
    void poll();
  };

  const revert = async (block: BlockView) => {
    setBusyBlock(block.id);
    await fetch(`/api/studio/detail/${assetId}/blocks/${block.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'revert' }),
    });
    setBusyBlock(null);
    void poll();
  };

  const download = async (url: string, name: string) => {
    const res = await fetch(url);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
  };

  if (notFound) {
    return (
      <main className="mx-auto max-w-[768px] px-6 py-16 text-center">
        <h1 className="text-lg font-bold text-ink">상세페이지를 찾을 수 없습니다.</h1>
        <Link href="/app/studio/detail" className={`${buttonClass('secondary', 'md')} mt-5`}>
          상세페이지 만들기로
        </Link>
      </main>
    );
  }

  if (!asset) {
    return (
      <main className="mx-auto max-w-[768px] px-6 py-16">
        <IndetBar />
      </main>
    );
  }

  const demoSuffix = asset.imageMode === 'mock' ? '-demo' : '';
  const baseName = `${asset.brandNameSnapshot}-상세페이지-${PLATFORM_LABELS[asset.platform as keyof typeof PLATFORM_LABELS] ?? asset.platform}${demoSuffix}`;

  // ── 생성 중 ──────────────────────────────────────────────────────────
  if (asset.status === 'generating') {
    const pct = asset.blockTotal > 0 ? Math.round((asset.blockDone / asset.blockTotal) * 100) : 0;
    return (
      <main className="mx-auto max-w-[768px] px-6 py-10">
        <h1 className="text-[22px] font-bold text-ink">상세페이지를 만들고 있어요</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute">
          {asset.stage ? (DETAIL_STAGE_LABELS[asset.stage] ?? '처리 중') : '처리 중'}
          {asset.blockTotal > 0 && asset.stage === 'blocks' ? ` · 블록 ${asset.blockDone}/${asset.blockTotal}` : ''}
        </p>

        <div className="mt-6">
          {asset.blockTotal > 0 ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-n-150">
              <div className="h-full rounded-full bg-coral transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          ) : (
            <IndetBar />
          )}
        </div>

        {asset.blocks.length > 0 && (
          <ol className="mt-6 space-y-1.5">
            {asset.blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-2.5 text-[13px]">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    b.status === 'done' ? 'bg-green' : b.status === 'failed' ? 'bg-danger' : b.status === 'generating' ? 'bg-coral' : 'bg-n-200'
                  }`}
                />
                <span className={b.status === 'done' ? 'text-ink-body' : 'text-ink-mute'}>{b.nameKo}</span>
                {b.status === 'failed' && <span className="text-xs text-danger-text">실패</span>}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-8 text-xs text-ink-faint">이 화면을 닫아도 생성은 계속됩니다.</p>
      </main>
    );
  }

  // ── 실패 ─────────────────────────────────────────────────────────────
  if (asset.status === 'failed') {
    return (
      <main className="mx-auto max-w-[768px] px-6 py-10">
        <div className={`${cardClass} border-danger/30 bg-danger-bg p-6`}>
          <h1 className="text-lg font-bold text-danger-text">생성하지 못했습니다</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-body [text-wrap:pretty]">{asset.error ?? '알 수 없는 오류'}</p>
        </div>
        <Link href="/app/studio/detail" className={`${buttonClass('primary', 'md')} mt-5`}>
          다시 시도
        </Link>
      </main>
    );
  }

  // ── 완료 ─────────────────────────────────────────────────────────────
  const failedBlocks = asset.blocks.filter((b) => b.status === 'failed');
  // 완료됐지만 사유가 달린 블록 = 배경컷 없이 문자만으로 나간 블록
  const degradedBlocks = asset.blocks.filter((b) => b.status === 'done' && b.error);
  return (
    <main className="mx-auto max-w-[1120px] px-6 py-10">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold text-ink">{asset.styleName}</h1>
        {asset.imageMode === 'mock' && <StatusBadge tone="warn">데모 모드</StatusBadge>}
        {asset.gateResult && (
          <StatusBadge tone={asset.gateResult.passed ? 'ok' : 'warn'}>
            {asset.gateResult.passed ? '검수 통과' : '확인 필요'}
          </StatusBadge>
        )}
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        {/* 왼쪽 — 결합본 미리보기 + 다운로드 */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          {asset.imageUrl && (
            <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-card-border bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element -- 동적 fileId 서빙 */}
              <img src={asset.imageUrl} alt="생성된 상세페이지" className="w-full" />
            </div>
          )}
          <div className="mt-4 space-y-2">
            {asset.imageUrl && (
              <button
                type="button"
                onClick={() => void download(asset.imageUrl as string, `${baseName}.jpg`)}
                className={buttonClass('primary', 'md', 'w-full')}
              >
                <IconDownload /> 결합본 1장 내려받기
              </button>
            )}
            {asset.sliceUrls.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  for (let i = 0; i < asset.sliceUrls.length; i++) {
                    await download(asset.sliceUrls[i], `${baseName}-${String(i + 1).padStart(2, '0')}.jpg`);
                  }
                }}
                className={buttonClass('secondary', 'md', 'w-full')}
              >
                몰 업로드용 분할본 {asset.sliceUrls.length}장 내려받기
              </button>
            )}
            <p className="text-xs leading-relaxed text-ink-mute [text-wrap:pretty]">
              결합본은 확인·공유용입니다. 라쿠텐은 이미지 1장당 크기 제한이 있어 <b>분할본</b>을 올리셔야 합니다.
            </p>
          </div>
        </div>

        {/* 오른쪽 — 해설·게이트·블록 */}
        <div>
          {asset.explanationJson?.styleReason && (
            <SectionCard title="이 구성을 고른 이유">
              <p className="text-sm leading-relaxed text-ink-body [text-wrap:pretty]">{asset.explanationJson.styleReason}</p>
            </SectionCard>
          )}

          {asset.gateResult && (
            <SectionCard title="검수 게이트">
              <GateBadges items={asset.gateResult.checks.map((c) => ({ label: c.label, pass: c.pass !== false }))} />
              <ul className="mt-3 space-y-1.5">
                {asset.gateResult.checks.map((c) => (
                  <li key={c.key} className="text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                    <b className="text-ink-body">{c.label}</b> — {c.note}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {failedBlocks.length > 0 && (
            <div className="mt-4 rounded-lg bg-danger-bg px-4 py-3 text-[13px] leading-relaxed text-danger-text">
              블록 {failedBlocks.length}개가 실패해 빠진 채로 이어붙였습니다. 아래에서 개별로 다시 만들 수 있어요.
            </div>
          )}

          {degradedBlocks.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-bg px-4 py-3 text-[13px] leading-relaxed text-amber-text">
              블록 {degradedBlocks.length}개는 배경 이미지 생성에 실패해 <b>문자만으로</b> 만들었습니다. 카피·근거는 그대로 들어가 있고,
              아래에서 &ldquo;이미지만 다시&rdquo;를 누르면 배경컷만 새로 붙습니다.
            </div>
          )}

          <SectionCard title={`블록 ${asset.blocks.length}개`} desc="마음에 들지 않는 블록만 다시 만들 수 있습니다. 문자만 있는 블록은 무료로 즉시 다시 그려집니다.">
            <ol className="space-y-3">
              {asset.blocks.map((b) => (
                <li key={b.id} className="rounded-lg border border-card-border p-3">
                  <div className="flex items-start gap-3">
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 동적 fileId 서빙
                      <img src={b.imageUrl} alt={b.nameKo} className="h-16 w-24 shrink-0 rounded border border-hairline object-cover object-top" />
                    ) : (
                      <div className="h-16 w-24 shrink-0 rounded bg-n-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{b.nameKo}</span>
                        {b.renderKind !== 'text' && <StatusBadge tone="warn">이미지 생성</StatusBadge>}
                        {b.status === 'generating' && <StatusBadge tone="warn">다시 만드는 중</StatusBadge>}
                        {b.status === 'failed' && <StatusBadge tone="danger">실패</StatusBadge>}
                        {b.status === 'done' && b.error && <StatusBadge tone="warn">배경컷 없음</StatusBadge>}
                        {b.version > 1 && <span className="text-[11px] text-ink-faint">v{b.version}</span>}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-mute [text-wrap:pretty]">{b.role}</p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {b.renderKind !== 'text' && (
                          <button
                            type="button"
                            disabled={busyBlock === b.id || b.status === 'generating'}
                            onClick={() => void regenerate(b, 'visual')}
                            className="text-[12px] font-medium text-coral-strong underline-offset-2 hover:underline disabled:text-ink-faint"
                          >
                            이미지만 다시
                          </button>
                        )}
                        {b.canRevert && (
                          <button
                            type="button"
                            disabled={busyBlock === b.id}
                            onClick={() => void revert(b)}
                            className="text-[12px] font-medium text-ink-mute underline-offset-2 hover:underline"
                          >
                            이전 버전으로
                          </button>
                        )}
                      </div>
                      {b.error && (
                        <p className={`mt-1.5 text-xs leading-relaxed [text-wrap:pretty] ${b.status === 'failed' ? 'text-danger-text' : 'text-amber-text'}`}>
                          {b.error}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          {asset.explanationJson && asset.explanationJson.krElementMap.length > 0 && (
            <SectionCard title="한국 원본에서 무엇을 바꿨는지">
              <ul className="space-y-2">
                {asset.explanationJson.krElementMap.map((m, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                    <b className="text-ink-body">{m.element}</b> · {m.action} — {m.reason}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/app/studio/detail" className={buttonClass('secondary', 'md')}>
              다른 상세페이지 만들기
            </Link>
            <Link href="/app/library" className={buttonClass('ghost', 'md')}>
              자산 라이브러리
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
