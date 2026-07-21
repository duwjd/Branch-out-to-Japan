'use client';

/**
 * 플로팅 진행 패널(MAIN-05a) — 우하단 고정. 진행 중 리포트·썸네일 잡을 2.5초 폴링으로
 * 추적하고, 완료 시 "보러 가기" 행으로 전환 후 8초 뒤 자동 소멸. 진행률은 레이아웃
 * 애니메이션을 피해 scaleX로 그린다(디자인 .jp-fill 규칙).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconChevronDown, IconChevronUp } from '@/components/ui/icons';
import { REPORT_STAGE_LABELS, REPORT_STAGE_STEPS, reportStageIndex } from '@/lib/stageLabels';
import { STUDIO_STAGE_LABELS } from '@/lib/studio/platform';

export interface DashboardJob {
  kind: 'report' | 'thumbnail';
  id: string;
  /** 패널 표시명 — "공식샵 신뢰 배지형 · 라쿠텐 공식샵" */
  name: string;
}

interface TrackedJob extends DashboardJob {
  stage: string | null;
  state: 'running' | 'done' | 'failed';
}

const STUDIO_STAGE_KEYS = ['analyze', 'assemble', 'generate', 'gate'];

/** 잡 종류별 진행률(0~1) */
function progressOf(job: TrackedJob): number {
  if (job.state !== 'running') return 1;
  if (job.kind === 'report') return (reportStageIndex(job.stage) + 0.5) / REPORT_STAGE_STEPS.length;
  const idx = job.stage ? STUDIO_STAGE_KEYS.indexOf(job.stage) : -1;
  return ((idx === -1 ? 0 : idx) + 0.5) / STUDIO_STAGE_KEYS.length;
}

/** 잡 종류별 현재 단계 라벨 */
function stageLabelOf(job: TrackedJob): string {
  if (!job.stage) return '대기 중';
  const map = job.kind === 'report' ? REPORT_STAGE_LABELS : STUDIO_STAGE_LABELS;
  return map[job.stage] ?? job.stage;
}

export function JobPanel({ jobs }: { jobs: DashboardJob[] }) {
  const router = useRouter();
  const [tracked, setTracked] = useState<TrackedJob[]>(() =>
    jobs.map((j) => ({ ...j, stage: null, state: 'running' as const })),
  );
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* 2.5초 폴링 — 전 잡이 터미널이면 중단, 완료 행은 8초 뒤 제거 */
  useEffect(() => {
    let alive = true;

    async function poll() {
      const updates = await Promise.all(
        tracked
          .filter((j) => j.state === 'running')
          .map(async (job) => {
            try {
              const url = job.kind === 'report' ? `/api/report/${job.id}/status` : `/api/studio/thumbnail/${job.id}`;
              const res = await fetch(url, { cache: 'no-store' });
              if (!res.ok) return { id: job.id, stage: job.stage, state: 'running' as const };
              const data = (await res.json()) as { status: string; stage: string | null };
              const state =
                data.status === 'published' || data.status === 'done'
                  ? ('done' as const)
                  : data.status === 'failed'
                    ? ('failed' as const)
                    : ('running' as const);
              return { id: job.id, stage: data.stage, state };
            } catch {
              return { id: job.id, stage: job.stage, state: 'running' as const };
            }
          }),
      );
      if (!alive || updates.length === 0) return;
      setTracked((prev) =>
        prev.map((job) => {
          const u = updates.find((x) => x.id === job.id);
          return u ? { ...job, stage: u.stage, state: u.state } : job;
        }),
      );
      // 서버 컴포넌트(최근 자산·KPI) 갱신
      if (updates.some((u) => u.state !== 'running')) router.refresh();
    }

    if (tracked.some((j) => j.state === 'running')) {
      void poll();
      timerRef.current = setInterval(() => void poll(), 2500);
    }
    return () => {
      alive = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 폴링 대상 수가 바뀔 때만 재시작
  }, [tracked.filter((j) => j.state === 'running').length]);

  /* 완료·실패 행은 8초 뒤 제거 */
  useEffect(() => {
    const finished = tracked.filter((j) => j.state !== 'running');
    if (finished.length === 0) return;
    const t = setTimeout(() => {
      setTracked((prev) => prev.filter((j) => j.state === 'running'));
    }, 8000);
    return () => clearTimeout(t);
  }, [tracked]);

  const running = tracked.filter((j) => j.state === 'running');
  if (tracked.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-5 bottom-5 z-80 w-[324px] overflow-hidden rounded-2xl border border-card-border bg-canvas shadow-2 animate-toast-in"
    >
      <div className="flex items-center gap-2 border-b border-n-150 px-3.5 py-3">
        {running.length > 0 ? (
          <span
            aria-hidden
            className="inline-block h-4 w-4 rounded-full border-2 border-coral border-t-transparent animate-spin"
          />
        ) : (
          <span
            aria-hidden
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-bg text-[10px] font-extrabold text-green-text"
          >
            ○
          </span>
        )}
        <span className="flex-1 text-[13px] font-bold text-ink">
          {running.length > 0 ? `생성 중 ${running.length}건` : '생성 완료'}
        </span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? '진행 패널 펼치기' : '진행 패널 접기'}
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-[7px] text-[#70737c] transition-colors hover:bg-n-100"
        >
          {collapsed ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
        </button>
      </div>
      {!collapsed && (
        <div>
          {tracked.map((job) =>
            job.state === 'running' ? (
              <div key={job.id} className="flex items-center gap-[11px] px-3.5 py-3">
                <span aria-hidden className="relative h-10 w-10 flex-none overflow-hidden rounded-[9px] bg-linear-180 from-[#ecedf0] to-[#e2e4e9]">
                  <span className="absolute inset-0 bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.75)_50%,transparent_80%)] bg-size-[300px_100%] bg-no-repeat animate-shimmer" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-ink">{job.name}</span>
                  <span className="mt-[3px] mb-1.5 block text-[11.5px] text-ink-mute">{stageLabelOf(job)}</span>
                  <span className="block h-1 overflow-hidden rounded-full bg-n-150">
                    <span
                      className="block h-full w-full origin-left rounded-full bg-coral transition-transform duration-500"
                      style={{ transform: `scaleX(${progressOf(job)})` }}
                    />
                  </span>
                </span>
              </div>
            ) : (
              <div key={job.id} className="flex items-center gap-[11px] px-3.5 py-3">
                <span
                  aria-hidden
                  className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-[9px] text-base font-extrabold ${
                    job.state === 'done' ? 'bg-green-bg text-green-text' : 'bg-danger-bg text-danger-text'
                  }`}
                >
                  {job.state === 'done' ? '○' : '✕'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold text-ink">
                    {job.state === 'done'
                      ? job.kind === 'report'
                        ? '리포트가 발행되었습니다'
                        : '썸네일이 완성되었습니다'
                      : job.kind === 'report'
                        ? '리포트 생성에 실패했습니다'
                        : '썸네일 생성에 실패했습니다'}
                  </span>
                  <span className="mt-[3px] block truncate text-[11.5px] text-ink-mute">
                    {job.state === 'done' && job.kind === 'thumbnail' ? '검수 게이트 통과 · 최근 자산에 추가됨' : job.name}
                  </span>
                </span>
                <Link
                  href={job.kind === 'report' ? `/app/report/${job.id}` : `/app/studio/thumbnail/${job.id}`}
                  className="inline-flex h-[30px] flex-none items-center rounded-lg bg-coral px-[11px] text-xs font-bold text-white no-underline transition-colors hover:bg-coral-strong"
                >
                  보러 가기 →
                </Link>
              </div>
            ),
          )}
          <p className="px-3.5 pb-3 text-[11px] leading-normal text-ink-faint">
            완료되면 여기와 ③ 운영 자산 라이브러리에 표시됩니다. 다른 작업을 하셔도 됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
