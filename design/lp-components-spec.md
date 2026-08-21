# LP_Components — 스펙 추출 (2026-08-18)

> 원본: [references/LP_Components.svg](references/LP_Components.svg) (1600×4903, Figma export)
> 시트 제목: **"LP_Components — YOAKE 비회원 메인페이지 컴포넌트"**
> SVG에서 색·치수를 기계적으로 추출한 결과다. 구현 토큰: [app/globals.css](../app/globals.css) `@theme`.

> ⚠ **2026-08-20 — repo 자산은 구버전이다.** 시안 신버전(1600×5805)은 상단에 사이드바 블록
> (아이콘 레일 · 4축 내비 · `SidebarNavItem — State`)이 추가돼 이하 y좌표가 약 900px 밀렸다.
> §3.1은 신버전에서 읽은 실측이며, **신버전 SVG가 투입되면 위 치수 줄과 이 경고를 정리한다**.

## 0. 적용 상태 — 앱 전역 승격 완료

PR #37이 이 팔레트를 **랜딩 한정**(`--color-lp-*`)으로 먼저 도입했고, 2026-08-18 결정으로 **앱 전역(`/app` 포함)으로 승격**했다 → [docs/decisions/2026-08-18-일출코랄-DS전환.md](../docs/decisions/2026-08-18-일출코랄-DS전환.md).

- 코어 토큰이 정본이고 `--color-lp-*`는 코어를 가리키는 **얇은 별칭**으로 남았다(랜딩 코드 호환).
- 신규 코드는 `lp-*` 대신 코어 토큰(`coral`·`ink`·`page`…)을 쓴다.

---

## 1. 컬러 토큰

### 브랜드 — 일출 코랄
| CSS 토큰 | 값 | 용도 |
|---|---|---|
| `--color-coral` | `#FF6F61` | **면**(CTA 배경·아이콘) + large/bold 강조 |
| `--color-coral-hover` | `#F0594B` | hover |
| `--color-coral-pressed` | `#DB4C3F` | pressed |
| `--color-coral-strong` | `#C93F2E` | **소형 텍스트·링크·eyebrow** (AA 4.7:1) |
| `--color-coral-tint` | `#FFF1EE` | 칩-on·필수 배지·강조 배경 |
| `--color-coral-glow` | `rgba(255,111,97,.24)` | 인풋 포커스 글로우 |
| `--color-sunrise-end` | `#FF9B70` | 일출 그라디언트 종점 — **로고 심볼 전용** |

> **면과 글자를 나눈다.** 시트 원색 `#FF6F61`은 크림 위 2.57:1이라 글자에 못 쓴다.

### 중립 — 웜 크림 표면 / 쿨 네이비 잉크
| CSS 토큰 | 값 | 용도 |
|---|---|---|
| `--color-page` | `#FAF8F5` | 페이지 캔버스(크림) |
| `--color-canvas` | `#FFFFFF` | 카드·인풋 |
| `--color-n-50` | `#FDFCFA` | 흰 카드 안 서브패널 (시트 밖 파생값) |
| `--color-n-100` | `#F4F2EE` | Coming-next 카드 |
| `--color-n-150` | `#F2F1ED` | 버튼 hover·disabled 필드 |
| `--color-n-200` / `--color-card-border` | `#E9E7E3` | 보더·디바이더 |
| `--color-border-strong` | `#C9CDD4` | Secondary 버튼·체크박스 보더 |
| `--color-ink` | `#182333` | 제목 (= 로고 잉크) |
| `--color-ink-body` | `#3D4655` | 본문 |
| `--color-ink-mute` | `#6E7686` | 캡션·섹션 라벨 |
| `--color-ink-faint` | `#78818F` | placeholder·비활성 |
| `--color-ink-on-dark` | `#C3CAD6` | 잉크 배경(푸터) 위 보조 |

> 중립 계단은 흰색 → `n-200` 으로 **단조 감소**해야 한다. `n-50`을 `page`와 같은 값으로 두면 페이지 위 서브패널이 사라진다.

### 상태색 — 면은 원색, 글자는 `*-text`
| 역할 | 면 | 글자 | 배경 |
|---|---|---|---|
| success (검토 가능) | `#2D8C6B` | `#26775B` | `#E8F4F0` |
| warning (조건부) | `#E39A22` | `#8F6412` | `#FDF3E4` |
| danger (고위험) | `#D94848` | `#C13A3A` | `#FBEDED` |

## 2. Radius
`--radius-check 5` · `--radius-field 8` · `--radius-btn 10` · `--radius-panel 12` · `--radius-card 14`(구 18) · `full 9999`

## 3. 컴포넌트 (시트 15종) — 치수 실측
- **Button** 180×52 `r10`. Primary `#FF6F61`/흰 글자, Secondary 흰 배경 + `1px #C9CDD4` + 잉크 글자, Disabled `#E9E7E3`/`#78818F`
- **포커스(공통)** 박스 밖 **3px `#FF6F61`**, offset 1 — 인풋은 여기에 글로우 추가. *전환 전 규칙(회색 포커스)은 폐기*
- **TextLink** 1px 언더라인(`#E9E7E3` → hover `#FF6F61`)
- **StatusBadge** h35 `r-full`, 도트 r3.5
- **ChannelChip** h40 `r-full`, 선택 시 코랄 면 + 흰 글자
- **FormField / Select** 400×52 `r8`, Error `#D94848` 보더 + 13px 에러 텍스트
- **Checkbox** 20×20 `r5`, `1.5px #C9CDD4`, Checked 코랄 면 + 흰 체크
- **ServiceCard** 360×238 `r14` / **WorkflowStep** 320×196 `r14` — Coming은 `#F4F2EE` + 점선 `6 5`
- **FAQAccordion** w880 `r12`, Expanded 보더 코랄 · **SuccessMessage** `r12` `#E8F4F0` + `1px #2D8C6B`
- **Header** h76 (Transparent / Scrolled 흰 배경 94% + 하단 1px) · **FooterNav** 배경 `#182333`

### 3.1 SidebarNavItem — State (신버전 추가분)
회원 앱 좌측 내비 항목. 219×42 `r10`, 아이콘 20 + gap 10, 라벨 13.5px semibold.
사이드바 폭 248 = 219 + 좌우 패딩 14.5 → `--spacing-sidebar` 그대로 맞는다.
**2026-08-21 실측 검증 완료** — 구현이 248 / 219×42 / 20 / 10 / 13.5 전부 시트값과 일치한다.

| 상태 | 배경 | 아이콘 | 라벨 |
|---|---|---|---|
| default | 투명 | `#6E7686` (`ink-mute`) | `#6E7686` (`ink-mute`) |
| hover | `#F2F1ED` (`n-150`) | `#182333` (`ink`) | `#182333` (`ink`) |
| active | `#FFF1EE` (`coral-tint`) | `#FF6F61` (`coral`) | `#FF6F61` (`coral`) |

> **2026-08-21 — active 라벨을 시트 원색으로 환원했다.** 이전에는 코랄 틴트 위 `#FF6F61`이
> **2.48:1로 AA 미달**이라 라벨만 `coral-strong`(4.50 AA)로 파생했으나, 시안 일치를 우선해
> 세 상태 모두 시트값을 그대로 쓴다. **미달을 알고 채택한 값이다**(§4·§5 참조).
> 근거: [docs/decisions/2026-08-21-사이드바-내비-시트정합.md](../docs/decisions/2026-08-21-사이드바-내비-시트정합.md).

> 세 상태의 아이콘 색은 구현에서 따로 지정하지 않는다 — 아이콘이 `currentColor`라 항목의
> 텍스트색을 상속한다. 덕분에 시트의 "hover에서 아이콘도 `#182333`" 계단이 자동으로 맞는다
> (구 구현은 아이콘에 `active ? coral : ink-mute`를 하드코딩해 hover가 아이콘에 닿지 않았다).

> 내비 아이콘 4종은 시트 신버전 모양이다 — 집 / 줄무늬 문서 / 카메라 / 슬라이더+기어.
> 구현: [icons.tsx](../components/ui/icons.tsx) `IconHome`·`IconReport`·`IconCamera`·`IconSliders`.
> 기존 `IconDoc`·`IconImage`·`IconBox`는 다른 화면이 계속 쓰므로 교체하지 않고 신설했다.

> 시트에 하위 메뉴(운영 아코디언)·접기 토글·계정 행 스펙은 없다. 하위 메뉴는 부모 "운영"과
> 나란히 보이므로 활성 색만 같은 코랄로 맞췄고, 나머지는 기존 값을 유지한다.
> 구현: [AppShell.tsx](../components/app/AppShell.tsx) `navClass`·`subClass`.

> ⚠ `docs/specs/**/*.html` 프로토타입 14종(+`wireframe.css` 5벌)의 사이드바 블록은 이 정합을
> 반영하지 않았다. 이미 브랜드 스위처·게스트 CTA·운영 하위메뉴 개수(3 vs 4)·접힘
> 브레이크포인트(980 vs 1024)·localStorage 키가 실앱과 어긋나 있어, 부분 동기화 대신
> **실앱을 정본으로 본다**.

## 4. 접근성 — 전환 후 실측
| 조합 | 대비 | 판정 |
|---|---|---|
| 제목 `#182333` on 크림 | 14.93 | AAA |
| 본문 `#3D4655` on 카드 | 9.52 | AAA |
| 캡션 `#6E7686` on 카드 | 4.57 | AA |
| 링크 `#C93F2E` on 카드 | 4.96 | AA |
| 링크 `#C93F2E` on 코랄 틴트 | 4.50 | AA |
| 내비 active 라벨 `#FF6F61` on 코랄 틴트 | 2.48 | **AA 미달(의도적 · §3.1)** |
| 배지 텍스트 3종 | 4.69–4.81 | AA |
| placeholder `#78818F` on 카드 | 3.94 | AA-large (필수 정보 아님) |

**미해결:** 시트값을 그대로 쓰기로 해 AA를 못 맞춘 자리가 둘이다. 둘 다 알고 둔 것이다.
- Primary 버튼의 흰 글자 on `#FF6F61` = **2.73:1**(라벨 15px bold라 large 예외도 못 받음) — 해소안은 결정 문서 "미해결" 절.
- 사이드바 내비 active 라벨 `#FF6F61` on `#FFF1EE` = **2.48:1** — 되돌리려면 `navClass`·`subClass`의 `text-coral`을 `text-coral-strong`으로 바꾸면 된다(§3.1).

## 5. 남은 일
- **신버전 시트 SVG(1600×5805) 투입 대기** — `design/references/LP_Components.svg`를 교체하고 헤더의
  치수·경고 줄을 정리한다. §3.1은 신버전 실측이라 값 자체는 교체 후에도 그대로다.
- `--color-violet #8364FF`(스튜디오 템플릿명 배지)는 시트에 없는 액센트라 그대로 뒀다. 웜 팔레트 위 쿨 바이올렛이라 언젠가 정리 필요.
- 브랜드 이니셜 아바타의 피치 그라디언트(`#FFE9DF`→`#FFCFB8`, AppShell·HomeWidgets)는 일출 계열이라 유지했으나 토큰화되어 있지 않다.
