# Design System Build Plan — Phase 1 Landing (최소치)

> 단일 기준: [`design/DESIGN.md`](./DESIGN.md) (Wanted 구조 + Stibee coral 팔레트 + `primary-strong` 접근성 토큰).
> 목적: 일본 진출 콘텐츠 진단 랜딩("무료 5분 진단" 수요검증) 제작에 필요한 **최소 디자인 시스템**을 Figma에 구축.
> Figma 파일: `2조 생존자들` (`C3FYvw7rhJrrHK4HgCZzBt`).

## 컬러 역할 규칙 (엄격)
- `primary #FF6464` — brand / large(≥18px·bold) / decorative highlight, tint 페어링. **white·작은 텍스트 금지(≈2.9:1)**.
- `primary-strong #D93636` — **interactive**: filled CTA · text link · focus ring · selection / active. white/small text AA(≈4.6:1).
- `primary-tint #FFF8F8` — tint surface · CTA band · selection background.
- marketing accent(orange/pink/sky/violet) — illustration / visual accent 전용, product UI interaction 금지.
- blue primary 금지. 임의 컬러 추가 금지. semantic(error/success/warning)·brand-black·brand-grey 값 유지.

## 진행 범위

### A. Foundations (최소)
- **Color Variables** (2계층): `1. Primitives`(원값) + `2. Semantic`(역할 alias). primary/primary-tint/primary-strong 역할 구분.
- 기존 `Color System — Stibee Coral` 보드의 하드코딩 스와치를 **Variables로 승격 + 바인딩**(재생성 금지, 참조로 정리).
- **Type styles**: display/h1/h2/subtitle/body/body-small/caption/micro (Pretendard Variable).
- **Spacing scale**: 4·8·12·16·20·24·32·64 (number 변수 + 문서화).
- **Radius scale**: 6·8·12·9999 (number 변수 + 문서화).
- **Elevation**: floating `0 4 12 /.08`, modal `0 8 24 /.12` (effect styles + 문서화).
- **Grid**: Desktop max 1185 / Mobile <480, 컨테이너·거터 문서화.

### B. Core Components (Phase 1 최소)
Button(primary·secondary·text·disabled; filled CTA=`primary-strong`) · Text Link · Input · Textarea · Card · Badge/Pill(semantic) · Chip · Accordion · Avatar · Icon wrapper. **Auto Layout + variant + 변수 바인딩** 필수.

### C. Section Components (랜딩용)
Header/Nav · Hero · Problem · Solution/Value Props · Before/After · How it works · Offer/Starter Kit · FAQ · Final CTA band · Lead Form · Footer.

### D. Landing 조립
Desktop landing frame + Mobile landing frame (section components 조립).

## 이번 단계 제외
전체 컴포넌트 풀세트 · Modal/Toast/Tooltip/Pagination · 완성형 Guidelines · Voice&Tone 상세 · Motion 상세 · Code Connect.

## 중복 방지
- COVER 페이지 미수정.
- Color System 보드 재생성 금지 → Variables 바인딩으로만 정리.
- 컬러 토큰 값은 DESIGN.md에서만 가져옴(신규 지정 금지).

## 작업 순서
1. `design/design-system-plan.md` (본 문서)
2. Figma Variables / Styles 생성 (+ 보드 승격 바인딩)
3. `Foundations` 페이지
4. `Components` 페이지
5. `Sections` 페이지
6. `Landing / Desktop` · `Landing / Mobile` draft
7. 주요 페이지 스크린샷 렌더 확인

## 예상 산출물
- Variables: `1. Primitives`(~20) · `2. Semantic`(~16) 컬렉션, Number(spacing/radius).
- Styles: text 8종, effect 2종.
- Figma 페이지: `Foundations`, `Components`, `Sections`, `Landing / Desktop`, `Landing / Mobile`.
- Core components 10종, Section components 11종, Landing draft 2프레임.

---

# Build Results (as-built) — 2026-07-08

Figma 파일: `2조 생존자들` (`C3FYvw7rhJrrHK4HgCZzBt`).

## 생성한 Figma 페이지 (node id)
| 페이지 | node id | 비고 |
|---|---|---|
| `Foundations` | `38:2` (root board `38:3`) | Type/Spacing/Radius/Elevation/Grid/Color 문서 |
| `Components` | `40:2` (root `40:3`) | Core 컴포넌트 |
| `Sections` | `45:2` (board `45:3`) | 11 섹션 블록 |
| `Landing` | `50:2` | Desktop/Mobile 드래프트 |
| `Color System — Stibee Coral` | `7:2` | **재생성 안 함** — 스와치 18개 Variables 바인딩(승격) |
| `COVER` | `0:1` | **미수정** |

## Variables / Styles
- `1. Primitives` (`VariableCollectionId:35:2`) — color 20 (coral/neutral/text/brand/accent/feedback)
- `2. Semantic` (`VariableCollectionId:35:23`) — alias 16 (bg/text/border/interactive/feedback)
  - `interactive/default`→coral/strong `#D93636` · `interactive/brand`→coral/base `#FF6464` · `interactive/surface`→coral/tint `#FFF8F8`
- `3. Scale` (`VariableCollectionId:36:12`) — number 12 (space 4·8·12·16·20·24·32·64 / radius 6·8·12·9999)
- Text styles 8: Display/H1/H2/Subtitle/Body/Body Small/Caption/Micro (Pretendard Variable)
- Effect styles 2: `Elevation / Floating`, `Elevation / Modal`

## Core Components (page `40:2`)
Button 변형세트 `40:13`(Primary=primary-strong CTA/Secondary/Text/Disabled) · Text Link `40:16` · Input `42:2` · Textarea `42:9` · Card `42:16` · Badge 변형세트 `43:10`(Success/Warning/Error/Neutral) · Chip `43:16` · Avatar `43:18` · Icon `43:20` · Accordion Item `43:22`. 전부 Auto Layout + Variable 바인딩.

## Section Components (page `45:2`)
Header `45:5` · Hero `45:15` · Problem `45:26` · Solution `46:2` · Before/After `46:18` · How it works `46:32` · Offer/Starter Kit `47:2` · FAQ `47:27` · Final CTA `47:46` · Lead Form `48:2` · Footer `48:22`.

## Landing Draft (page `50:2`)
- `Desktop 1200` `50:3` (11섹션 clone 조립, h≈4339)
- `Mobile 390` `51:2` (단일 컬럼 재구성, h≈3987)

## DESIGN.md와 다르게 해석한 부분
1. Hero 헤드라인 44/30px — DESIGN.md `display` 32px("32px+")를 히어로용으로 확대(스타일 자체는 32px).
2. Button `Secondary`=아웃라인(white+border+heading); DESIGN.md의 투명 텍스트 버튼은 `Text` 변형으로 분리.
3. Section은 프레임(`Section/*`)이며 Figma Component화는 안 함 — Desktop은 clone, Mobile은 단일 컬럼 재구성(instance 아님).
4. 본문 텍스트는 토큰 직접색(=변수값), 변수 바인딩은 CTA·코어 컴포넌트 핵심 fill 위주.
5. Icon은 placeholder 링 — 실제 아이콘셋(Lucide 등) 미도입.
6. Marketing accent는 문서로만 유지, 랜딩 비주얼 미사용(이미지 자산 부재).
7. Scale 변수는 생성만, 컴포넌트 radius/gap은 리터럴 적용(코너/갭 바인딩 보류).

## 추가 검토가 필요한 항목
- Before/After 일본어 샘플 카피 = placeholder → `jp-localizer` 검수 필요(핵심 차별점).
- Mobile 햄버거(≡)·네비 메뉴 미구현.
- Lead Form 에러/검증 상태 미표현 → Input 에러 변형 추가 검토.
- 이미지/스크린샷·로고 자산 부재(텍스트 전용 시안).
- Section의 진짜 Component 승격(instance 재사용) 여부 결정.
- Footer 링크 그레이 대비 최종 확인.

## 다음 단계 우선순위
1. Before/After·핵심 카피 `jp-localizer` 로컬라이즈 확정.
2. Lead Form 에러 상태 + Input 에러 변형 추가.
3. Section → Figma Component 승격(instance 기반 재사용) 검토.
4. Icon 세트(Lucide) 도입 + 히어로/섹션 이미지 자산.
5. (수요검증 진행 시) 랜딩 실배포 준비 — 카피 확정 → 프론트 구현.

---

# Update — 2026-07-08 오후 (한국어 B2B 카피 정렬)

> 방향 확정: 랜딩 1차 고객 = **대일 수출 준비 한국 회사** → 본문은 **한국어 B2B**. 일본어는 Before/After 샘플에만.

- **랜딩 카피 한국어 B2B로 복원** — Sections/Desktop/Mobile 전 프레임. 일본어는 Before/After 샘플 본문에만 유지(세라마이드 크림 예시). Before/After 하단에 "예시 카피" 노트 추가.
- **메인 CTA = `무료 진단 신청` 확정** (폼 제출 `무료 진단 신청하기`).
- **Lead Form 상태 추가** — helper(라이브) + success 확인 패널(3곳). Components 페이지에 **Input — States**(Default/Helper/Error/Success, `feedback/*` 변수 바인딩) 그룹 신설.
- **Footer 대비 통과** — 링크 ≈10.6:1(AAA), 저작권 ≈6.3:1(AA).
- **제목 hug/줄바꿈 정리** 완료(한국어 기준 재hug).
- **"5분" 표기 삭제** — Offer/How/FAQ/Final CTA에서 `무료 5분 진단`·`5분 만에` 제거(→ `무료 진단`/`사전 진단`). 잔여 0건. **[보류]** 소요시간 확정 시 되돌릴 수 있음.
- **Section Component 승격은 여전히 보류.** ([[추가 검토가 필요한 항목]] 참조)
- 상세 인수인계: `design/handoff-landing-design-system.md` §9.
