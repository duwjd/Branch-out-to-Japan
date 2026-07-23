'use client';

import { useState, type FormEvent } from 'react';
import { LEAD_CHANNELS, LEAD_STAGES, PAIN_POINTS } from '@/lib/lead';
import { buttonClass, chipClass, fieldLabelClass, inputClass, selectClass, textareaClass } from '@/components/ui/primitives';
import { getSource, sendTrack } from './track';

/** 칩(복수 선택) 토글 헬퍼 */
function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** /api/lead POST 공용 제출 — 실패 시 서버 에러 메시지를 그대로 던진다 */
async function submitLead(body: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error) || `HTTP ${res.status}`);
  }
}

/** 접수 완료 안내 — 처리기한은 단정하지 않는다 */
function DoneNotice({ children }: { children: string }) {
  return (
    <p role="status" className="rounded-[10px] border border-green/35 bg-green-bg p-4 text-[13.5px] font-semibold text-green-text">
      {children}
    </p>
  );
}

/** 상담 신청 폼(주 지표) — 브랜드·연락처·현재 단계·채널·고통점·메모 */
function ConsultationForm() {
  const [brandName, setBrandName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contact, setContact] = useState('');
  const [stage, setStage] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = brandName.trim().length > 0 && contact.trim().length > 0 && !busy;

  /** 상담 신청 제출 → lead_submit 트래킹 */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await submitLead({
        kind: 'consultation',
        brandName: brandName.trim(),
        contactName: contactName.trim() || undefined,
        contact: contact.trim(),
        stage: stage || undefined,
        channels: channels.length ? channels : undefined,
        painPoints: painPoints.length ? painPoints : undefined,
        memo: memo.trim() || undefined,
        source: getSource(),
      });
      sendTrack('lead_submit', { cta: 'consultation' });
      setDone(true);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <DoneNotice>신청이 접수되었습니다 — 영업일 기준으로 안내드립니다.</DoneNotice>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="c-brandName" className={fieldLabelClass}>
          브랜드명 <span className="text-coral-strong">*</span>
        </label>
        <input
          id="c-brandName"
          required
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          className={inputClass}
          placeholder="예: OO코스메틱"
        />
      </div>

      <div>
        <label htmlFor="c-contactName" className={fieldLabelClass}>
          담당자명 <span className="text-[11px] font-semibold text-ink-faint">선택</span>
        </label>
        <input id="c-contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="c-contact" className={fieldLabelClass}>
          연락처 <span className="text-coral-strong">*</span>
        </label>
        <input
          id="c-contact"
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className={inputClass}
          placeholder="이메일 또는 전화번호"
        />
      </div>

      <div>
        <label htmlFor="c-stage" className={fieldLabelClass}>
          현재 단계 <span className="text-[11px] font-semibold text-ink-faint">선택</span>
        </label>
        <select id="c-stage" value={stage} onChange={(e) => setStage(e.target.value)} className={`${selectClass} w-full`}>
          <option value="">선택 안 함</option>
          {LEAD_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="border-0 p-0">
        <legend className={fieldLabelClass}>
          주력 채널 <span className="text-[11px] font-semibold text-ink-faint">선택·복수</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {LEAD_CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={channels.includes(c.value)}
              onClick={() => setChannels(toggleValue(channels, c.value))}
              className={chipClass(channels.includes(c.value))}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-0 p-0">
        <legend className={fieldLabelClass}>
          지금 겪는 어려움 <span className="text-[11px] font-semibold text-ink-faint">선택·복수</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {PAIN_POINTS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={painPoints.includes(p)}
              onClick={() => setPainPoints(toggleValue(painPoints, p))}
              className={chipClass(painPoints.includes(p))}
            >
              {p}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="c-memo" className={fieldLabelClass}>
          메모 <span className="text-[11px] font-semibold text-ink-faint">선택</span>
        </label>
        <textarea
          id="c-memo"
          rows={4}
          value={memo}
          onChange={(e) => setMemo(e.target.value.slice(0, 500))}
          className={textareaClass}
          placeholder="지금 상황을 자유롭게 적어주세요"
        />
        <p className="mt-1 text-right text-[11px] text-ink-faint">{memo.length}/500</p>
      </div>

      {error && (
        <p role="alert" className="text-[12.5px] font-semibold text-danger-text">
          {error}
        </p>
      )}

      <button type="submit" disabled={!canSubmit} className={buttonClass('primary', 'lg', 'w-full')}>
        {busy ? '신청 중…' : '무료 상담 신청'}
      </button>
    </form>
  );
}

/** 자료받기 폼(보조) — 브랜드명 + 이메일만 */
function ResourceForm() {
  const [brandName, setBrandName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = brandName.trim().length > 0 && email.trim().length > 0 && !busy;

  /** 자료받기 제출 → lead_submit 트래킹 */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await submitLead({
        kind: 'resource',
        brandName: brandName.trim(),
        contact: email.trim(),
        source: getSource(),
      });
      sendTrack('lead_submit', { cta: 'resource' });
      setDone(true);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <DoneNotice>신청이 접수되었습니다 — 영업일 기준으로 안내드립니다.</DoneNotice>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="r-brandName" className={fieldLabelClass}>
          브랜드명 <span className="text-coral-strong">*</span>
        </label>
        <input
          id="r-brandName"
          required
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          className={inputClass}
          placeholder="예: OO코스메틱"
        />
      </div>

      <div>
        <label htmlFor="r-email" className={fieldLabelClass}>
          이메일 <span className="text-coral-strong">*</span>
        </label>
        <input
          id="r-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="sample@brand.com"
        />
      </div>

      {error && (
        <p role="alert" className="text-[12.5px] font-semibold text-danger-text">
          {error}
        </p>
      )}

      <button type="submit" disabled={!canSubmit} className={buttonClass('secondary', 'lg', 'w-full')}>
        {busy ? '전송 중…' : '무료 샘플 리포트 받기'}
      </button>
    </form>
  );
}

type LeadMode = 'consultation' | 'resource';

/**
 * 최종 CTA 리드 폼 — 상담 신청(기본, 강조) / 자료받기(보조) 탭 전환.
 * 두 폼은 상태를 공유하지 않는다(각자 독립적으로 제출·완료 처리).
 */
export function LeadForm() {
  const [mode, setMode] = useState<LeadMode>('consultation');

  return (
    <div>
      <div role="tablist" aria-label="문의 유형" className="flex gap-1 border-b border-hairline">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'consultation'}
          onClick={() => setMode('consultation')}
          className={`-mb-px border-b-2 px-4 py-2.5 text-[13.5px] font-bold transition-colors ${
            mode === 'consultation' ? 'border-coral text-coral-strong' : 'border-transparent text-ink-mute hover:text-ink'
          }`}
        >
          무료 상담 신청
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'resource'}
          onClick={() => setMode('resource')}
          className={`-mb-px border-b-2 px-4 py-2.5 text-[13.5px] font-bold transition-colors ${
            mode === 'resource' ? 'border-coral text-coral-strong' : 'border-transparent text-ink-mute hover:text-ink'
          }`}
        >
          무료 샘플 리포트 받기
        </button>
      </div>
      <div role="tabpanel" className="pt-6">
        {mode === 'consultation' ? <ConsultationForm /> : <ResourceForm />}
      </div>
    </div>
  );
}
