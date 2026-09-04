/**
 * 블록별 satori 렌더 트리 — 상세페이지의 모든 문자는 여기서 벡터로 그려진다.
 *
 * ⚠ satori 제약(실측 · §2-8):
 *   - `display: grid` 불가. flex 만 지원한다 — 표는 row 반복, 스와치는 flexWrap 으로 만든다.
 *   - 모든 요소에 display 를 명시해야 한다(기본값이 block 이 아님).
 *   - `z-index` 미지원. 페인트 순서 = 문서 순서.
 *   - `clipPath` 는 px 만. `%` 를 쓰면 요소가 **경고 없이 사라진다** → 삼각형은 rotate 로 만든다.
 *   - 폰트는 Buffer 로 직접 넘긴다(fonts.ts). 커버리지 밖 글자는 safeText 가 먼저 막는다.
 *
 * ⚠ **모듈 전역 색 토큰을 두지 않는다**(§2-7 「코드 이식 시 반드시 지킬 것」).
 *   satori 는 `blockContent` 가 반환한 **뒤에** 함수 컴포넌트를 호출하고, 블록 렌더는 `Promise.all` 이다.
 *   전역 `let T` 를 갈아끼우면 동시에 도는 다른 브랜드의 테마로 오염된다.
 *   그래서 모든 색·간격은 `blockContent` 안에서 만든 **팩토리 클로저**로만 흐른다.
 *   (React Context 도 불가 — satori 는 리컨실러를 돌리지 않는다)
 *
 * 색은 **고객 브랜드의 것**이다(관통 원칙 4). YOAKE 일출 코랄은 여기 없다 —
 * app/globals.css 의 코랄 디자인시스템은 YOAKE 앱 화면 전용이고, 산출물과 무관하다.
 */

import type { ReactElement, ReactNode } from 'react';
import { safeText } from './render';
import { CANVAS_WIDTH, type BlockType } from './output';
import type { CopyPlacement } from './safeArea';
import { DENSITY_GAP, surfaceFor, type BandDensity, type BandSurfaceTokens, type BandTone } from './rhythm';
import { NEUTRAL_INK, mixWhite, type DetailTheme } from './theme';

/** 블록 바깥 여백. 모든 블록이 같은 그리드에 정렬되도록 강제한다. */
const PAD = 72;

/** 챕터 레일 폭(좌측 바 + `03 / 06` 인덱스). */
const RAIL_W = 96;

/** 템플릿별 타이포 스케일. 같은 블록이라도 D2(데이터 조밀)와 D6(프리미엄)이 다르게 읽혀야 한다. */
const TYPE_SCALE: Record<'compact' | 'normal' | 'display', number> = {
  compact: 0.92,
  normal: 1,
  display: 1.12,
};

/** 블록 렌더에 필요한 문맥 — 슬롯 외의 값 전부. */
export interface BlockRenderContext {
  brandName: string;
  /** 배경컷이 깔린 블록인가 */
  hasBackground: boolean;
  /** 해석된 테마(theme.ts). 색은 전부 여기서 파생된다 */
  theme: DetailTheme;
  /** 밴드 톤(rhythm.ts planLayout) */
  tone: BandTone;
  /** 'photo' = 사진이 밴드를 채운다 · 'inset' = 색면 위 텍스트 */
  surface: 'photo' | 'inset';
  /** 사진 밴드에서 카피가 앉을 실측 여백(safeArea.ts). inset 이면 없다 */
  placement?: CopyPlacement;
  density: BandDensity;
  /** 챕터 오프너면 좌측 레일 + `03 / 06` 인덱스 */
  chapter: { index: number; total: number } | null;
  /** 다음 밴드 톤 — 이음새 노치를 그 색으로 그린다 */
  nextTone: BandTone | null;
  seam: 'notch' | 'none';
  typeScale: 'compact' | 'normal' | 'display';
  /**
   * 이 블록이 실제로 쓸 수 있는 바깥 폭(px).
   *
   * ⚠ satori 에는 **명시 폭이 필요하다.** yoga 는 폭이 확정되지 않은 flex 자식을 0까지 줄일 수 있어,
   *   `flexGrow: 1` 만 믿으면 본문이 **한 줄에 한 글자씩** 세로로 흐른다(실제로 그렇게 나왔다).
   *   사진 밴드는 실측 여백의 폭이, 색면 밴드는 캔버스 폭이 들어온다.
   */
  availableWidth: number;
}

/** 여러 값을 담는 슬롯은 줄바꿈으로 구분한다(팩 정의). */
function lines(v: string | undefined): string[] {
  return (v ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `제목|본문|각주` 형식의 행을 파싱한다. */
function cols(line: string, n: number): string[] {
  const parts = line.split('|').map((s) => s.trim());
  return Array.from({ length: n }, (_, i) => parts[i] ?? '');
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

/**
 * 사진 위에 얹는 글자색 묶음.
 * 종전에는 92% 불투명 흰 카드(`OverlayCard`)를 깔아 대비를 확보했는데, 그 카드가 곧 제품을 가렸다.
 * 이제 사진은 손대지 않고 **여백 실측(safeArea.ts)이 고른 글자색**을 그대로 쓴다.
 */
function photoTokens(placement: CopyPlacement | undefined, th: DetailTheme): BandSurfaceTokens {
  const light = placement?.textTone !== 'dark';
  if (light) {
    return {
      bg: 'transparent',
      ink: '#ffffff',
      body: 'rgba(255,255,255,0.86)',
      mute: 'rgba(255,255,255,0.68)',
      accent: mixWhite(th.accent, 0.45),
      fill: mixWhite(th.accent, 0.3),
      rule: 'rgba(255,255,255,0.28)',
      card: 'rgba(255,255,255,0.14)',
      softFill: 'rgba(255,255,255,0.16)',
      softInk: '#ffffff',
    };
  }
  return {
    bg: 'transparent',
    ink: NEUTRAL_INK,
    body: 'rgba(32,33,36,0.84)',
    mute: 'rgba(55,56,60,0.66)',
    accent: th.accentStrong,
    fill: th.accent,
    rule: 'rgba(32,33,36,0.22)',
    card: 'rgba(255,255,255,0.55)',
    softFill: 'rgba(255,255,255,0.62)',
    softInk: th.accentStrong,
  };
}

/**
 * 블록 본문 트리를 만든다. 슬롯 문자열은 전부 safeText 를 거쳐
 * 폰트 커버리지 밖 글자(한글·이모지 등)를 미리 차단한다.
 *
 * 레이아웃 프리미티브는 **이 함수 안에서** 만들어진다 — 위 헤더의 팩토리 클로저 규칙 때문이다.
 */
export function blockContent(blockId: BlockType, slots: Record<string, string>, ctx: BlockRenderContext): ReactElement {
  const onPhoto = ctx.surface === 'photo' && ctx.hasBackground;
  const T = onPhoto ? photoTokens(ctx.placement, ctx.theme) : surfaceFor(ctx.tone, ctx.theme);
  const showRail = !onPhoto && ctx.chapter !== null;
  /** 패딩·레일을 뺀 실제 콘텐츠 폭. 모든 가변 폭 요소가 이 값을 기준으로 잡힌다 */
  const contentWidth = Math.max(240, (ctx.availableWidth || CANVAS_WIDTH) - PAD * 2 - (showRail ? RAIL_W : 0));
  const k = TYPE_SCALE[ctx.typeScale];
  /**
   * 좁은 여백 보정.
   * 사진 밴드의 카피는 실측 여백 안에만 앉는데, 제품이 한쪽을 차지하면 그 폭이 절반까지 좁아진다.
   * 캔버스 기준 글자 크기를 그대로 쓰면 헤드라인이 **어절 중간에서 꺾여** 읽기 어려워진다
   * (실측: 폭 456px 에 58px 헤드라인 → 줄당 7~8자). 폭에 비례해 낮추되 0.72 아래로는 내리지 않는다.
   */
  const widthFit = onPhoto ? Math.max(0.72, Math.min(1, contentWidth / 620)) : 1;
  /** 타이포 스케일 적용 — 정수 px 로 고정한다(satori 는 소수 px 에서 힌팅이 흔들린다) */
  const z = (base: number): number => Math.round(base * k * widthFit);
  /**
   * 디스플레이 수치용 크기. 숫자 블록(할인율·누적 판매·SPF·정량 그래프)은 전부
   * `TEXT_ONLY_BLOCKS` 라 **AI 콜 0 · 법적 리스크 0** 인데 종전엔 26~64px 로 납작했다.
   */
  const dsp = (base: number): number => Math.round(base * k * widthFit);

  const s = (key: string): string => {
    const v = slots[key];
    return v ? safeText(v, `${blockId}.${key}`) : '';
  };
  const sLines = (key: string) => lines(s(key));

  /**
   * 세로 스택 래퍼.
   * ⚠ satori 는 React Fragment(<>...</>)를 컬럼으로 펼치지 못해 자식들이 가로로 겹친다.
   *   그래서 여러 요소를 묶을 때는 반드시 실제 flex 컨테이너를 쓴다.
   */
  function Stack({ children }: { children: ReactNode }) {
    return <div style={{ display: 'flex', flexDirection: 'column', width: contentWidth }}>{children}</div>;
  }

  /** 챕터 레일 — 절 시작 블록의 좌측 accent 바 + `03 / 06`. 반복되던 코랄 eyebrow 를 대체한다. */
  function ChapterRail() {
    if (!ctx.chapter) return null;
    const { index, total } = ctx.chapter;
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: RAIL_W, flexShrink: 0, alignSelf: 'stretch' }}>
        <div style={{ display: 'flex', fontSize: z(20), fontWeight: 700, color: T.mute, letterSpacing: 2 }}>
          {`${pad2(index)} / ${pad2(total)}`}
        </div>
        {/* 인덱스 **아래**로 바를 흘린다. 바를 위에 두면 숫자가 본문에서 멀어져 정체불명의 각주처럼 읽힌다 */}
        <div
          style={{ display: 'flex', width: 4, flexGrow: 1, marginTop: 14, backgroundColor: T.fill, borderRadius: 2 }}
        />
      </div>
    );
  }

  /**
   * 이음새 노치 — 톤이 바뀌는 경계에 다음 톤 색의 삼각형.
   * ⚠ 반드시 **블록 안에서** 완결시킨다. `composeDetail` 이 `top += height` 로 맞대기 결합하므로
   *   블록 간 겹침은 물리적으로 불가능하고, 가변 높이 블록에서 오버플로로 그리면
   *   **센티넬 행을 덮어 높이 측정이 틀어진다.**
   */
  function Seam() {
    if (ctx.seam !== 'notch' || !ctx.nextTone) return null;
    const nextBg = surfaceFor(ctx.nextTone, ctx.theme).bg;
    return (
      <div
        style={{
          display: 'flex',
          alignSelf: 'stretch',
          height: 22,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: T.bg,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 44,
            height: 44,
            backgroundColor: nextBg,
            transform: 'rotate(45deg)',
            marginTop: 22,
          }}
        />
      </div>
    );
  }

  /**
   * 밴드 컨테이너 — 배경·패딩·챕터 레일·이음새를 한자리에서 소유한다.
   * 사진 밴드에서는 배경을 칠하지 않는다(사진이 이미 깔려 있고, 배치는 render.tsx 가 잡는다).
   */
  function Frame({ children }: { children: ReactNode }) {
    const bottom = onPhoto ? PAD : DENSITY_GAP[ctx.density];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: onPhoto ? 'transparent' : T.bg }}>
        <div style={{ display: 'flex', padding: `${PAD}px ${PAD}px ${bottom}px` }}>
          {showRail ? <ChapterRail /> : null}
          {/* 폭을 명시한다 — flexGrow 만으로는 satori 에서 0 까지 줄어든다(위 availableWidth 주석) */}
          <div style={{ display: 'flex', flexDirection: 'column', width: contentWidth }}>{children}</div>
        </div>
        <Seam />
      </div>
    );
  }

  function Eyebrow({ text }: { text: string }) {
    return (
      <div style={{ display: 'flex', color: T.accent, fontSize: z(26), fontWeight: 700, letterSpacing: 4 }}>{text}</div>
    );
  }

  function Headline({ text, size = 52 }: { text: string; size?: number }) {
    return (
      <div
        style={{
          display: 'flex',
          width: contentWidth,
          marginTop: 18,
          fontSize: z(size),
          fontWeight: 700,
          color: T.ink,
          lineHeight: 1.35,
        }}
      >
        {text}
      </div>
    );
  }

  /** 디스플레이 수치 — 할인율·누적 판매처럼 숫자 자체가 메시지인 자리. */
  function Display({ text, size = 96 }: { text: string; size?: number }) {
    return (
      <div
        style={{ display: 'flex', marginTop: 12, fontSize: dsp(size), fontWeight: 700, color: T.ink, lineHeight: 1.1 }}
      >
        {text}
      </div>
    );
  }

  function Body({ text, marginTop = 24 }: { text: string; marginTop?: number }) {
    return (
      <div
        style={{ display: 'flex', width: contentWidth, marginTop, fontSize: z(27), lineHeight: 1.75, color: T.body }}
      >
        {text}
      </div>
    );
  }

  function Footnotes({ items, marginTop = 32 }: { items: string[]; marginTop?: number }) {
    if (items.length === 0) return <div style={{ display: 'flex' }} />;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', marginTop }}>
        {items.map((t, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              width: contentWidth,
              fontSize: z(19),
              lineHeight: 1.6,
              color: T.mute,
              marginTop: i === 0 ? 0 : 6,
            }}
          >
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
          <div key={i} style={{ display: 'flex', borderBottom: `1px solid ${T.rule}`, padding: '16px 0' }}>
            <div style={{ display: 'flex', width: labelWidth, flexShrink: 0, color: T.mute, fontSize: z(24) }}>
              {label}
            </div>
            <div
              style={{
                display: 'flex',
                width: contentWidth - labelWidth,
                color: T.ink,
                fontSize: z(24),
                lineHeight: 1.6,
              }}
            >
              {value}
            </div>
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
              border: `1px solid ${T.fill}`,
              color: T.accent,
              borderRadius: 999,
              padding: '10px 22px',
              marginRight: 12,
              marginBottom: 12,
              fontSize: z(23),
            }}
          >
            {t}
          </div>
        ))}
      </div>
    );
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
                  backgroundColor: T.softFill,
                  color: T.softInk,
                  fontSize: z(22),
                  fontWeight: 700,
                  letterSpacing: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 20px',
                }}
              >
                {`${label}${i + 1}`.trim()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 24, width: contentWidth - 132 - 24 }}>
                <div style={{ display: 'flex', fontSize: z(30), fontWeight: 700, color: T.ink, lineHeight: 1.4 }}>
                  {it.title}
                </div>
                {it.body ? (
                  <div style={{ display: 'flex', marginTop: 8, fontSize: z(25), lineHeight: 1.7, color: T.body }}>
                    {it.body}
                  </div>
                ) : null}
                {it.note ? (
                  <div style={{ display: 'flex', marginTop: 6, fontSize: z(19), color: T.mute }}>{it.note}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  switch (blockId) {
    case 'mall-promo-banner':
      return (
        <Frame>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: z(44), fontWeight: 700, color: T.accent, lineHeight: 1.35 }}>
              {s('couponTitleJa')}
            </div>
            {s('discountRateJa') ? <Display text={s('discountRateJa')} size={104} /> : null}
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
          {/*
            ⚠ 여기에 `ctx.brandName` 폴백을 두지 않는다. 브랜드명은 한국어라 일본 상세페이지
            히어로에 한글이 그대로 찍혔다(UT-25 · 12건 중 11건 재현). 기능 라벨이 없으면
            아이브로우를 통째로 비운다 — 빈 자리가 한국어보다 낫다.
          */}
          {s('functionLabelJa') ? <Eyebrow text={s('functionLabelJa')} /> : null}
          <Headline text={s('catchCopyJa')} />
          {s('subCopyJa') ? <Body text={s('subCopyJa')} /> : null}
          <div style={{ display: 'flex', marginTop: 28, fontSize: z(26), color: T.mute }}>
            {[s('productNameJa'), s('volumeJa')].filter(Boolean).join('　/　')}
          </div>
        </Stack>
      );
      return <Frame>{inner}</Frame>;
    }

    case 'ranking-stack':
      return (
        <Frame>
          <Eyebrow text="RANKING" />
          <Headline text={s('rankTitleJa')} size={46} />
          <Body text={`${s('genreJa')}　${s('aggregationDateJa')}`} />
          <Footnotes items={sLines('footnoteJa')} />
        </Frame>
      );

    case 'cumulative-sales':
      return (
        <Frame>
          <Eyebrow text="THANKS" />
          <Display text={s('cumulativeCountJa')} size={112} />
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
                <div
                  style={{
                    display: 'flex',
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: T.fill,
                    marginRight: 16,
                  }}
                />
                <div style={{ display: 'flex', fontSize: z(28), color: T.body, lineHeight: 1.6 }}>{t}</div>
              </div>
            ))}
          </div>
          {s('empathyCopyJa') ? <Body text={s('empathyCopyJa')} marginTop={28} /> : null}
        </Stack>
      );
      return <Frame>{inner}</Frame>;
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
                  fontSize: z(30),
                  fontWeight: 700,
                  color: i === 0 ? T.mute : T.accent,
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
                  <div style={{ display: 'flex', width: 240, fontSize: z(24), color: T.mute }}>{label}</div>
                  <div style={{ display: 'flex', flex: 1, height: 40, backgroundColor: T.rule, borderRadius: 6 }}>
                    <div
                      style={{
                        display: 'flex',
                        width: `${Math.round((n / max) * 100)}%`,
                        backgroundColor: T.fill,
                        borderRadius: 6,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      width: 140,
                      justifyContent: 'flex-end',
                      fontSize: dsp(40),
                      fontWeight: 700,
                      color: T.ink,
                    }}
                  >
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
        <Frame>
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
                    backgroundColor: T.softFill,
                    borderRadius: 18,
                  }}
                >
                  <div style={{ display: 'flex', fontSize: z(22), color: T.mute }}>{label}</div>
                  <div style={{ display: 'flex', marginTop: 8, fontSize: dsp(72), fontWeight: 700, color: T.softInk }}>
                    {value}
                  </div>
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
      return <Frame>{inner}</Frame>;
    }

    case 'free-from-badges':
      return (
        <Frame>
          {s('headlineJa') ? <Headline text={s('headlineJa')} size={44} /> : <Eyebrow text="FREE FROM" />}
          <Chips
            items={sLines('freeFromJa').map((t) => (t.endsWith('フリー') || t.endsWith('不使用') ? t : `${t}フリー`))}
          />
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
                <div
                  key={i}
                  style={{ display: 'flex', flexDirection: 'column', width: 168, marginRight: 16, marginBottom: 24 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: 168,
                      height: 168,
                      borderRadius: 18,
                      backgroundColor: hex || T.rule,
                    }}
                  />
                  <div style={{ display: 'flex', marginTop: 12, fontSize: z(22), fontWeight: 700, color: T.ink }}>
                    {[no, nameJa].filter(Boolean).join(' ')}
                  </div>
                  {nameEn ? <div style={{ display: 'flex', fontSize: z(19), color: T.mute }}>{nameEn}</div> : null}
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
            <div style={{ display: 'flex', justifyContent: 'center', fontSize: z(22), color: T.mute }}>{ax1}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
              <div style={{ display: 'flex', width: 90, fontSize: z(22), color: T.mute }}>{ax2}</div>
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  flexWrap: 'wrap',
                  border: `1px solid ${T.rule}`,
                  borderRadius: 18,
                  padding: 24,
                  minHeight: 320,
                }}
              >
                {sLines('placements').map((l, i) => {
                  const [no, name, hex] = cols(l, 3);
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: 132,
                        marginRight: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          width: 132,
                          height: 88,
                          borderRadius: 12,
                          backgroundColor: hex || T.rule,
                        }}
                      />
                      <div style={{ display: 'flex', marginTop: 6, fontSize: z(19), color: T.body }}>
                        {[no, name].filter(Boolean).join(' ')}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', width: 90, justifyContent: 'flex-end', fontSize: z(22), color: T.mute }}>
                {ax3}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, fontSize: z(22), color: T.mute }}>
              {ax4}
            </div>
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
      return <Frame>{inner}</Frame>;
    }

    case 'lineup-compare-chart': {
      const axes = sLines('axesJa');
      return (
        <Frame>
          <Eyebrow text="LINEUP" />
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, borderTop: `2px solid ${T.ink}` }}>
            <div style={{ display: 'flex', padding: '14px 0', borderBottom: `1px solid ${T.rule}` }}>
              <div style={{ display: 'flex', width: 300, fontSize: z(22), color: T.mute }} />
              {axes.map((a, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', flex: 1, justifyContent: 'center', fontSize: z(22), color: T.mute }}
                >
                  {a}
                </div>
              ))}
            </div>
            {sLines('itemRows').map((l, i) => {
              const parts = l.split('|').map((x) => x.trim());
              const name = parts[0] ?? '';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '18px 0',
                    borderBottom: `1px solid ${T.rule}`,
                  }}
                >
                  <div style={{ display: 'flex', width: 300, fontSize: z(26), fontWeight: 700, color: T.ink }}>
                    {name}
                  </div>
                  {axes.map((_, j) => (
                    <div
                      key={j}
                      style={{ display: 'flex', flex: 1, justifyContent: 'center', fontSize: z(26), color: T.accent }}
                    >
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
        <Frame>
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
      return <Frame>{inner}</Frame>;
    }

    case 'texture-shot': {
      if (!s('textureCopyJa'))
        return (
          <Frame>
            <div style={{ display: 'flex' }} />
          </Frame>
        );
      const inner = <Headline text={s('textureCopyJa')} size={44} />;
      return <Frame>{inner}</Frame>;
    }

    case 'customer-review':
      return (
        <Frame>
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
                    backgroundColor: T.card,
                    borderRadius: 18,
                    padding: 32,
                  }}
                >
                  <div style={{ display: 'flex', fontSize: z(25), lineHeight: 1.7, color: T.body }}>{text}</div>
                  <div style={{ display: 'flex', marginTop: 12, fontSize: z(21), color: T.mute }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${T.rule}`, paddingTop: 28 }}>
            {sLines('footnoteRows').map((t, i) => (
              <div
                key={i}
                style={{ display: 'flex', fontSize: z(20), lineHeight: 1.7, color: T.mute, marginTop: i === 0 ? 0 : 6 }}
              >
                {t}
              </div>
            ))}
            {sLines('cautionsJa').length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
                <div style={{ display: 'flex', fontSize: z(22), fontWeight: 700, color: T.body }}>ご使用上の注意</div>
                {sLines('cautionsJa').map((t, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', marginTop: 8, fontSize: z(20), lineHeight: 1.7, color: T.mute }}
                  >
                    {t}
                  </div>
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
