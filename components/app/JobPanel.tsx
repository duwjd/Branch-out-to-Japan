'use client';

/**
 * 플로팅 진행 패널(MAIN-05a) — 우하단 고정. 진행 중 리포트·썸네일·상세페이지 잡을 폴링으로
 * 추적하고, 완료 시 "보러 가기" 행으로 전환 후 8초 뒤 자동 소멸. 진행률은 레이아웃
 * 애니메이션을 피해 scaleX로 그린다(디자인 .jp-fill 규칙).
 *
 * 폴링은 **상태 전용 라우트**만 친다. 상세페이지의 경우 `/api/studio/detail/[id]` 는 결과물
 * 전문(블록 카피·gateResult·explanationJson·입력 스냅샷)을 돌려주는데, 이 패널이 쓰는 건
 * 4개 필드뿐이라 통째로 받아 버리고 있었다.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconChevronDown, IconChevronUp } from '@/components/ui/icons';
import { REPORT_STAGE_LABELS, REPORT_STAGE_STEPS, reportStageIndex } from '@/lib/stageLabels';
import { DETAIL_STAGE_LABELS, STUDIO_STAGE_LABELS } from '@/lib/studio/platform';

export interface DashboardJob {
  kind: 'report' | 'thumbnail' | 'detail';
  id: string;
  /** 패널 표시명 — "공식샵 신뢰 배지형 · 라쿠텐 공식샵" */
  name: string;
}

interface TrackedJob extends DashboardJob {
  stage: string | null;
  state: 'running' | 'done' | 'failed';
  /** 상세페이지 전용 — 블록 단위 진행률("블록 7/14") */
  blockTotal?: number;
  blockDone?: number;
}

const STUDIO_STAGE_KEYS = ['analyze', 'assemble', 'generate', 'gate'];
const DETAIL_STAGE_KEYS = ['analyze', 'plan', 'copy', 'blocks', 'compose', 'slice', 'gate'];

/**
 * 폴링 간격 — 첫 응답은 빠르게, 이후 점점 늘린다.
 * 상세페이지는 실측 155초짜리 작업이라 2.5초 고정은 과했다(같은 화면에 결과 페이지까지
 * 열려 있으면 두 폴러가 동시에 돈다). 상한 15초면 진행률 표시에 체감 차이가 없다.
 */
const POLL_STEPS_MS = [2_500, 2_500, 5_000, 5_000, 10_000, 15_000];

function pollDelay(tick: number): number {
  return POLL_STEPS_MS[Math.min(tick, POLL_STEPS_MS.length - 1)];
}

/** 잡 종류별 진행률(0~1) */
function progressOf(job: TrackedJob): number {
  if (job.state !== 'running') return 1;
  if (job.kind === 'report') return (reportStageIndex(job.stage) + 0.5) / REPORT_STAGE_STEPS.length;
  if (job.kind === 'detail') {
    const keys = DETAIL_STAGE_KEYS;
    const idx = job.stage ? keys.indexOf(job.stage) : -1;
    const base = (idx === -1 ? 0 : idx) / keys.length;
    // blocks 단계는 길어서 블록 진행률로 그 구간을 채운다
    if (job.stage === 'blocks' && job.blockTotal) {
      return base + ((job.blockDone ?? 0) / job.blockTotal) * (1 / keys.length);
    }
    return base + 0.5 / keys.length;
  }
  const idx = job.stage ? STUDIO_STAGE_KEYS.indexOf(job.stage) : -1;
  return ((idx === -1 ? 0 : idx) + 0.5) / STUDIO_STAGE_KEYS.length;
}

/** 잡 종류별 현재 단계 라벨 */
function stageLabelOf(job: TrackedJob): string {
  if (!job.stage) return '대기 중';
  if (job.kind === 'detail') {
    const label = DETAIL_STAGE_LABELS[job.stage] ?? job.stage;
    return job.stage === 'blocks' && job.blockTotal
      ? `${label} (${job.blockDone ?? 0}/${job.blockTotal})`
      : label;
  }
  const map = job.kind === 'report' ? REPORT_STAGE_LABELS : STUDIO_STAGE_LABELS;
  return map[job.stage] ?? job.stage;
}

export function JobPanel({ jobs }: { jobs: DashboardJob[] }) {
  const router = useRouter();
  const [tracked, setTracked] = useState<TrackedJob[]>(() =>
    jobs.map((j) => ({ ...j, stage: null, state: 'running' as const })),
  );
  const [collapsed, setCollapsed] = useState(false);
  /** 폴링 콜백이 최신 목록을 보되, 목록이 바뀔 때마다 타이머가 재시작되지는 않게 하는 통로 */
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;
  const runningCount = tracked.filter((j) => j.state === 'running').length;

  /* 진행률 폴링(백오프) — 전 잡이 터미널이면 중단, 완료 행은 8초 뒤 제거 */
  useEffect(() => {
    let alive = true;
    let handle: ReturnType<typeof setTimeout> | null = null;
    /** 연속 무변화 횟수 — 변화가 없을수록 간격을 늘린다 */
    let quiet = 0;

    function schedule() {
      if (!alive) return;
      if (!trackedRef.current.some((j) => j.state === 'running')) return;
      handle = setTimeout(() => void poll(), pollDelay(quiet));
    }

    async function poll() {
      const running = trackedRef.current.filter((j) => j.state === 'running');
      if (running.length === 0) return;

      const updates = await Promise.all(
        running.map(async (job) => {
          try {
            // 셋 다 상태 전용 라우트 — 결과물 본문은 완료 후 화면 전환에서 받는다
            const url =
              job.kind === 'report'
                ? `/api/report/${job.id}/status`
                : job.kind === 'detail'
                  ? `/api/studio/detail/${job.id}/status`
                  : `/api/studio/thumbnail/${job.id}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return { id: job.id, stage: job.stage, state: 'running' as const };
            const data = (await res.json()) as {
              status: string;
              stage: string | null;
              blockTotal?: number;
              blockDone?: number;
            };
            const state =
              data.status === 'published' || data.status === 'done'
                ? ('done' as const)
                : data.status === 'failed'
                  ? ('failed' as const)
                  : ('running' as const);
            return { id: job.id, stage: data.stage, state, blockTotal: data.blockTotal, blockDone: data.blockDone };
          } catch {
            return { id: job.id, stage: job.stage, state: 'running' as const };
          }
        }),
      );
      if (!alive) return;

      const changed = updates.some((u) => {
        const before = trackedRef.current.find((j) => j.id === u.id);
        return !before || before.stage !== u.stage || before.state !== u.state || before.blockDone !== u.blockDone;
      });
      quiet = changed ? 0 : quiet + 1;

      setTracked((prev) =>
        prev.map((job) => {
          const u = updates.find((x) => x.id === job.id);
          // 상세페이지는 블록 진행률까지 옮겨야 "블록 7/14" 라벨이 갱신된다
          return u ? { ...job, stage: u.stage, state: u.state, blockTotal: u.blockTotal, blockDone: u.blockDone } : job;
        }),
      );
      // 서버 컴포넌트(최근 자산·KPI) 갱신 — 방금 터미널이 된 잡이 있을 때만.
      // 이 refresh 는 /app 레이아웃까지 다시 태우므로 매 폴마다 부르면 안 된다.
      if (updates.some((u) => u.state !== 'running')) router.refresh();

      schedule();
    }

    if (runningCount > 0) void poll();
    return () => {
      alive = false;
      if (handle) clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 폴링 대상 수가 바뀔 때만 재시작(목록 자체는 ref로 읽는다)
  }, [runningCount]);

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
                        ? '리포트가 나왔습니다'
                        : job.kind === 'detail'
                          ? '상세페이지가 완성됐습니다'
                          : '썸네일이 완성됐습니다'
                      : job.kind === 'report'
                        ? '리포트를 만들지 못했습니다'
                        : job.kind === 'detail'
                          ? '상세페이지를 만들지 못했습니다'
                          : '썸네일을 만들지 못했습니다'}
                  </span>
                  <span className="mt-[3px] block truncate text-[11.5px] text-ink-mute">
                    {job.state === 'done' && job.kind === 'thumbnail' ? '검수 게이트 통과 · 최근 자산에 추가됨' : job.name}
                  </span>
                </span>
                <Link
                  href={
                    job.kind === 'report'
                      ? `/app/report/${job.id}`
                      : job.kind === 'detail'
                        ? `/app/studio/detail/${job.id}`
                        : `/app/studio/thumbnail/${job.id}`
                  }
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
