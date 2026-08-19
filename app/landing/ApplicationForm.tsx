'use client';

/**
 * 무료 파일럿 진단 신청 폼 — Figma ApplicationForm.
 * 전송은 기존 공개 API `POST /api/lead`를 그대로 쓴다(세션 불필요).
 * 리드 스키마에 없는 두 항목(제품 카테고리·필요한 서비스)은 memo 한 줄로 적어 남긴다 —
 * 컬럼을 새로 파면 스토어 두 구현과 스키마를 함께 고쳐야 하고, 이 두 값은 집계가 아니라
 * 상담 준비용 메모라서 그 값어치가 없다.
 */

import { useState } from 'react';
import { PILOT_CATEGORIES, PILOT_CHANNELS, PILOT_SERVICES, LEAD_STAGES } from '@/lib/lead';
import { sendTrack, getSource } from '@/components/landing/track';
import { APPLICATION } from './content';
import { lpButtonClass } from './primitives';

const fieldLabel = 'block text-[15px] font-semibold text-lp-ink';
const fieldInput =
  'mt-2 h-[52px] w-full rounded-lg border border-lp-line bg-white px-4 text-[16px] text-lp-ink placeholder:text-lp-faint focus:border-lp-line-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-coral';

export function ApplicationForm() {
  const [brandName, setBrandName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState('');
  const [stage, setStage] = useState('');
  // 시안 기본값 — 가장 많이 쓰는 채널과 MVP 핵심 산출물을 미리 켜 둔다(둘 다 해제 가능)
  const [channels, setChannels] = useState<string[]>(['qoo10']);
  const [services, setServices] = useState<string[]>(['진단 리포트']);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = Boolean(brandName.trim() && contact.trim() && consent) && !busy;

  /** 칩·체크박스 공통 토글 */
  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  /** 신청 전송 — 실패해도 입력은 그대로 두고 사유만 알린다 */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const memoParts = [
        category ? `제품 카테고리: ${category}` : '',
        services.length ? `필요한 서비스: ${services.join(', ')}` : '',
      ].filter(Boolean);
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'consultation',
          brandName: brandName.trim(),
          contactName: contactName.trim(),
          contact: contact.trim(),
          channels,
          stage,
          memo: memoParts.join(' / '),
          source: getSource(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? '신청을 접수하지 못했습니다.');
      sendTrack('lead_submit', { cta: 'pilot' });
      setDone(true);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div
        role="status"
        className="mx-auto max-w-[940px] rounded-2xl border border-lp-line bg-white p-10 text-center shadow-[0_8px_24px_rgba(23,36,51,0.06)] animate-fade-up"
      >
        <p className="text-lp-h3 font-bold text-lp-ink">신청이 접수됐습니다</p>
        <p className="mt-3 text-lp-body text-lp-body [text-wrap:pretty]">
          진단 가능 여부와 다음 절차를 남겨 주신 연락처로 안내해 드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-[940px] flex-col gap-6 rounded-2xl border border-lp-line bg-white p-10 shadow-[0_8px_24px_rgba(23,36,51,0.06)] max-sm:p-6"
    >
      <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
        <div>
          <label htmlFor="lp-brand" className={fieldLabel}>
            브랜드명
          </label>
          <input id="lp-brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="예) 글로우리프" className={fieldInput} required />
        </div>
        <div>
          <label htmlFor="lp-name" className={fieldLabel}>
            담당자명
          </label>
          <input id="lp-name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="예) 김서연" className={fieldInput} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
        <div>
          <label htmlFor="lp-contact" className={fieldLabel}>
            업무용 이메일
          </label>
          <input
            id="lp-contact"
            type="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="name@brand.co.kr"
            className={fieldInput}
            required
          />
        </div>
        <div>
          <label htmlFor="lp-category" className={fieldLabel}>
            제품 카테고리
          </label>
          <select id="lp-category" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldInput}>
            <option value="">선택해 주세요</option>
            {PILOT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-6 max-lg:grid-cols-1">
        <div>
          <label htmlFor="lp-stage" className={fieldLabel}>
            일본 진출 단계
          </label>
          <select id="lp-stage" value={stage} onChange={(e) => setStage(e.target.value)} className={fieldInput}>
            <option value="">선택해 주세요</option>
            {LEAD_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className={fieldLabel}>목표 채널</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {PILOT_CHANNELS.map((c) => {
              const on = channels.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(channels, c.value, setChannels)}
                  className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                    on ? 'border-lp-coral bg-lp-coral text-white' : 'border-lp-line bg-white text-lp-body hover:border-lp-line-strong'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <fieldset>
        <legend className={fieldLabel}>필요한 서비스</legend>
        <div className="mt-3 flex flex-wrap gap-7">
          {PILOT_SERVICES.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2.5 py-1 text-[16px] text-lp-body">
              <input
                type="checkbox"
                checked={services.includes(s)}
                onChange={() => toggle(services, s, setServices)}
                className="h-5 w-5 accent-lp-coral"
              />
              {s}
            </label>
          ))}
        </div>
      </fieldset>

      <hr className="border-lp-line" />

      <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[16px] text-lp-body">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-5 w-5 accent-lp-coral" required />
        {APPLICATION.consent}
      </label>

      {error && (
        <p role="alert" className="text-[14px] font-semibold text-lp-risk">
          {error}
        </p>
      )}

      <button type="submit" disabled={!canSubmit} className={lpButtonClass('primary', 'w-full disabled:cursor-default disabled:opacity-40')}>
        {busy ? '신청 중…' : APPLICATION.submit}
      </button>

      <p className="text-center text-[14px] leading-[1.5] text-lp-muted [text-wrap:pretty]">{APPLICATION.note}</p>
    </form>
  );
}
