'use client';

/**
 * ① 처리 로딩(상태 폴링) + 리포트 뷰 — 08 §3.3 상태 머신의 화면.
 * processing 동안 2.5초 폴링, 터미널 상태(published/failed)에서 정지.
 * 디자인 정본: docs/specs/01-report/2-process.html(처리) · 3-report.html(열람 히어로).
 */

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ReportView } from '@/components/report/ReportView';
import { StatusBadge, buttonClass } from '@/components/ui/primitives';
import { IndetBar, StageList } from '@/components/ui/progress';
import { REPORT_STAGE_LABELS, REPORT_STAGE_STEPS, reportStageIndex } from '@/lib/stageLabels';
import type { BlocksJson, ReportStatus } from '@/lib/engine/types';

interface StatusPayload {
  id: string;
  status: ReportStatus;
  stage: string | null;
  error: string | null;
  precisionLimited: boolean;
  storeKind: 'supabase' | 'file';
  report: {
    blocksJson: BlocksJson;
    /** null = 브랜드 진단(점수 없음) */
    overallScore: number | null;
    publishedAt: string | null;
  } | null;
}

const TERMINAL: ReportStatus[] = ['published', 'failed'];

/**
 * 보고용 슬라이드 내보내기(SLIDE-01) — 콜⑤가 도는 동안 ~20초 걸리므로 대기 상태를 반드시 보여준다.
 * <a download> 대신 fetch를 쓰는 이유: 실패를 브라우저 기본 오류 페이지가 아니라 앱 UI로 보여주려고.
 */
function SlideExport({ id, size = 'md' }: { id: string; size?: 'md' | 'lg' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 슬라이드 HTML을 받아 브라우저 다운로드로 흘린다 */
  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/${id}/slides`);
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = encoded ? decodeURIComponent(encoded) : '보고용-슬라이드.html';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={busy}
        className={buttonClass('primary', size)}
      >
        {busy ? '만드는 중… (20초쯤 걸려요)' : '보고용 슬라이드 만들기'}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-xs rounded-[8px] border border-danger bg-danger-bg p-2 text-xs text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/report/${id}/status`, { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data: StatusPayload = await res.json();
      setPayload(data);
      setFetchError(null);
      if (TERMINAL.includes(data.status) && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {
      setFetchError(String((err as Error).message));
    }
  }, [id]);

  useEffect(() => {
    void poll();
    timerRef.current = setInterval(() => void poll(), 2500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  // ── 처리 중(submitted/processing) — 중앙 정렬 카드 ──────────────────────
  if (payload && (payload.status === 'submitted' || payload.status === 'processing')) {
    const stageIdx = reportStageIndex(payload.stage);
    return (
      <main className="animate-fade-up flex min-h-[70vh] items-center justify-center px-6 py-12">
        <div className="w-full max-w-[560px]">
          <p className="mb-3.5">
            <Link href="/app/report/new" className="text-[12.5px] font-bold text-coral-strong hover:underline">← 새 진단</Link>
          </p>
          <div role="status" aria-live="polite" className="rounded-card border border-card-border bg-canvas p-11 text-center shadow-card">
            <h1 className="text-xl font-extrabold tracking-[-0.01em] text-ink">진단 리포트를 생성하고 있습니다…</h1>
            <p className="mt-2.5 text-[14.5px] font-semibold text-coral-strong">
              {payload.stage ? (REPORT_STAGE_LABELS[payload.stage] ?? payload.stage) : '대기 중'}
            </p>
            <IndetBar className="mt-6" />
            <StageList
              stages={REPORT_STAGE_STEPS.map((s) => s.label)}
              activeIdx={stageIdx}
              className="mt-7 border-t border-hairline pt-4.5 text-left"
            />
            <p className="mt-5.5 text-[12.5px] leading-relaxed text-ink-mute">
              몇 분 걸릴 수 있습니다. 화면을 떠나도 진행됩니다.
            </p>
            {fetchError && (
              <p role="alert" className="mt-4 rounded-[8px] border border-danger bg-danger-bg p-2.5 text-xs text-danger-text">
                {fetchError}
              </p>
            )}
          </div>
          {payload.storeKind === 'file' && (
            <p className="mt-3 text-center"><StatusBadge tone="off">로컬 저장(dev)</StatusBadge></p>
          )}
        </div>
      </main>
    );
  }

  // ── 실패 ─────────────────────────────────────────────────────────────
  if (payload?.status === 'failed') {
    return (
      <main className="animate-fade-up flex min-h-[70vh] items-center justify-center px-6 py-12">
        <div className="w-full max-w-[560px]">
          <p className="mb-3.5">
            <Link href="/app/report/new" className="text-[12.5px] font-bold text-coral-strong hover:underline">← 새 진단</Link>
          </p>
          <section role="alert" className="rounded-card border border-danger bg-danger-bg p-8">
            <h1 className="text-lg font-extrabold text-danger-text">✕ 진단 생성에 실패했습니다</h1>
            <p className="mt-2 text-sm text-ink-body">{payload.error}</p>
            <Link href="/app/report/new" className={`${buttonClass('primary', 'md')} mt-5 no-underline`}>
              다시 진단하기 →
            </Link>
          </section>
        </div>
      </main>
    );
  }

  // ── 발행 완료 ────────────────────────────────────────────────────────
  if (payload?.status === 'published' && payload.report) {
    const b = payload.report.blocksJson;
    return (
      <main className="animate-fade-up">
        <div className="mx-auto max-w-[960px] px-6 pt-9 pb-24">
          <p className="mb-4">
            <Link href="/app/report/new" className="text-[12.5px] font-bold text-coral-strong hover:underline">← 새 진단</Link>
          </p>

          {/* 히어로 */}
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="flex items-center gap-2 text-[12.5px] font-bold tracking-[.03em] text-coral-strong">
                <span aria-hidden className="inline-block h-0.5 w-[18px] bg-coral" />
                일본 시장 진입 진단 리포트
              </p>
              <h1 className="mt-3 text-[36px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ink">{b.block0.brandName}</h1>
              <p className="mt-2 text-[14.5px] text-ink-mute">
                {b.block0.productName} · {b.block0.categoryLabel} · 발행 {payload.report.publishedAt?.slice(0, 10)}
              </p>
            </div>
            <SlideExport id={id} size="md" />
          </div>

          {payload.storeKind === 'file' && (
            <p className="mt-3"><StatusBadge tone="off">로컬 저장(dev)</StatusBadge></p>
          )}

          <ReportView blocks={b} slideExportSlot={<SlideExport id={id} size="lg" />} />
        </div>
      </main>
    );
  }

  // ── 로딩 전/오류 ─────────────────────────────────────────────────────
  return (
    <main className="animate-fade-up flex min-h-[50vh] items-center justify-center px-6 py-12">
      {!payload && !fetchError && <p role="status" className="text-sm text-ink-mute">불러오는 중…</p>}
      {fetchError && (
        <p role="alert" className="rounded-[10px] border border-danger bg-danger-bg p-3 text-[13px] text-danger-text">
          {fetchError}
        </p>
      )}
    </main>
  );
}
