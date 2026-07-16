# 디자인 시스템 (확정 · Stibee Coral 기반)

> 브랜드 톤 확정: **스티비(Stibee) 팔레트 기반**. 상세 스펙은 [DESIGN.md](DESIGN.md), 브랜드 레퍼런스는 [references/stibee-design.md](references/stibee-design.md).
> 원본(source of truth)은 **Figma 변수/스타일**이며, 이 문서는 그 스냅샷이다. 구현 시 Tailwind 설정에 반영한다.

## Figma 원본
- 파일: `2조 생존자들` (fileKey `C3FYvw7rhJrrHK4HgCZzBt`)
- 변수 컬렉션: `1. Primitives`(원색) → `2. Semantic`(역할) → `3. Scale`(간격·radius)
- 로컬 컴포넌트·스타일 페이지: **Components (Local · Stibee)**

## 컬러 — Primitives
| 역할 | 토큰 | 값 |
|---|---|---|
| 브랜드/CTA | `coral/base` | `#ff6464` |
| 브랜드 hover/pressed | `coral/strong` | `#d93636` |
| 브랜드 틴트 | `coral/tint` | `#fff8f8` |
| 배경(캔버스) | `neutral/canvas` | `#ffffff` |
| 배경(서피스) | `neutral/surface` | `#f6f6f6` |
| 디바이더 | `neutral/divider` | `#ebebeb` |
| 보더(hairline) | `neutral/border` | `#70737c` 16% |
| 제목 텍스트 | `text/heading` | `#202124` |
| 본문 텍스트 | `text/body` | `#414245` |
| 보조 텍스트 | `text/secondary` | `#37383c` 61% |
| 비활성 텍스트 | `text/disabled` | `#747579` |
| 에러 | `feedback/error` | `#f0483c` |
| 성공 | `feedback/success` | `#00b97c` |
| 경고 | `feedback/warning` | `#ffab00` |

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

> **인풋 포커스 아웃라인은 브랜드색이 아닌 회색**(`Cool Neutral/50 #70737c`)을 쓴다. CTA·칩·아이콘버튼만 coral.

## 타이포
- 웹 구현 폰트: **Pretendard Variable** (스티비 원본과 동일). Figma 컴포넌트는 환경 제약으로 Noto Sans KR 사용.
- 스케일(스티비 기준): Display 44/600, Section 42/600, Feature 36/600, Subhead·Nav 16/400, Body 14/400.

## 간격 · Radius (Scale 변수)
- `space/*`: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 64
- `radius/*`: `sm 6` · `md 8` · `lg 12` · `full 9999`

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
- 색 대비 WCAG AA 이상(코랄 `#ff6464` 위 흰 글자, 작은 텍스트/링크는 `coral/strong #d93636`), 포커스 가시화, 시맨틱 태그.
