'use client';

/**
 * ① 처리 로딩(상태 폴링) + 리포트 뷰 — 08 §3.3 상태 머신의 화면.
 * processing 동안 2.5초 폴링, 터미널 상태(published/failed)에서 정지.
 */

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ReportView } from '@/components/report/ReportView';
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

const STAGE_LABELS: Record<string, string> = {
  normalize: '콘텐츠 정규화 · 문장 분해',
  presignals: '신뢰 장치 신호 추출',
  llmCalls: '루브릭 채점 · 약기법 감사 · 페르소나 (병렬 진단 중)',
  persona: '페르소나 · USP 재정의 (브랜드 진단)', // 브랜드 진단 stages: persona → benchmark → assemble
  aggregate: '점수 집계(결정적)',
  benchmark: '코퍼스 벤치마크 대비',
  call4: 'NG/OK 재작성 · 총평 생성',
  assemble: '9블록 조립',
};

const TERMINAL: ReportStatus[] = ['published', 'failed'];

/**
 * 보고용 슬라이드 내보내기 (스펙 §10 · SLIDE-01).
 * 콜⑤가 도는 동안 ~20초 걸리므로 대기 상태를 반드시 보여준다.
 * <a download> 대신 fetch를 쓰는 이유: 실패를 브라우저 기본 오류 페이지가 아니라 앱 UI로 보여주려고.
 */
function SlideExport({ id }: { id: string }) {
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
    <section className="mb-6 rounded-xl border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">상사에게 보고해야 하나요?</p>
          <p className="mt-0.5 text-xs text-neutral-600">
            이 리포트를 품의용 슬라이드 7장(HTML 1개 파일)으로 내보냅니다. 브라우저로 열어 발표하거나 PDF로 저장하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white ${
            busy ? 'cursor-not-allowed bg-neutral-300' : 'bg-[#FF6464] hover:bg-[#D93636]'
          }`}
        >
          {busy ? '만드는 중… (20초쯤 걸려요)' : '보고용 슬라이드 만들기'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-[#F0483C] bg-red-50 p-2.5 text-xs text-[#B3271D]">
          {error}
        </p>
      )}
    </section>
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/app/report/new" className="text-[#D93636] underline">← 새 진단</Link>
        {payload?.storeKind === 'file' && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">로컬 저장(dev)</span>
        )}
      </nav>

      {!payload && !fetchError && <p role="status">불러오는 중…</p>}
      {fetchError && (
        <p role="alert" className="rounded-lg border border-[#F0483C] bg-red-50 p-3 text-sm text-[#B3271D]">
          {fetchError}
        </p>
      )}

      {payload && (payload.status === 'submitted' || payload.status === 'processing') && (
        <section role="status" aria-live="polite" className="rounded-2xl border border-neutral-200 p-8 text-center">
          <p className="text-lg font-semibold">진단 리포트를 생성하고 있습니다…</p>
          <p className="mt-2 text-sm text-neutral-600">
            {payload.stage ? STAGE_LABELS[payload.stage] ?? payload.stage : '대기 중'}
          </p>
          <div className="mx-auto mt-6 h-2 w-64 overflow-hidden rounded bg-neutral-100">
            <div className="h-full w-1/2 animate-pulse bg-[#FF6464]" />
          </div>
          <p className="mt-4 text-xs text-neutral-500">규칙 엔진 + LLM 4콜 파이프라인 — 수 분이 걸릴 수 있습니다.</p>
        </section>
      )}

      {payload?.status === 'failed' && (
        <section role="alert" className="rounded-2xl border border-[#F0483C] bg-red-50 p-8">
          <h1 className="text-lg font-bold text-[#B3271D]">진단 생성에 실패했습니다</h1>
          <p className="mt-2 text-sm text-neutral-800">{payload.error}</p>
          <Link href="/app/report/new" className="mt-4 inline-block text-sm font-semibold text-[#D93636] underline">
            입력을 수정해 다시 시도 →
          </Link>
        </section>
      )}

      {payload?.status === 'published' && payload.report && (
        <>
          <section className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm">
            <strong>발행 완료</strong> — {payload.report.publishedAt?.slice(0, 10)}
          </section>
          <SlideExport id={id} />
          <ReportView blocks={payload.report.blocksJson} />
        </>
      )}
    </main>
  );
}
