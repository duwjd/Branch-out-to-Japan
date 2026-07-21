'use client';

/**
 * 기업 매칭 뷰(MATCH-02~07) — 미신청=신청 폼 / 신청 후=상태 스테퍼.
 * 상태 갱신은 운영팀 수동 — 자동 진행·예상 소요일을 표기하지 않는다.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MATCH_CHANNELS, MATCH_TIMINGS, PARTNER_TYPES } from '@/lib/matching';
import type { MatchRequestRecord } from '@/lib/db/store';

interface Summary {
  reportCount: number;
  thumbnailCount: number;
  latestScore: number | null;
}

const STEPS = [
  { key: 'submitted', label: '신청 완료' },
  { key: 'reviewing', label: '검토 중' },
  { key: 'proposed', label: '제안 도착' },
] as const;

export function MatchingView({
  initialActive,
  brandName,
  summary,
  storeKind,
}: {
  initialActive: MatchRequestRecord | null;
  brandName: string | null;
  summary: Summary;
  storeKind: 'supabase' | 'file';
}) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [partnerTypes, setPartnerTypes] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [timing, setTiming] = useState('미정');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  /** 신청 제출(MATCH-03) */
  async function handleSubmit() {
    if (partnerTypes.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerTypes, channels, timing, memo }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data = await res.json();
      setActive(data.active);
      setStatusMsg('신청이 접수되었습니다');
      router.refresh(); // 사이드바 배지 동기화(LIB-07)
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  /** 신청 취소(MATCH-06) — 미신청 상태로 복귀, 입력값 복원하지 않는다 */
  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/matching', { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setActive(null);
      setCancelOpen(false);
      setPartnerTypes([]);
      setChannels([]);
      setTiming('미정');
      setMemo('');
      setStatusMsg(null);
      router.refresh();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const currentStepIdx = active ? STEPS.findIndex((s) => s.key === active.status) : -1;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-[#D93636]">KGLOW 운영</p>
          {storeKind === 'file' && (
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">로컬 저장(dev)</span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-bold">일본 기업 매칭</h1>
        <p className="mt-2 text-sm text-neutral-600">
          진단·제작을 거친 브랜드를 일본 현지 기업과 연결합니다. 신청 내용을 검토해 적합한 파트너의 제안을 보내드립니다.
        </p>
      </header>

      {statusMsg && (
        <p role="status" className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          {statusMsg}
        </p>
      )}

      {!active ? (
        <>
          {/* 리포트 0건 안내(MATCH-07) — 신청은 차단하지 않는다 */}
          {summary.reportCount === 0 && (
            <p className="mt-6 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
              진단 리포트가 있으면 매칭 검토가 빨라집니다{' '}
              <Link href="/app/report/new" className="text-[#D93636] underline">진단 시작</Link>
            </p>
          )}

          {/* 자동 첨부 요약(MATCH-02a) */}
          <section className="mt-4 rounded-2xl border border-neutral-200 p-4 text-sm">
            <p className="font-semibold">{brandName ?? '브랜드 프로필 미작성'}</p>
            <p className="mt-1 text-xs text-neutral-600">
              진단 리포트 {summary.reportCount}건 · 생성 썸네일 {summary.thumbnailCount}건 · 최근 진단 점수{' '}
              {summary.latestScore ?? '—'}
              {summary.latestScore !== null ? '/100' : ''}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              신청서에 함께 전달됩니다. 다시 입력할 필요 없습니다 ·{' '}
              <Link href="/app/brand" className="text-[#D93636] underline">브랜드 관리에서 수정</Link>
            </p>
          </section>

          {/* 입력(MATCH-02b) */}
          <section className="mt-5 space-y-5 rounded-2xl border border-neutral-200 p-5">
            <div>
              <p className="text-xs font-medium text-neutral-700">
                파트너 유형 <span className="text-[#D93636]">*</span> (복수 선택)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PARTNER_TYPES.map((t) => {
                  const on = partnerTypes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(partnerTypes, setPartnerTypes, t)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        on ? 'border-[#D93636] bg-[#FFF8F8] font-semibold text-[#D93636]' : 'border-neutral-300'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              {partnerTypes.length === 0 && (
                <p className="mt-1.5 text-xs text-neutral-500">파트너 유형을 1개 이상 선택해 주세요</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-700">진출 채널·희망 시기 (선택)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {MATCH_CHANNELS.map((c) => {
                  const on = channels.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(channels, setChannels, c.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        on ? 'border-[#D93636] bg-[#FFF8F8] font-semibold text-[#D93636]' : 'border-neutral-300'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
                <select
                  value={timing}
                  onChange={(e) => setTiming(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                  aria-label="희망 시기"
                >
                  {MATCH_TIMINGS.map((t) => (
                    <option key={t} value={t}>희망 시기: {t}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="block text-xs font-medium text-neutral-700">
              요청 메모 (선택) <span className="font-normal text-neutral-500">{memo.length}/500</span>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value.slice(0, 500))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <div>
              <button
                type="button"
                disabled={partnerTypes.length === 0 || busy}
                onClick={() => void handleSubmit()}
                className={`w-full rounded-lg px-6 py-3 text-sm font-bold text-white ${
                  partnerTypes.length > 0 && !busy ? 'bg-[#FF6464] hover:bg-[#D93636]' : 'cursor-not-allowed bg-neutral-300'
                }`}
              >
                {busy ? '신청 중…' : '매칭 신청'}
              </button>
              <p className="mt-2 text-center text-xs text-neutral-500">검토 후 연락드립니다. 처리 기한 (미정)</p>
              {error && <p role="alert" className="mt-2 text-xs text-[#B3271D]">{error}</p>}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* 상태 스테퍼(MATCH-04) — 색+글자+기호 3중 표기 */}
          <section className="mt-6 rounded-2xl border border-neutral-200 p-5">
            <ol className="flex items-center gap-2 text-xs">
              {STEPS.map((step, i) => {
                const done = i < currentStepIdx;
                const current = i === currentStepIdx;
                return (
                  <li key={step.key} aria-current={current ? 'step' : undefined} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                        done
                          ? 'bg-emerald-100 text-emerald-900'
                          : current
                            ? 'bg-[#FF6464] text-white'
                            : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      {done ? '○' : i + 1}
                    </span>
                    <span className={current ? 'font-semibold text-[#D93636]' : done ? 'text-emerald-900' : 'text-neutral-400'}>
                      {step.label}
                    </span>
                    <span className="text-neutral-400">
                      {step.key === 'submitted' ? active.createdAt.slice(0, 10) : current ? active.updatedAt.slice(0, 10) : '—'}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-center text-xs text-neutral-500">검토가 끝나면 이메일과 이 화면으로 알려드립니다</p>
          </section>

          {/* 신청 스냅샷 요약(MATCH-04) */}
          <section className="mt-4 rounded-2xl border border-neutral-200 p-4 text-sm">
            <p className="text-xs font-medium text-neutral-500">신청 내용</p>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-neutral-500">파트너 유형</dt><dd>{active.partnerTypes.join(' · ')}</dd></div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-neutral-500">채널·시기</dt>
                <dd>
                  {active.channels.length
                    ? active.channels.map((c) => MATCH_CHANNELS.find((x) => x.value === c)?.label ?? c).join(' · ')
                    : '미정'}{' '}
                  · {active.timing || '미정'}
                </dd>
              </div>
              {active.memo && <div className="flex gap-2"><dt className="w-20 shrink-0 text-neutral-500">메모</dt><dd>{active.memo}</dd></div>}
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-neutral-500">첨부 자산</dt>
                <dd>
                  진단 리포트 {active.snapshot.reportCount}건 · 썸네일 {active.snapshot.thumbnailCount}건 · 최근 점수{' '}
                  {active.snapshot.latestScore ?? '—'}
                </dd>
              </div>
            </dl>
          </section>

          <button type="button" onClick={() => setCancelOpen(true)} className="mt-4 text-xs text-neutral-500 underline hover:text-[#B3271D]">
            신청 취소
          </button>
          {error && <p role="alert" className="mt-2 text-xs text-[#B3271D]">{error}</p>}

          {/* 취소 확인 모달(MATCH-06) */}
          {cancelOpen && (
            <div role="dialog" aria-modal="true" aria-label="매칭 신청 취소 확인" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6">
                <p className="text-sm font-bold">매칭 신청을 취소할까요?</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setCancelOpen(false)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
                    돌아가기
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCancel()}
                    className="rounded-lg bg-[#B3271D] px-4 py-2 text-sm font-bold text-white hover:bg-[#8f1f17]"
                  >
                    {busy ? '취소 중…' : '취소하기'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
