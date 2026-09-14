'use client';

/**
 * 제품 등록 도우미(BRAND-03b 3b-5·3b-6·3b-7) — 브랜드 관리와 상세 폼의 인라인 등록이 **함께 쓴다.**
 *
 * 두 화면이 각자 그리면 같은 기능이 두 벌이 되고, 한쪽만 고쳐진 채로 갈린다.
 * 특히 출처 문구(3b-7)는 두 화면에서 같아야 한다 — 사용자는 같은 서비스의 같은 동작으로 읽는다.
 */

import { buttonClass, fieldLabelClass, inputClass, textareaClass } from '@/components/ui/primitives';
import { IconSpinner } from '@/components/ui/icons';

/** KR 원본에서 읽는 스펙 7칸(§2-14). 정본은 서버의 `EXTRACT_FIELDS` 다 */
export const SPEC_FIELDS: { name: string; label: string; multiline?: boolean }[] = [
  { name: 'specVolume', label: '내용량' },
  { name: 'specManufacturer', label: '판매원' },
  { name: 'specOrigin', label: '원산지' },
  { name: 'specFullIngredients', label: '전성분', multiline: true },
  { name: 'ingredientRows', label: '주요 성분표', multiline: true },
  { name: 'howToSteps', label: '사용법', multiline: true },
  { name: 'cautions', label: '주의사항', multiline: true },
];

/** 확인 전까지 상세 생성에서 그 블록을 세우지 않는 칸(§2-14 규정 가드) */
export const REVIEW_REQUIRED = ['specFullIngredients', 'ingredientRows'];

/** 자동으로 채운 칸의 출처(BRAND-03b 3b-7). 값이 어디서 왔는지 화면이 반드시 말한다 */
export type FieldOrigin = 'web' | 'source';

export const ORIGIN_LABEL: Record<FieldOrigin, string> = {
  web: '웹에서 찾았습니다',
  source: '올려 주신 원본에서 읽었습니다',
};

/** 제품 식별 후보(3b-5) — 출처 없는 후보는 카드로 세우지 않는다 */
export interface Candidate {
  nameKr: string;
  nameJa: string;
  category: string;
  sourceUrl: string;
}

/**
 * 자동으로 채운 칸의 출처 한 줄(BRAND-03b 3b-7).
 *
 * **조용히 채우지 않는 것이 이 컴포넌트의 존재 이유다.** UT-31 선례 — placeholder 를 실제
 * 입력값으로 오인한 사용자가 "나는 저걸 입력한 적이 없다"(P05)며 서비스를 의심했다.
 */
export function OriginNote({ origin }: { origin?: FieldOrigin }) {
  if (!origin) return null;
  return <span className="mt-1 block text-[11px] font-normal text-coral-strong">{ORIGIN_LABEL[origin]}</span>;
}

/**
 * 제품 식별 후보(BRAND-03b 3b-5).
 *
 * **후보 0건이 정상 경로다.** 2~30인 브랜드의 신제품·미출시 제품은 웹에 없다.
 * 0건을 실패로 다루면 폴백(수동 입력)이 곁다리가 되고, 그러면 이 기능은 등록을 느리게만 만든다.
 * 그래서 이 패널은 어떤 상태에서도 **폼을 가리거나 잠그지 않는다.**
 */
export function CandidatePanel({
  busy,
  candidates,
  note,
  onPick,
}: {
  busy: boolean;
  candidates: Candidate[] | null;
  note: string | null;
  onPick: (c: Candidate) => void;
}) {
  if (!busy && !note && (candidates?.length ?? 0) === 0) return null;
  return (
    <div className="rounded-lg bg-coral-tint px-4 py-3">
      {busy ? (
        <p className="flex items-center gap-2 text-[13px] text-ink-body">
          <IconSpinner size={13} className="animate-spin" />
          올려 주신 제품컷으로 이 제품을 찾고 있습니다. 기다리지 않고 그냥 입력하셔도 됩니다.
        </p>
      ) : note ? (
        <p className="text-[13px] leading-relaxed text-ink-body [text-wrap:pretty]">{note}</p>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-ink-body [text-wrap:pretty]">
            <b>웹에서 찾은 제품입니다.</b> 맞는 것을 고르면 이름과 카테고리가 채워집니다.
          </p>
          <ul className="mt-2.5 space-y-2">
            {candidates?.map((c) => (
              <li key={c.sourceUrl} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="flex-1 rounded-lg border border-coral/40 bg-canvas px-3 py-2 text-left transition-colors hover:border-coral"
                >
                  <span className="block text-[13px] font-bold text-ink">{c.nameKr}</span>
                  {c.nameJa && (
                    <span lang="ja" className="mt-0.5 block text-[12px] text-ink-mute">
                      {c.nameJa}
                    </span>
                  )}
                  {c.category && <span className="mt-0.5 block text-[11px] text-ink-faint">{c.category}</span>}
                </button>
                {/* 출처를 버리지 않는다 — 사용자가 직접 확인할 수 있어야 한다 */}
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[11px] text-coral-strong underline-offset-2 hover:underline"
                >
                  {hostOf(c.sourceUrl)}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** 출처 URL 을 도메인만 보여준다 — 긴 주소가 카드를 밀어내지 않게 */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '출처';
  }
}

/**
 * KR 상세 원본 판독(BRAND-03b 3b-6) — 콜⑩ 이 읽은 스펙 7칸.
 *
 * 여기서 읽은 값은 **제품에 저장**되고, 상세 폼이 그 제품을 고를 때 프리필로 가져간다.
 * 전성분·성분표는 확인 전까지 상세 생성에서 그 블록을 세우지 않는다(§2-14 규정 가드).
 */
export function SpecPanel({
  busy,
  spec,
  origins,
  reviewed,
  missing,
  note,
  inputRef,
  onPick,
  onEdit,
  onReview,
}: {
  busy: boolean;
  spec: Record<string, string>;
  origins: Record<string, FieldOrigin>;
  reviewed: string[];
  missing: { field: string; reason: string }[];
  note: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (files: FileList) => void;
  onEdit: (name: string, value: string) => void;
  onReview: (name: string) => void;
}) {
  const filled = SPEC_FIELDS.filter((f) => spec[f.name]);
  const waiting = REVIEW_REQUIRED.filter((f) => spec[f] && origins[f] === 'source' && !reviewed.includes(f));

  return (
    <div>
      <p className={fieldLabelClass}>
        한국 상세페이지 원본 <span className="font-normal text-ink-mute">(선택)</span>
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-mute [text-wrap:pretty]">
        글자가 박힌 상세 스크린샷을 올리면 용량·판매원·전성분 같은 칸을 읽어 제품에 저장합니다. 상세페이지를 만들 때
        다시 입력하지 않습니다.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onPick(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`mt-2 ${buttonClass('secondary', 'sm')}`}
      >
        {busy ? '읽는 중…' : filled.length > 0 ? '원본 다시 올리기' : '원본 올리기'}
      </button>

      {busy && (
        <p className="mt-2 flex items-center gap-2 text-[12px] text-ink-mute">
          <IconSpinner size={12} className="animate-spin" />
          원본에서 스펙을 읽고 있습니다.
        </p>
      )}
      {note && <p className="mt-2 text-[12px] leading-relaxed text-ink-body">{note}</p>}

      {/* 못 읽은 칸은 사유를 남긴다 — 왜 비었는지 모르면 원본을 의심한다 */}
      {missing.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {missing.map((m) => (
            <li key={m.field} className="text-[11px] leading-relaxed text-ink-mute">
              {m.reason}
            </li>
          ))}
        </ul>
      )}

      {filled.length > 0 && (
        <div className="mt-3 space-y-3 rounded-lg border border-card-border bg-n-50 px-4 py-3.5">
          {filled.map((f) => (
            <label key={f.name} className={fieldLabelClass}>
              {f.label}
              {f.multiline ? (
                <textarea
                  value={spec[f.name]}
                  onChange={(e) => onEdit(f.name, e.target.value)}
                  rows={2}
                  className={`mt-1.5 ${textareaClass} ${origins[f.name] === 'source' ? 'bg-coral-tint' : ''}`}
                />
              ) : (
                <input
                  value={spec[f.name]}
                  onChange={(e) => onEdit(f.name, e.target.value)}
                  className={`mt-1.5 ${inputClass} ${origins[f.name] === 'source' ? 'bg-coral-tint' : ''}`}
                />
              )}
              <OriginNote origin={origins[f.name]} />
            </label>
          ))}

          {waiting.length > 0 && (
            <div className="border-t border-hairline pt-3">
              <p className="text-[12px] leading-relaxed text-ink-body [text-wrap:pretty]">
                <b>확인이 필요한 칸이 있습니다.</b> 전성분과 성분표는 표시 의무·효능 주장의 근거라, 확인하시기 전까지
                상세페이지에서 해당 블록을 넣지 않습니다.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {waiting.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onReview(name)}
                    className="rounded-lg border border-coral/40 px-2.5 py-1 text-[12px] font-bold text-coral-strong transition-colors hover:bg-coral-tint"
                  >
                    {SPEC_FIELDS.find((f) => f.name === name)?.label} 확인했습니다
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
