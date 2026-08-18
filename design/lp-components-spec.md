# LP_Components — 스펙 추출 (2026-08-18)

> 원본: [references/LP_Components.svg](references/LP_Components.svg) (1600×4903, Figma export)
> 시트 제목: **"LP_Components — YOAKE 비회원 메인페이지 컴포넌트"**
> 이 문서는 SVG에서 색·치수를 **기계적으로 추출한 결과**다.

---

## 0. 적용 상태 — 전역 토큰 교체 완료

이 시트는 **로고 일출 코랄 `#FF6F61`을 UI 브랜드색으로 승격**하고, 중립색을 **웜 크림(`#FAF8F5` 계열)** + **쿨 네이비 잉크(`#182333` 계열)** 로 전면 교체한다.

직전까지 `CLAUDE.md`·`design/design-system.md`는 "로고 색을 UI 토큰으로 승격하지 않는다"고 못박고 있었으나, **2026-08-18 결정으로 해당 조항을 폐기**했다 → [docs/decisions/2026-08-18-일출코랄-DS전환.md](../docs/decisions/2026-08-18-일출코랄-DS전환.md).

- ✅ 토큰: [app/globals.css](../app/globals.css) `@theme` 교체 완료 (전역)
- ✅ 컴포넌트: [components/ui/lp.tsx](../components/ui/lp.tsx) — TextLink·LpStatusBadge·ChannelChip·FormField·SelectField·LpCheckbox·ServiceCard·WorkflowStep·FAQItem·SuccessMessage
- ✅ 기존 프리미티브([components/ui/primitives.tsx](../components/ui/primitives.tsx)) hover/pressed·포커스 갱신
- ⬜ `app/` 내부 화면(리포트·스튜디오·매칭)의 하드코딩 잔재 스윕 — 후속

---

## 1. 컬러 토큰 (SVG 실측)

### 브랜드 — 일출 코랄
| 역할 | 값 | 출처 |
|---|---|---|
| `brand/base` | `#FF6F61` | Button primary default, chip selected, 링크 hover, 아이콘 |
| `brand/hover` | `#F0594B` | Button primary hover |
| `brand/pressed` | `#DB4C3F` | Button primary pressed, TextLink pressed |
| `brand/gradient-end` | `#FF9B70` | 로고 일출 그라디언트 종점(로고 전용) |
| `brand/focus-ring` | `#FF6F61` 3px | 전 컴포넌트 포커스 링 (아웃셋 3px) |
| `brand/focus-glow` | `rgba(255,111,97,0.24)` | 인풋 포커스 drop-shadow (spread 3) |

### 중립 — 웜 크림 표면 / 쿨 네이비 잉크
| 역할 | 값 | 용도 |
|---|---|---|
| `bg/page` | `#FAF8F5` | 페이지 캔버스(크림) |
| `bg/surface` | `#FFFFFF` | 카드·인풋·헤더(scrolled) |
| `bg/muted` | `#F4F2EE` | Coming-next 카드 |
| `bg/subtle` | `#F2F1ED` | 버튼 hover, disabled 필드, chip disabled |
| `border/default` | `#E9E7E3` | 카드·인풋·디바이더 |
| `border/strong` | `#C9CDD4` | Secondary 버튼 보더, 체크박스 보더 |
| `text/heading` | `#182333` | 제목·버튼 라벨·본문 강조 (= 로고 잉크) |
| `text/body` | `#3D4655` | 본문 |
| `text/label` | `#6E7686` | 섹션 라벨·caret |
| `text/secondary` | `#78818F` | placeholder·disabled·각주 |
| `text/on-dark` | `#C3CAD6` | 푸터(잉크 배경) 위 보조 텍스트 |

### 상태색
| 역할 | 텍스트/도트 | 배경 |
|---|---|---|
| success (검토 가능) | `#2D8C6B` | `#E8F4F0` |
| warning (조건부) | `#E39A22` | `#FDF3E4` |
| danger (고위험) | `#D94848` | `#FBEDED` |

> 상태 배지는 **색 + 텍스트 + 도트** 3중 표기를 유지한다(현행 CVD 규칙과 동일).

---

## 2. 컴포넌트 (14종)

| # | 컴포넌트 | Variant / State |
|---|---|---|
| 1 | Logo lockup | Light · On-dark |
| 2 | **Button** | Primary·Secondary × Default·Hover·Pressed·Focus·Disabled |
| 3 | **TextLink** | Default·Hover·Pressed·Focus·Disabled |
| 4 | **StatusBadge** | 검토 가능 · 조건부 · 고위험 |
| 5 | **ChannelChip** | Default·Selected·Focus·Disabled |
| 6 | **FormField** (TextInput) | Default·Focus·Filled·Error·Disabled |
| 7 | **Select** | Default·Focus·Filled·Error·Disabled |
| 8 | **Checkbox** | Unchecked·Checked·Focus·Error·Disabled |
| 9 | **ServiceCard** | Service · Coming Next(dashed) |
| 10 | **WorkflowStep** | Default · Coming(dashed) |
| 11 | **FAQAccordion** | Collapsed · Expanded |
| 12 | **SuccessMessage** | — |
| 13 | **Header** | Transparent · Scrolled |
| 14 | **FooterNav** | — |

### 치수 (SVG 실측)
- **Button**: 180×52, `radius 10`. Primary=`#FF6F61`/흰 글자. Secondary=흰 배경 + `1px #C9CDD4` + `#182333` 글자. Disabled=`#E9E7E3`/`#78818F`.
- **Focus 링(공통)**: 대상 박스 밖으로 **3px `#FF6F61`** — 버튼은 183×55 `radius 11.5`로 확장.
- **TextLink**: 텍스트 + `1px` 언더라인(`#E9E7E3`, hover 시 `#FF6F61`). Focus는 `radius 5` + `2px` 코랄 아웃라인.
- **StatusBadge**: h=35, `radius full`, 도트 r=3.5.
- **ChannelChip**: h=40, `radius full(20)`. Focus 시 75×44 `radius 22` + 3px 링.
- **FormField / Select**: 400×52, `radius 8`, `1px #E9E7E3`. Focus=`#FF6F61` 보더 + 코랄 글로우. Error=`#D94848` 보더 + 13px 에러 텍스트.
- **Checkbox**: 20×20, `radius 5`, `1.5px #C9CDD4`. Checked=`#FF6F61` 채움 + 흰 체크(2px).
- **ServiceCard**: 360×238, `radius 14`. Coming=`#F4F2EE` + `dasharray 6 5`.
- **WorkflowStep**: 320×196, `radius 14`. 스텝 번호는 코랄(Coming은 `#78818F`).
- **FAQAccordion**: w=880, collapsed h=82 / expanded h=150, `radius 12`. Expanded 보더 `#FF6F61`.
- **SuccessMessage**: 402×91, `radius 12`, `#E8F4F0` + `1px #2D8C6B`.
- **Header**: h=76. Transparent(크림 위) / Scrolled(흰 배경 94% + 하단 `1px #E9E7E3`). CTA 142×44 `radius 8`.
- **FooterNav**: 배경 `#182333`, 링크 `#C3CAD6`, 디바이더 흰색 12%.

---

## 3. 접근성 — 시트에서 벗어난 부분
시트 원색을 소형 텍스트에 쓰면 AA(4.5:1) 미달이라, **면은 원색·글자는 파생 `*-text`** 로 분리했다.

| 조합 | 시트 원색 대비 | 대체 토큰 | 대비 |
|---|---|---|---|
| 코랄 텍스트 on 크림 | 2.57 ✕ | `--color-coral-text #C93F2E` | 4.68 ✓ |
| 앰버 배지 텍스트 | 2.15 ✕ | `--color-amber-text #8F6412` | 4.95 ✓ |
| danger 배지 텍스트 | 3.71 △ | `--color-danger-text #C13A3A` | 5.04 ✓ |
| success 배지 텍스트 | 3.67 △ | `--color-green-text #26775B` | 5.12 ✓ |

**미해결:** Primary 버튼의 흰 글자 on `#FF6F61` = **2.73 ✕**. 시트대로 두었다 — 해소안은 [결정 문서](../docs/decisions/2026-08-18-일출코랄-DS전환.md) "미해결" 절.

---

## 4. 남은 일
- `app/` 내부 화면(리포트·스튜디오·매칭)의 하드코딩 잔재 스윕 — `#70737c`(구 포커스 회색) 3곳, `lib/studio/detail/templates.tsx`·`lib/engine/rules/slides.ts`의 산출물 팔레트
- Header/FooterNav 컴포넌트화 (현재 스펙만 있고 구현 없음)
