# LP_Components — 스펙 추출 (2026-08-18)

> 원본: [references/LP_Components.svg](references/LP_Components.svg) (1600×4903, Figma export)
> 시트 제목: **"LP_Components — YOAKE 비회원 메인페이지 컴포넌트"**
> SVG에서 색·치수를 기계적으로 추출한 결과다. 구현 토큰: [app/globals.css](../app/globals.css) `@theme`.

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

## 3. 컴포넌트 (시트 14종) — 치수 실측
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

## 4. 접근성 — 전환 후 실측
| 조합 | 대비 | 판정 |
|---|---|---|
| 제목 `#182333` on 크림 | 14.93 | AAA |
| 본문 `#3D4655` on 카드 | 9.52 | AAA |
| 캡션 `#6E7686` on 카드 | 4.57 | AA |
| 링크 `#C93F2E` on 카드 | 4.96 | AA |
| 링크 `#C93F2E` on 코랄 틴트 | 4.50 | AA |
| 배지 텍스트 3종 | 4.69–4.81 | AA |
| placeholder `#78818F` on 카드 | 3.94 | AA-large (필수 정보 아님) |

**미해결:** Primary 버튼의 흰 글자 on `#FF6F61` = **2.73:1로 AA 미달**(라벨 15px bold라 large 예외도 못 받음). 시트대로 두었다 — 해소안은 결정 문서 "미해결" 절.

## 5. 남은 일
- `--color-violet #8364FF`(스튜디오 템플릿명 배지)는 시트에 없는 액센트라 그대로 뒀다. 웜 팔레트 위 쿨 바이올렛이라 언젠가 정리 필요.
- 브랜드 이니셜 아바타의 피치 그라디언트(`#FFE9DF`→`#FFCFB8`, AppShell·HomeWidgets)는 일출 계열이라 유지했으나 토큰화되어 있지 않다.
