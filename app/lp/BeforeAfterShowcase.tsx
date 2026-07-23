'use client';

import { useId, useState } from 'react';

/**
 * 최강 자산 — 직역(Before) → 일본 고객 관점 재설계(After) 시연.
 * 카테고리 탭으로 4개 예시를 넘겨보게 해서 "우리가 뭘 하는지"를 말이 아니라 눈으로 보여준다.
 * 일본어 샘플 + 한국어 해설(왜 바꿨나) 구조. 스크롤을 붙잡는 페이지의 척추.
 */

type BaRow = {
  /** 탭 라벨 */
  tab: string;
  /** 직역(나쁜 예) — 일본어 */
  before: string;
  /** 재설계(좋은 예) — 일본어 */
  after: string;
  /** 무엇이 왜 달라졌나 — 한국어 해설 */
  why: string;
};

const ROWS: BaRow[] = [
  {
    tab: '스킨케어 · CICA',
    before: '塗る瞬間、トラブルを消す。即・鎮静CICAアンプル',
    after: '乾燥による肌あれ※が気になる肌を、うるおいでキメ整える。※角層',
    why: "'없앤다'는 효과 보증 표현이라 일본 고객에겐 과장으로 읽힙니다. '수분으로 결을 정돈(整える)'에 각질층 각주를 달아, 믿을 수 있는 톤으로 바꿉니다.",
  },
  {
    tab: '미백',
    before: 'シミが消える美白クリーム',
    after: 'メラニンの生成を抑え、シミ・そばかすを防ぐ。※薬用(医薬部外品)の場合',
    why: "'기미가 사라진다'는 단정입니다. 일본 미백 표준 문형(생성 억제·예방)으로 바꾸고, 의약외품 승인이 없으면 「明るい印象へ」처럼 더 낮춰 씁니다.",
  },
  {
    tab: '더마 · 敏感肌',
    before: '病院処方級、敏感肌のトラブルを治療するケア',
    after: '敏感肌※の方の毎日にも。パッチテスト済み・無添加処方。※すべての方に刺激が起きないわけではありません',
    why: "'치료'와 병원 비교는 쓸 수 없습니다. '패치테스트 완료·무첨가'라는 확인 가능한 안심 근거로 신뢰를 만듭니다.",
  },
  {
    tab: '향 · 바디',
    before: '一日中香りが持続、ストレスを解消するボディミスト',
    after: '気分に寄り添う、みずみずしい香り。朝のひと吹きで、自分を整える時間に。',
    why: "'지속'은 근거가 없고 '스트레스 해소'는 효능 위험입니다. 정서·사용 장면 소구로 바꿔 과장 없이 사고 싶게 만듭니다.",
  },
];

export function BeforeAfterShowcase() {
  const [active, setActive] = useState(0);
  const tablistId = useId();
  const row = ROWS[active];

  return (
    <div>
      {/* 카테고리 탭 */}
      <div role="tablist" aria-label="카테고리별 예시" className="flex flex-wrap gap-2">
        {ROWS.map((r, i) => {
          const selected = i === active;
          return (
            <button
              key={r.tab}
              role="tab"
              type="button"
              id={`${tablistId}-tab-${i}`}
              aria-selected={selected}
              aria-controls={`${tablistId}-panel`}
              onClick={() => setActive(i)}
              className={`rounded-full border px-4 py-2 text-[13.5px] font-bold transition-colors ${
                selected
                  ? 'border-coral bg-coral-tint text-coral-strong'
                  : 'border-card-border bg-canvas text-ink-mute hover:border-input-border hover:text-ink'
              }`}
            >
              {r.tab}
            </button>
          );
        })}
      </div>

      {/* 패널 — 탭 전환 시 key로 재마운트해 부드럽게 교체 */}
      <div
        key={active}
        role="tabpanel"
        id={`${tablistId}-panel`}
        aria-labelledby={`${tablistId}-tab-${active}`}
        className="mt-6 motion-safe:animate-fade-up"
      >
        <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
          {/* Before */}
          <div className="rounded-card border border-card-border bg-n-50 p-6">
            <p className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Before · 직역</p>
            <p lang="ja" className="mt-3 text-[17px] leading-relaxed text-ink-mute line-through decoration-ink-faint/70">
              {row.before}
            </p>
          </div>

          {/* 화살표 — 데스크톱 가로, 모바일 세로 */}
          <div className="flex items-center justify-center text-coral" aria-hidden="true">
            <span className="hidden text-2xl md:inline">→</span>
            <span className="text-2xl md:hidden">↓</span>
          </div>

          {/* After */}
          <div className="rounded-card border border-coral/30 bg-coral-tint p-6 shadow-[0_10px_30px_-12px_rgba(255,100,100,0.35)]">
            <p className="text-[12px] font-bold uppercase tracking-wide text-coral-strong">After · 재설계</p>
            <p lang="ja" className="mt-3 text-[17px] font-medium leading-relaxed text-ink">
              {row.after}
            </p>
          </div>
        </div>

        {/* 왜 바꿨나 — 한국어 해설 */}
        <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-ink-body">
          <span className="font-bold text-ink">무엇이 달라졌나 · </span>
          {row.why}
        </p>
      </div>

      <p className="mt-8 text-[12.5px] text-ink-faint">※ 예시 카피이며 최종 약기법(薬機法) 심의 문구는 아닙니다.</p>
    </div>
  );
}
