/**
 * 블록별 satori 렌더 트리 — 상세페이지의 모든 문자는 여기서 벡터로 그려진다.
 *
 * ⚠ satori 제약(실측):
 *   - `display: grid` 불가. flex 만 지원한다 — 표는 row 반복, 스와치는 flexWrap 으로 만든다.
 *   - 모든 요소에 display 를 명시해야 한다(기본값이 block 이 아님).
 *   - 폰트는 Buffer 로 직접 넘긴다(fonts.ts). 커버리지 밖 글자는 safeText 가 먼저 막는다.
 *
 * 디자인 토큰은 app/globals.css 의 @theme 값을 그대로 옮겼다(코랄 #ff6464 단일 시스템).
 * 로고 네이비는 워드마크 전용이라 여기서 쓰지 않는다.
 */

import type { ReactElement, ReactNode } from 'react';
import { safeText } from './render';
import type { BlockType } from './output';

const T = {
  ink: '#202124',
  body: '#414245',
  mute: 'rgba(55,56,60,0.61)',
  faint: '#b6b8bf',
  coral: '#ff6464',
  coralStrong: '#d93636',
  coralTint: '#fff8f8',
  hairline: '#ebebeb',
  surface: '#f7f7f8',
  white: '#ffffff',
  pad: 72,
} as const;

/** 블록 렌더에 필요한 문맥 — 슬롯 외의 값들. */
export interface BlockRenderContext {
  brandName: string;
  /** 배경컷이 깔린 hybrid 블록인가(글자 대비를 위해 배경 카드가 필요) */
  hasBackground: boolean;
}

/** 여러 값을 담는 슬롯은 줄바꿈으로 구분한다(팩 정의). */
function lines(v: string | undefined): string[] {
  return (v ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
}

/** `제목|본문|각주` 형식의 행을 파싱한다. */
function cols(line: string, n: number): string[] {
  const parts = line.split('|').map((s) => s.trim());
  return Array.from({ length: n }, (_, i) => parts[i] ?? '');
}

/**
 * 세로 스택 래퍼.
 * ⚠ satori 는 React Fragment(<>...</>)를 컬럼으로 펼치지 못해 자식들이 가로로 겹친다.
 *   그래서 여러 요소를 묶을 때는 반드시 실제 flex 컨테이너를 쓴다.
 */
function Stack({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>;
}

/** 블록 바깥 여백 컨테이너 — 모든 블록이 같은 그리드에 정렬되도록 강제한다. */
function Frame({ children, tint }: { children: ReactNode; tint?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: `${T.pad}px ${T.pad}px ${T.pad - 16}px`,
        backgroundColor: tint ?? 'transparent',
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', color: T.coral, fontSize: 26, fontWeight: 700, letterSpacing: 4 }}>
      {text}
    </div>
  );
}

function Headline({ text, size = 52 }: { text: string; size?: number }) {
  return (
    <div style={{ display: 'flex', marginTop: 18, fontSize: size, fontWeight: 700, color: T.ink, lineHeight: 1.35 }}>
      {text}
    </div>
  );
}

function Body({ text, marginTop = 24 }: { text: string; marginTop?: number }) {
  return (
    <div style={{ display: 'flex', marginTop, fontSize: 27, lineHeight: 1.75, color: T.body }}>{text}</div>
  );
}

function Footnotes({ items, marginTop = 32 }: { items: string[]; marginTop?: number }) {
  if (items.length === 0) return <div style={{ display: 'flex' }} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop }}>
      {items.map((t, i) => (
        <div key={i} style={{ display: 'flex', fontSize: 19, lineHeight: 1.6, color: T.mute, marginTop: i === 0 ? 0 : 6 }}>
          {t}
        </div>
      ))}
    </div>
  );
}

/** 2열 표 — satori에 grid가 없어 row를 반복한다. */
function Rows({ rows, labelWidth = 260 }: { rows: [string, string][]; labelWidth?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, borderTop: `2px solid ${T.ink}` }}>
      {rows.map(([label, value], i) => (
        <div key={i} style={{ display: 'flex', borderBottom: `1px solid ${T.hairline}`, padding: '16px 0' }}>
          <div style={{ display: 'flex', width: labelWidth, color: T.mute, fontSize: 24 }}>{label}</div>
          <div style={{ display: 'flex', flex: 1, color: T.ink, fontSize: 24, lineHeight: 1.6 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 32 }}>
      {items.map((t, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            border: `1px solid ${T.coral}`,
            color: T.coralStrong,
            borderRadius: 999,
            padding: '10px 22px',
            marginRight: 12,
            marginBottom: 12,
            fontSize: 23,
          }}
        >
          {t}
        </div>
      ))}
    </div>
  );
}

/**
 * 배지 라벨(CASE1·POINT 2 …)은 **코드가 붙인다**. LLM이 제목 열에 같은 라벨을 또 넣으면
 * `POINT 1 │ POINT1 うるおい成分配合` 처럼 이중 표기가 되므로 여기서 걷어낸다.
 * 팩의 슬롯 설명으로도 막지만, 모델 출력에 최종 책임을 지지 않기 위해 렌더 직전에 한 번 더 막는다.
 * 제목이 라벨뿐이면(`CASE1`) 본문을 제목 자리로 올린다.
 * @param title LLM이 채운 제목 열
 * @param body  같은 항목의 본문 열
 * @param label 배지 라벨(`CASE`·`POINT ` 등, 뒤 공백 허용)
 */
export function stripAutoLabel(title: string, body: string, label: string): { title: string; body: string } {
  const token = label.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const numbered = new RegExp(`^${token}\\s*\\d+\\s*[:：.、·\\-]?\\s*`, 'i');
  const trimmed = title.trim();
  const stripped = numbered.test(trimmed)
    ? trimmed.replace(numbered, '').trim()
    : trimmed.toUpperCase() === token.toUpperCase()
      ? ''
      : trimmed;
  return stripped ? { title: stripped, body } : { title: body, body: '' };
}

/** 번호가 붙은 항목 목록(POINT·STEP·CASE 공용). */
function NumberedList({ items, label }: { items: { title: string; body: string; note?: string }[]; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36 }}>
      {items.map((raw, i) => {
        const { title, body } = stripAutoLabel(raw.title, raw.body, label);
        const it = { ...raw, title, body };
        return (
        <div key={i} style={{ display: 'flex', marginTop: i === 0 ? 0 : 28 }}>
          {/* 라벨 길이가 CASE1·POINT 1 등으로 달라지므로 고정 원형이 아니라 알약형으로 둔다 */}
          <div
            style={{
              display: 'flex',
              minWidth: 132,
              height: 52,
              flexShrink: 0,
              borderRadius: 999,
              backgroundColor: T.coralTint,
              color: T.coralStrong,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 20px',
            }}
          >
            {`${label}${i + 1}`.trim()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 24, flex: 1 }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: T.ink, lineHeight: 1.4 }}>{it.title}</div>
            {it.body ? (
              <div style={{ display: 'flex', marginTop: 8, fontSize: 25, lineHeight: 1.7, color: T.body }}>{it.body}</div>
            ) : null}
            {it.note ? (
              <div style={{ display: 'flex', marginTop: 6, fontSize: 19, color: T.mute }}>{it.note}</div>
            ) : null}
          </div>
        </div>
        );
      })}
    </div>
  );
}

/** 배경컷 위에 얹는 카드 — 사진 위 글자 가독성 확보. */
function OverlayCard({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <div style={{ display: 'flex', padding: T.pad, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 640,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderRadius: 18,
          padding: 48,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * 블록 본문 트리를 만든다. 슬롯 문자열은 전부 safeText 를 거쳐
 * 폰트 커버리지 밖 글자(한글·이모지 등)를 미리 차단한다.
 */
export function blockContent(
  blockId: BlockType,
  slots: Record<string, string>,
  ctx: BlockRenderContext,
): ReactElement {
  const s = (key: string): string => {
    const v = slots[key];
    return v ? safeText(v, `${blockId}.${key}`) : '';
  };
  const sLines = (key: string) => lines(s(key));

  switch (blockId) {
    case 'mall-promo-banner':
      return (
        <Frame tint={T.coralTint}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: T.coralStrong, lineHeight: 1.35 }}>
              {s('couponTitleJa')}
            </div>
            {s('discountRateJa') ? (
              <div style={{ display: 'flex', marginTop: 12, fontSize: 64, fontWeight: 700, color: T.ink }}>
                {s('discountRateJa')}
              </div>
            ) : null}
            {s('periodJa') ? <Body text={s('periodJa')} marginTop={16} /> : null}
          </div>
          <Footnotes items={sLines('conditionFootnoteJa')} marginTop={24} />
        </Frame>
      );

    case 'set-offer-table': {
      const rows: [string, string][] = [];
      if (s('normalPriceJa')) rows.push(['通常価格', s('normalPriceJa')]);
      rows.push(['販売価格', s('salePriceJa')]);
      if (s('discountRateJa')) rows.push(['割引', s('discountRateJa')]);
      if (s('giftJa')) rows.push(['特典', s('giftJa')]);
      return (
        <Frame>
          <Eyebrow text="SET OFFER" />
          <Headline text={s('setTitleJa')} size={44} />
          <Rows rows={rows} />
          <Footnotes items={sLines('footnoteJa')} />
        </Frame>
      );
    }

    case 'hero-product': {
      const inner = (
        <Stack>
          {s('functionLabelJa') ? <Eyebrow text={s('functionLabelJa')} /> : <Eyebrow text={ctx.brandName} />}
          <Headline text={s('catchCopyJa')} />
          {s('subCopyJa') ? <Body text={s('subCopyJa')} /> : null}
          <div style={{ display: 'flex', marginTop: 28, fontSize: 26, color: T.mute }}>
            {[s('productNameJa'), s('volumeJa')].filter(Boolean).join('　/　')}
          </div>
        </Stack>
      );
      return ctx.hasBackground ? <OverlayCard>{inner}</OverlayCard> : <Frame>{inner}</Frame>;
    }

    case 'ranking-stack':
      return (
        <Frame tint={T.surface}>
          <Eyebrow text="RANKING" />
          <Headline text={s('rankTitleJa')} size={46} />
          <Body text={`${s('genreJa')}　${s('aggregationDateJa')}`} />
          <Footnotes items={sLines('footnoteJa')} />
        </Frame>
      );

    case 'cumulative-sales':
      return (
        <Frame tint={T.surface}>
          <Eyebrow text="THANKS" />
          <Headline text={s('cumulativeCountJa')} />
          <Rows
            rows={[
              ['集計期間', s('aggregationPeriodJa')],
              ...(s('reviewCountJa') ? ([['レビュー', s('reviewCountJa')]] as [string, string][]) : []),
              ...(s('ratingJa') ? ([['評価', s('ratingJa')]] as [string, string][]) : []),
            ]}
          />
        </Frame>
      );

    case 'problem-hook': {
      const inner = (
        <Stack>
          <Headline text={s('hookQuestionJa')} size={46} />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28 }}>
            {sLines('painPointsJa').map((t, i) => (
              <div key={i} style={{ display: 'flex', marginTop: i === 0 ? 0 : 14, alignItems: 'center' }}>
                <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 999, backgroundColor: T.coral, marginRight: 16 }} />
                <div style={{ display: 'flex', fontSize: 28, color: T.body, lineHeight: 1.6 }}>{t}</div>
              </div>
            ))}
          </div>
          {s('empathyCopyJa') ? <Body text={s('empathyCopyJa')} marginTop={28} /> : null}
        </Stack>
      );
      return ctx.hasBackground ? <OverlayCard>{inner}</OverlayCard> : <Frame tint={T.surface}>{inner}</Frame>;
    }

    case 'cause-structure':
      return (
        <Frame>
          <Eyebrow text="CAUSE" />
          <Headline text={s('titleJa')} size={44} />
          <NumberedList
            label="CASE"
            items={sLines('causeItemsJa').map((l) => {
              const [title, body] = cols(l, 2);
              return { title, body };
            })}
          />
          {s('causeSummaryJa') ? <Body text={s('causeSummaryJa')} marginTop={32} /> : null}
        </Frame>
      );

    case 'before-after-diagram':
      return (
        <Frame>
          <div style={{ display: 'flex' }}>
            {[s('leftLabelJa'), s('rightLabelJa')].map((t, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flex: 1,
                  justifyContent: 'center',
                  fontSize: 30,
                  fontWeight: 700,
                  color: i === 0 ? T.mute : T.coralStrong,
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <Footnotes items={sLines('footnoteJa')} marginTop={20} />
        </Frame>
      );

    case 'mechanism-explainer':
      return (
        <Frame>
          <Eyebrow text="MECHANISM" />
          <Headline text={s('mechanismTitleJa')} size={44} />
          <NumberedList
            label="STEP"
            items={sLines('stepsJa').map((l) => {
              const [title, body] = cols(l, 2);
              return { title, body };
            })}
          />
          <Footnotes items={sLines('scopeFootnoteJa')} />
        </Frame>
      );

    case 'ingredient-card':
      return (
        <Frame>
          <Eyebrow text={s('sectionLabel') || 'INGREDIENT'} />
          <Headline text={s('headlineJa')} />
          <Body text={s('bodyJa')} />
          <Rows
            rows={sLines('ingredientRows').map((l) => {
              const [name, percent, purpose] = cols(l, 3);
              return [name, [percent, purpose].filter(Boolean).join('　')] as [string, string];
            })}
          />
          <Footnotes items={sLines('purposeFootnoteJa')} />
        </Frame>
      );

    case 'quant-data-graph': {
      const rows = sLines('dataRows').map((l) => cols(l, 2));
      const max = Math.max(...rows.map(([, v]) => Number(String(v).replace(/[^\d.]/g, '')) || 0), 1);
      return (
        <Frame>
          <Eyebrow text="DATA" />
          <Headline text={s('metricNameJa')} size={44} />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36 }}>
            {rows.map(([label, value], i) => {
              const n = Number(String(value).replace(/[^\d.]/g, '')) || 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', marginTop: i === 0 ? 0 : 20 }}>
                  <div style={{ display: 'flex', width: 240, fontSize: 24, color: T.mute }}>{label}</div>
                  <div style={{ display: 'flex', flex: 1, height: 40, backgroundColor: T.surface, borderRadius: 6 }}>
                    <div style={{ display: 'flex', width: `${Math.round((n / max) * 100)}%`, backgroundColor: T.coral, borderRadius: 6 }} />
                  </div>
                  <div style={{ display: 'flex', width: 140, justifyContent: 'flex-end', fontSize: 26, fontWeight: 700, color: T.ink }}>
                    {value}
                  </div>
                </div>
              );
            })}
          </div>
          <Footnotes items={sLines('sourceFootnoteJa')} />
        </Frame>
      );
    }

    case 'test-evidence-label':
      return (
        <Frame tint={T.surface}>
          <Eyebrow text="EVIDENCE" />
          <Chips items={sLines('testNamesJa')} />
          <Rows
            rows={[
              ...(s('testConditionJa') ? ([['試験条件', s('testConditionJa')]] as [string, string][]) : []),
              ['実施機関', s('institutionJa')],
              ['実施時期', s('dateJa')],
              ['対象人数', s('sampleSizeJa')],
            ]}
          />
          <Footnotes items={sLines('disclaimerJa')} />
        </Frame>
      );

    case 'point-list':
      return (
        <Frame>
          <Eyebrow text={s('sectionLabel') || 'POINT'} />
          <NumberedList
            label="POINT "
            items={sLines('pointsJa').map((l) => {
              const [title, body, note] = cols(l, 3);
              return { title, body, note: note || undefined };
            })}
          />
        </Frame>
      );

    case 'spec-panel':
      return (
        <Frame>
          <Eyebrow text="SPEC" />
          {s('highlightJa') ? <Headline text={s('highlightJa')} /> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 36 }}>
            {sLines('specRows').map((l, i) => {
              const [label, value] = cols(l, 2);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: 320,
                    marginRight: 16,
                    marginBottom: 16,
                    padding: 28,
                    backgroundColor: T.coralTint,
                    borderRadius: 18,
                  }}
                >
                  <div style={{ display: 'flex', fontSize: 22, color: T.mute }}>{label}</div>
                  <div style={{ display: 'flex', marginTop: 8, fontSize: 44, fontWeight: 700, color: T.coralStrong }}>{value}</div>
                </div>
              );
            })}
          </div>
          <Footnotes items={sLines('footnoteJa')} marginTop={20} />
        </Frame>
      );

    case 'usage-scene': {
      const inner = (
        <Stack>
          <Eyebrow text="SCENE" />
          <Chips items={sLines('scenesJa')} />
          {s('sceneNoteJa') ? <Body text={s('sceneNoteJa')} marginTop={16} /> : null}
        </Stack>
      );
      return ctx.hasBackground ? <OverlayCard>{inner}</OverlayCard> : <Frame>{inner}</Frame>;
    }

    case 'free-from-badges':
      return (
        <Frame tint={T.surface}>
          {s('headlineJa') ? <Headline text={s('headlineJa')} size={44} /> : <Eyebrow text="FREE FROM" />}
          <Chips items={sLines('freeFromJa').map((t) => (t.endsWith('フリー') || t.endsWith('不使用') ? t : `${t}フリー`))} />
          <Footnotes items={sLines('footnoteJa')} marginTop={12} />
        </Frame>
      );

    case 'color-chip-grid':
      return (
        <Frame>
          <Eyebrow text="COLOR" />
          <Headline text={s('headlineJa')} size={44} />
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 36 }}>
            {sLines('colorRows').map((l, i) => {
              const [no, nameJa, nameEn, hex] = cols(l, 4);
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', width: 168, marginRight: 16, marginBottom: 24 }}>
                  <div style={{ display: 'flex', width: 168, height: 168, borderRadius: 18, backgroundColor: hex || T.faint }} />
                  <div style={{ display: 'flex', marginTop: 12, fontSize: 22, fontWeight: 700, color: T.ink }}>
                    {[no, nameJa].filter(Boolean).join(' ')}
                  </div>
                  {nameEn ? <div style={{ display: 'flex', fontSize: 19, color: T.mute }}>{nameEn}</div> : null}
                </div>
              );
            })}
          </div>
        </Frame>
      );

    case 'color-chart-matrix': {
      const [ax1, ax2, ax3, ax4] = cols(s('axisLabelsJa') || 'Light|Warm|Cool|Dark', 4);
      return (
        <Frame>
          <Eyebrow text="COLOR CHART" />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'center', fontSize: 22, color: T.mute }}>{ax1}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
              <div style={{ display: 'flex', width: 90, fontSize: 22, color: T.mute }}>{ax2}</div>
              <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap', border: `1px solid ${T.hairline}`, borderRadius: 18, padding: 24, minHeight: 320 }}>
                {sLines('placements').map((l, i) => {
                  const [no, name, hex] = cols(l, 3);
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', width: 132, marginRight: 12, marginBottom: 12 }}>
                      <div style={{ display: 'flex', width: 132, height: 88, borderRadius: 12, backgroundColor: hex || T.faint }} />
                      <div style={{ display: 'flex', marginTop: 6, fontSize: 19, color: T.body }}>{[no, name].filter(Boolean).join(' ')}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', width: 90, justifyContent: 'flex-end', fontSize: 22, color: T.mute }}>{ax3}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, fontSize: 22, color: T.mute }}>{ax4}</div>
          </div>
        </Frame>
      );
    }

    case 'personal-color-look': {
      const inner = (
        <Stack>
          <Eyebrow text="PERSONAL COLOR" />
          <NumberedList
            label="LOOK "
            items={sLines('looksJa').map((l) => {
              const [shade, pc, mood] = cols(l, 3);
              return { title: `${shade}　${pc}`, body: mood };
            })}
          />
        </Stack>
      );
      return ctx.hasBackground ? <OverlayCard align="right">{inner}</OverlayCard> : <Frame>{inner}</Frame>;
    }

    case 'lineup-compare-chart': {
      const axes = sLines('axesJa');
      return (
        <Frame>
          <Eyebrow text="LINEUP" />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, borderTop: `2px solid ${T.ink}` }}>
            <div style={{ display: 'flex', padding: '14px 0', borderBottom: `1px solid ${T.hairline}` }}>
              <div style={{ display: 'flex', width: 300, fontSize: 22, color: T.mute }} />
              {axes.map((a, i) => (
                <div key={i} style={{ display: 'flex', flex: 1, justifyContent: 'center', fontSize: 22, color: T.mute }}>{a}</div>
              ))}
            </div>
            {sLines('itemRows').map((l, i) => {
              const parts = l.split('|').map((x) => x.trim());
              const name = parts[0] ?? '';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '18px 0', borderBottom: `1px solid ${T.hairline}` }}>
                  <div style={{ display: 'flex', width: 300, fontSize: 26, fontWeight: 700, color: T.ink }}>{name}</div>
                  {axes.map((_, j) => (
                    <div key={j} style={{ display: 'flex', flex: 1, justifyContent: 'center', fontSize: 26, color: T.coralStrong }}>
                      {parts[j + 1] ?? '-'}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <Footnotes items={[...sLines('benchmarkFootnoteJa'), ...sLines('effectFootnoteJa')]} marginTop={20} />
        </Frame>
      );
    }

    case 'swatch-demo':
      return (
        <Frame>
          <Footnotes items={sLines('demoNoteJa')} marginTop={0} />
        </Frame>
      );

    case 'how-to-use':
      return (
        <Frame tint={T.surface}>
          <Eyebrow text={s('sectionLabel') || 'HOW TO USE'} />
          <NumberedList
            label="STEP "
            items={sLines('stepsJa').map((l) => {
              const [title, body] = cols(l, 2);
              return body ? { title, body } : { title: l, body: '' };
            })}
          />
          {s('amountJa') || s('timingJa') ? (
            <Rows
              rows={[
                ...(s('amountJa') ? ([['使用量', s('amountJa')]] as [string, string][]) : []),
                ...(s('timingJa') ? ([['タイミング', s('timingJa')]] as [string, string][]) : []),
              ]}
            />
          ) : null}
        </Frame>
      );

    case 'brand-story': {
      const inner = (
        <Stack>
          <Eyebrow text="BRAND" />
          <Headline text={s('conceptTitleJa')} />
          <Body text={s('storyBodyJa')} />
        </Stack>
      );
      return ctx.hasBackground ? <OverlayCard>{inner}</OverlayCard> : <Frame>{inner}</Frame>;
    }

    case 'texture-shot': {
      if (!s('textureCopyJa')) return <Frame><div style={{ display: 'flex' }} /></Frame>;
      const inner = <Headline text={s('textureCopyJa')} size={44} />;
      return ctx.hasBackground ? <OverlayCard>{inner}</OverlayCard> : <Frame>{inner}</Frame>;
    }

    case 'customer-review':
      return (
        <Frame tint={T.surface}>
          <Eyebrow text="REVIEW" />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32 }}>
            {sLines('reviewRows').map((l, i) => {
              const [text, rating, age] = cols(l, 3);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    marginTop: i === 0 ? 0 : 20,
                    backgroundColor: T.white,
                    borderRadius: 18,
                    padding: 32,
                  }}
                >
                  <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.7, color: T.body }}>{text}</div>
                  <div style={{ display: 'flex', marginTop: 12, fontSize: 21, color: T.mute }}>
                    {[rating, age].filter(Boolean).join('　/　')}
                  </div>
                </div>
              );
            })}
          </div>
          <Footnotes items={[s('reviewSourceJa'), s('reviewCountJa')].filter(Boolean)} marginTop={20} />
        </Frame>
      );

    case 'product-spec-table':
      return (
        <Frame>
          <Eyebrow text="PRODUCT" />
          <Rows
            rows={[
              ...sLines('specRows').map((l) => cols(l, 2) as [string, string]),
              ['全成分', s('fullIngredientsJa')],
            ]}
          />
        </Frame>
      );

    case 'footnote-block':
      return (
        <Frame>
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${T.hairline}`, paddingTop: 28 }}>
            {sLines('footnoteRows').map((t, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 20, lineHeight: 1.7, color: T.mute, marginTop: i === 0 ? 0 : 6 }}>
                {t}
              </div>
            ))}
            {sLines('cautionsJa').length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
                <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: T.body }}>ご使用上の注意</div>
                {sLines('cautionsJa').map((t, i) => (
                  <div key={i} style={{ display: 'flex', marginTop: 8, fontSize: 20, lineHeight: 1.7, color: T.mute }}>{t}</div>
                ))}
              </div>
            ) : null}
          </div>
        </Frame>
      );

    default: {
      // 팩에 블록이 추가됐는데 렌더 트리가 없으면 조용히 빈 블록을 내보내지 않는다
      const never: never = blockId;
      throw new Error(`렌더 트리가 정의되지 않은 블록: ${String(never)}`);
    }
  }
}
