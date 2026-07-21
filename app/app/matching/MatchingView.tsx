'use client';

/**
 * 기업 매칭 뷰(MATCH-02~07) — 미신청=신청 폼 / 신청 후=상태 스테퍼.
 * 상태 갱신은 운영팀 수동 — 자동 진행·예상 소요일을 표기하지 않는다.
 * 디자인 정본: docs/specs/04-operations/4-matching.html
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MATCH_CHANNELS, MATCH_TIMINGS, PARTNER_TYPES } from '@/lib/matching';
import type { MatchRequestRecord } from '@/lib/db/store';
import { Modal } from '@/components/ui/Modal';
import { Stepper } from '@/components/ui/progress';
import { StatusBadge, buttonClass, cardClass, chipClass, selectClass, textareaClass } from '@/components/ui/primitives';

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
  const stepperSteps = STEPS.map((s, i) => ({
    label: s.label,
    date: active ? (i === 0 ? active.createdAt.slice(0, 10) : i === currentStepIdx ? active.updatedAt.slice(0, 10) : undefined) : undefined,
  }));

  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[760px] px-6 pt-9 pb-24 max-sm:px-5">
        {/* 상단 안내(MATCH-01) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">KGLOW 운영</p>
          {storeKind === 'file' && <StatusBadge tone="off">로컬 저장(dev)</StatusBadge>}
        </div>
        <h1 className="mt-2.5 text-[28px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink">일본 기업 매칭</h1>
        <p className="mt-3 text-[14.5px] leading-[1.7] text-ink-body [text-wrap:pretty]">
          진단·제작을 거친 브랜드를 일본 현지 기업과 연결합니다. 신청 내용을 검토해 적합한 파트너의 제안을
          보내드립니다.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          기업 목록을 열람하거나 검색하는 방식이 아닙니다. 운영팀이 브랜드 자산을 보고 직접 검토합니다.
        </p>

        {statusMsg && (
          <p role="status" className="mt-4 rounded-[10px] border border-green/35 bg-green-bg p-3 text-sm font-semibold text-green-text">
            {statusMsg}
          </p>
        )}

        {!active ? (
          <>
            {/* 리포트 0건 안내(MATCH-07) — 신청은 차단하지 않는다 */}
            {summary.reportCount === 0 && (
              <p className="mt-4.5 rounded-[10px] border border-amber/45 bg-amber-bg p-3.5 text-[12.5px] leading-relaxed text-amber-text">
                진단 리포트가 있으면 매칭 검토가 빨라집니다.{' '}
                <Link href="/app/report/new" className="font-bold underline">
                  진단 시작
                </Link>
              </p>
            )}

            {/* 자동 첨부 요약(MATCH-02a) */}
            <section className="mt-5 rounded-card border border-coral/30 bg-coral-tint p-4.5">
              <p className="text-[13.5px] font-bold text-ink">{brandName ?? '브랜드 프로필 미작성'}</p>
              <p className="tnum mt-1.5 text-xs text-ink-mute">
                진단 리포트 {summary.reportCount}건 · 생성 썸네일 {summary.thumbnailCount}건 · 최근 진단 점수{' '}
                {summary.latestScore ?? '—'}
                {summary.latestScore !== null ? '/100' : ''}
              </p>
              <p className="mt-2.5 border-t border-coral/20 pt-2.5 text-[11.5px] text-ink-mute">
                신청서에 함께 전달됩니다. 다시 입력할 필요 없습니다 ·{' '}
                <Link href="/app/brand" className="font-bold text-coral-strong hover:underline">
                  브랜드 관리에서 수정
                </Link>
              </p>
            </section>

            {/* 파트너 유형(MATCH-02b — 필수) */}
            <fieldset className="mt-7 border-0 p-0">
              <legend className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-ink">
                어떤 파트너를 찾고 있나요?
                <span className="inline-flex h-[18px] items-center rounded-full bg-coral-tint px-[7px] text-[10px] font-bold text-coral-strong">
                  필수 · 1개 이상
                </span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {PARTNER_TYPES.map((t) => (
                  <button key={t} type="button" aria-pressed={partnerTypes.includes(t)} onClick={() => toggle(partnerTypes, setPartnerTypes, t)} className={chipClass(partnerTypes.includes(t))}>
                    {t}
                  </button>
                ))}
              </div>
              {partnerTypes.length === 0 && <p className="mt-2 text-[12.5px] text-ink-mute">파트너 유형을 1개 이상 선택해 주세요</p>}
            </fieldset>

            {/* 진출 채널·희망 시기(MATCH-02b — 선택) */}
            <fieldset className="mt-6 border-0 p-0">
              <legend className="text-sm font-extrabold text-ink">
                진출 채널·희망 시기 <span className="text-xs font-semibold text-ink-faint">선택</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {MATCH_CHANNELS.map((c) => (
                  <button key={c.value} type="button" aria-pressed={channels.includes(c.value)} onClick={() => toggle(channels, setChannels, c.value)} className={chipClass(channels.includes(c.value))}>
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <label htmlFor="timing" className="mb-1.5 block text-xs font-semibold text-ink-mute">
                  희망 시기
                </label>
                <select id="timing" value={timing} onChange={(e) => setTiming(e.target.value)} className={`${selectClass} w-[220px]`}>
                  {MATCH_TIMINGS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>

            {/* 요청 메모(MATCH-02b — 선택) */}
            <div className="mt-6">
              <label htmlFor="memo" className="text-sm font-extrabold text-ink">
                요청 메모 <span className="text-xs font-semibold text-ink-faint">선택</span>
              </label>
              <textarea
                id="memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="예: 도쿄 오프라인 팝업을 함께할 파트너를 찾고 있어요."
                className={`mt-3 ${textareaClass}`}
              />
              <p className="tnum mt-1.5 text-right text-[11px] text-ink-faint">{memo.length}/500</p>
            </div>

            {/* 제출(MATCH-02c·03) — 화면 유일 primary */}
            <div className="mt-7">
              <button type="button" disabled={partnerTypes.length === 0 || busy} onClick={() => void handleSubmit()} className={buttonClass('primary', 'lg', 'w-full')}>
                {busy ? '신청 중…' : '매칭 신청'}
              </button>
              <p className="mt-2.5 text-center text-[12.5px] text-ink-mute">검토 후 연락드립니다. 처리 기한 (미정)</p>
              {error && (
                <p role="alert" className="mt-2 text-center text-[12.5px] font-semibold text-danger-text">
                  {error}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* 상태 스테퍼(MATCH-04) — 색+글자+기호 3중 표기 */}
            <section className={cardClass('mt-6 p-6 sm:p-7')}>
              <Stepper steps={stepperSteps} currentIdx={currentStepIdx} />
              <p role="status" aria-live="polite" className="mt-5 text-center text-[13px] text-ink-mute">
                검토가 끝나면 이메일과 이 화면으로 알려드립니다
              </p>
            </section>

            {active.status === 'proposed' && (
              <section role="status" className="mt-4 rounded-card border border-green/35 bg-green-bg p-4 text-center text-[13px] font-bold text-green-text">
                제안이 도착했습니다 ○ — 운영팀이 이메일로 상세를 안내합니다
              </section>
            )}

            {/* 신청 스냅샷 요약(MATCH-04) */}
            <section className={cardClass('mt-4 p-5')}>
              <h2 className="text-[13.5px] font-extrabold text-ink">신청 내용</h2>
              <dl className="mt-3 space-y-2 text-[12.5px]">
                <div className="flex gap-2">
                  <dt className="w-20 flex-none text-ink-mute">파트너 유형</dt>
                  <dd className="text-ink">{active.partnerTypes.join(' · ')}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 flex-none text-ink-mute">채널·시기</dt>
                  <dd className="text-ink">
                    {active.channels.length ? active.channels.map((c) => MATCH_CHANNELS.find((x) => x.value === c)?.label ?? c).join(' · ') : '미정'} ·{' '}
                    {active.timing || '미정'}
                  </dd>
                </div>
                {active.memo && (
                  <div className="flex gap-2">
                    <dt className="w-20 flex-none text-ink-mute">메모</dt>
                    <dd className="text-ink-body">{active.memo}</dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="w-20 flex-none text-ink-mute">첨부 자산</dt>
                  <dd className="tnum text-ink-body">
                    진단 리포트 {active.snapshot.reportCount}건 · 썸네일 {active.snapshot.thumbnailCount}건 · 최근 점수{' '}
                    {active.snapshot.latestScore ?? '—'}
                  </dd>
                </div>
              </dl>
            </section>

            <p className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="text-[12.5px] font-bold text-danger-text underline underline-offset-2 hover:no-underline"
              >
                신청 취소
              </button>
            </p>
            {error && (
              <p role="alert" className="mt-2 text-center text-[12.5px] font-semibold text-danger-text">
                {error}
              </p>
            )}

            {/* 취소 확인 모달(MATCH-06) */}
            <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} labelledBy="cancelMatchTitle">
              <h2 id="cancelMatchTitle" className="text-base font-extrabold text-ink">
                매칭 신청을 취소할까요?
              </h2>
              <p className="mt-2.5 text-[13px] leading-relaxed text-ink-mute">취소하면 검토가 중단됩니다. 입력한 내용은 복원되지 않습니다.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setCancelOpen(false)} className={buttonClass('secondary', 'md')}>
                  돌아가기
                </button>
                <button type="button" disabled={busy} onClick={() => void handleCancel()} className={buttonClass('danger', 'md')}>
                  {busy ? '취소 중…' : '신청 취소'}
                </button>
              </div>
            </Modal>
          </>
        )}
      </div>
    </main>
  );
}
