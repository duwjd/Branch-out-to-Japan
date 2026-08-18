# 디자인 시스템 (확정 · YOAKE 일출 코랄)

> **2026-08-18 전환.** 정본은 `LP_Components` 시트 → [references/LP_Components.svg](references/LP_Components.svg), 실측 스펙 [lp-components-spec.md](lp-components-spec.md), 결정 근거 [2026-08-18-일출코랄-DS전환.md](../docs/decisions/2026-08-18-일출코랄-DS전환.md).
> 구현 토큰은 [app/globals.css](../app/globals.css) `@theme` 이고, 이 문서는 그 스냅샷이다.
>
> **구 스티비 coral `#ff6464` 팔레트는 폐기.** 브랜드색은 로고와 같은 일출 코랄 `#FF6F61`, 표면은 웜 크림 `#FAF8F5`, 잉크는 `#182333`이다. 아래 §타이포 이후 절에 남은 스티비·원티드 서사는 시드 잔재다.
> 로고 자산·여백 규칙은 [brand/logo/README.md](brand/logo/README.md)를 계속 따른다 — 단 **일출 그라디언트만** 로고 전용이다.

## Figma 원본
- 파일: `2조 생존자들` (fileKey `C3FYvw7rhJrrHK4HgCZzBt`)
- 변수 컬렉션: `1. Primitives`(원색) → `2. Semantic`(역할) → `3. Scale`(간격·radius)
- 로컬 컴포넌트·스타일 페이지: **Components (Local · Stibee)**

## 컬러 — Primitives (LP_Components 실측)
| 역할 | CSS 토큰 | 값 |
|---|---|---|
| 브랜드 **면**(CTA·아이콘) | `--color-coral` | `#FF6F61` |
| 브랜드 hover / pressed | `--color-coral-hover` / `-pressed` | `#F0594B` / `#DB4C3F` |
| 브랜드 **글자**(링크·소형) | `--color-coral-strong` | `#C93F2E` |
| 브랜드 틴트 | `--color-coral-tint` | `#FFF1EE` |
| 배경(페이지·크림) | `--color-page` | `#FAF8F5` |
| 배경(캔버스) | `--color-canvas` | `#FFFFFF` |
| 서피스 / subtle | `--color-n-100` / `-150` | `#F4F2EE` / `#F2F1ED` |
| 보더·디바이더 | `--color-card-border` | `#E9E7E3` |
| 보더(강) | `--color-border-strong` | `#C9CDD4` |
| 제목 텍스트 | `--color-ink` | `#182333` |
| 본문 텍스트 | `--color-ink-body` | `#3D4655` |
| 보조·라벨 | `--color-ink-mute` | `#6E7686` |
| placeholder·비활성 | `--color-ink-faint` | `#78818F` |
| 잉크 배경 위 보조 | `--color-ink-on-dark` | `#C3CAD6` |
| 에러 (면 / 글자) | `--color-danger` / `-text` | `#D94848` / `#C13A3A` |
| 성공 (면 / 글자) | `--color-green` / `-text` | `#2D8C6B` / `#26775B` |
| 경고 (면 / 글자) | `--color-amber` / `-text` | `#E39A22` / `#8F6412` |

> **면과 글자를 나눈다.** 시트 원색은 대비가 낮아(코랄 2.57:1, 앰버 2.15:1) 소형 텍스트에 못 쓴다. 도트·보더·아이콘·버튼 면은 원색, 글자는 `*-text`/`coral-strong`.

## 컬러 — Semantic (역할 → 원색)
| 시맨틱 토큰 | → 원색 | 용도 |
|---|---|---|
| `interactive/brand` | `coral/base` | 기본 CTA·프라이머리 |
| `interactive/hover` | `coral/strong` | hover/pressed/active |
| `interactive/surface` | `coral/tint` | 선택·틴트 배경 |
| `text/primary` | `text/heading` | 제목·강조 |
| `text/on-primary` | `neutral/canvas` | 코랄 위 흰 글자 |
| `bg/page` / `bg/surface` | canvas / surface | 페이지·서피스 |
| `bg/tint` | `coral/tint` | 코랄 틴트 배경 |
| `border/default` / `border/subtle` | divider / border | 카드·필드 hairline |

> **포커스는 전 컴포넌트 코랄 3px 링**(`--color-coral`, offset 1)으로 통일한다 — 전환 전의 "포커스는 회색" 규칙은 폐기. 인풋은 여기에 `--color-coral-glow` 글로우를 더한다.

## 타이포
- 웹 구현 폰트: **Pretendard Variable** (스티비 원본과 동일). Figma 컴포넌트는 환경 제약으로 Noto Sans KR 사용.
- 스케일(스티비 기준): Display 44/600, Section 42/600, Feature 36/600, Subhead·Nav 16/400, Body 14/400.

## 간격 · Radius (Scale 변수)
- `space/*`: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 64
- `radius/*` (시트 실측): `--radius-check 5`(체크박스) · `--radius-field 8`(인풋·셀렉트) · `--radius-btn 10`(버튼) · `--radius-panel 12`(FAQ·성공메시지) · `--radius-card 14`(카드, 구 18) · `full 9999`(배지·칩)

## Effect Styles (쉐도우)
| 스타일 | 값 |
|---|---|
| `Elevation / Floating` | `0 4 12 rgba(0,0,0,0.08)` — 드롭다운·팝오버·카드 hover |
| `Elevation / Modal` | `0 8 24 rgba(0,0,0,0.12)` — 다이얼로그·시트 |

## Grid Styles (반응형)
| 스타일 | 컬럼 | 거터 | 여백/폭 |
|---|---|---|---|
| `Grid / Wide (≥1185)` | 12 | 32 | 1120 centered |
| `Grid / Desktop (768–1185)` | 12 | 24 | margin 40 (STRETCH) |
| `Grid / Tablet (480–768)` | 8 | 20 | margin 32 (STRETCH) |
| `Grid / Mobile (<480)` | 4 | 16 | margin 20 (STRETCH) |

## 로컬 컴포넌트 (메인)
`Components (Local · Stibee)` 페이지, 전 variant가 위 토큰에 바인딩됨.
- **Button** — Type(Primary·Secondary·Tertiary) × State(Default·Hover·Disabled)
- **TextInput** — Default·Focus(회색)·Error·Disabled
- **Select** — Default·Focus·Disabled
- **Checkbox / Radio** — Unchecked·Checked·Disabled
- **Chip** — Default·Selected · **Badge** — Neutral·Success·Warning·Error
- **Card** — Default·Hover(Floating)·Selected(coral border)

## 배경 메모
- 초기 원티드(Montage) 컴포넌트를 복사해 착수 → 원격 라이브러리 인스턴스라 메인 편집 불가. 색상은 오버라이드로 스티비화했고, 핵심 컴포넌트는 위와 같이 **로컬 메인으로 재구축**(원격 의존 0).
- 자세한 감사·경위: [audit-refined-landing-ds.md](audit-refined-landing-ds.md), [DESIGN.md](DESIGN.md) §5–6.

## 접근성 기준
- 색 대비 WCAG AA(4.5:1) 이상. 소형 텍스트·링크는 반드시 `coral-strong`/`*-text` 토큰 — 시트 원색은 글자에 쓰지 않는다.
- 포커스 가시화(코랄 3px), 시맨틱 태그, 상태는 색+글자+기호 3중 표기.
- 전환 후 실측: 제목 14.9 · 본문 9.5 · 캡션 4.6 · 링크 5.0 · 배지 4.7–4.8 (전부 AA 이상).
- **미해결:** Primary 버튼의 흰 글자 on `#FF6F61`은 2.73:1로 AA 미달이다. 해소안은 [결정 문서](../docs/decisions/2026-08-18-일출코랄-DS전환.md) "미해결" 절.
