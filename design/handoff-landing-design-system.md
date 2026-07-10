# Handoff — Landing Design System (Phase 1)

> 작성일: 2026-07-08 · 브랜치 `hanna` · 다음 담당자와 이어가기 위한 인수인계 문서.
> 단일 기준: [`design/DESIGN.md`](./DESIGN.md) · 계획/as-built: [`design/design-system-plan.md`](./design-system-plan.md)

---

## 1. 오늘까지 완료된 작업 요약
- **DESIGN.md 구축** — Wanted 구조 기반 서비스 디자인 기준 문서.
- **Stibee coral palette 반영** — primary `#FF6464` 등 coral 팔레트로 재정의.
- **접근성 토큰 추가** — `primary-strong #D93636` (interactive용, white 텍스트 AA ≈4.6:1). 적용값(CTA/link/focus/selection/active)까지 정리.
- **Figma Color System 보드 완성** — `Color System — Stibee Coral` 페이지(Primitive/Semantic/Component/Marketing/Do·Don't). 스와치는 Variables에 바인딩(승격) 완료.
- **Phase 1 랜딩용 최소 디자인 시스템 구축** — Variables/Styles + Core/Section 컴포넌트 + Landing draft.
- **페이지 생성** — Foundations / Components / Sections / Landing.
- **`design/design-system-plan.md` 커밋 완료** (계획 + as-built 결과, node id 포함).

> ⚠️ **오늘 추가로 진행했으나 방향 전환으로 보류된 작업**: Landing/Sections 카피를 **일본어로 로컬라이즈**했음. 그러나 아래 3번 결정(1차 고객 = 한국 회사)에 따라 **랜딩 본문은 한국어 B2B로 재작성 필요**. 현재 Figma의 Landing/Sections 텍스트는 일본어 상태이므로 내일 되돌려야 함(자세히는 5번).
> → ✅ **2026-07-08 오후 완료: 한국어 B2B로 복원(§9 참조).**

---

## 2. 현재 기준 파일과 브랜치
| 항목 | 값 |
|---|---|
| 기준 파일 | `design/DESIGN.md` |
| 계획/as-built 문서 | `design/design-system-plan.md` |
| 브랜치 | `hanna` |
| 최신 커밋(이 문서 커밋 전) | `4aea50e` (design: document phase 1 landing design system plan) |
| 원격 | `https://github.com/duwjd/Branch-out-to-Japan.git` (`origin/hanna`) |

### Figma 파일 / 주요 페이지 / node id
- 파일: `2조 생존자들` (`C3FYvw7rhJrrHK4HgCZzBt`)

| 페이지 | node id | 비고 |
|---|---|---|
| COVER | `0:1` | 미수정 |
| Color System — Stibee Coral | `7:2` (board `16:2`) | 완료 · Variables 바인딩 |
| Foundations | `38:2` (root `38:3`) | Type/Spacing/Radius/Elevation/Grid/Color |
| Components | `40:2` (root `40:3`) | Core 컴포넌트 |
| Sections | `45:2` (board `45:3`) | 11 섹션 블록 |
| Landing | `50:2` | Desktop `50:3` · Mobile `51:2` |

- Variables: `1. Primitives`(`35:2`, 20) · `2. Semantic`(`35:23`, 16) · `3. Scale`(`36:12`, 12)
- Styles: Text 8종(Display~Micro) · Effect 2종(Floating/Modal)
- 컴포넌트·섹션별 node id는 `design/design-system-plan.md`의 "Build Results" 참조.

---

## 3. 중요한 결정 사항 (가장 중요)
- **랜딩페이지의 1차 고객은 일본 소비자가 아니라, 대일 수출을 준비하는 한국 회사다.**
- 따라서 **랜딩 본문 카피는 일본어가 아니라 한국어 B2B 카피 기준**으로 작성한다.
- **일본어는 예시에서만 사용** — Before/After 예시, 일본향 현지화 결과물, 샘플 개선안.
- 이 서비스는 **"일본어 랜딩"이 아니라 "한국 회사를 위한 일본 진출/일본향 콘텐츠 개선 서비스 랜딩"** 으로 이해해야 한다.

---

## 4. 디자인 원칙
- `design/DESIGN.md`를 **단일 기준**으로 사용.
- interactive UI는 **`primary-strong #D93636`**.
- `primary #FF6464`는 **brand / large / decorative**.
- `primary-tint #FFF8F8`은 **highlight band / tint surface**.
- **blue primary 사용 금지.**
- **`#FF6464` + white 작은 텍스트 금지** (≈2.9:1, AA 미달).
- marketing accent(orange/pink/sky/violet)는 **product UI primary로 사용하지 않음** (illustration/visual accent 전용).
- 임의 컬러 추가 금지 · semantic/brand-black/brand-grey 값 유지.

---

## 5. 현재 Figma 상태
| 페이지 | 상태 |
|---|---|
| COVER | 미수정 |
| Color System — Stibee Coral | 완료 |
| Foundations | 생성 |
| Components | 생성 (Section은 아직 최종 Component로 미승격) |
| Sections | 생성 |
| Landing | Desktop / Mobile Draft 생성 |

**주의 (카피 방향 불일치):**
- ~~현재 `Sections`·`Landing`의 본문 카피는 일본어 상태~~ → ✅ **2026-07-08 오후 한국어 B2B로 복원 완료(§9)**. 일본어는 Before/After 샘플 본문에만 유지.
- 미완료 다듬기: **제목/라벨 텍스트 hug 정리(줄바꿈 어색)** 및 **Hero type style 정리**는 보류됨(내일 한국어 카피 확정과 함께 처리 권장).
- 컴포넌트 구조·컬러·Variables는 그대로 유효 — **재작성은 텍스트(카피) 중심**이며 디자인 시스템은 재사용한다.

---

## 6. 내일 이어서 할 작업 우선순위
1. 랜딩페이지 **한국어 B2B 카피 방향 정렬**.
2. **Hero / Problem / Solution / Before-After / CTA 카피 확정**.
3. Before/After는 **"한국식 표현 → 일본향으로 재설계된 표현" 예시**로 정리(설명은 한국어, 샘플만 일본어).
4. **Lead Form error / success / helper state 추가**.
5. **Footer 대비 확인** (링크 그레이).
6. **Hero type style 정리** (제목 hug/줄바꿈 포함).
7. 랜딩 1차 승인 후 **Section component 승격 검토**.

---

## 7. 내일 팀원과 논의할 질문
- 우리가 파는 것은 **"번역"인가, "일본 시장 진입용 콘텐츠/랜딩 재설계"인가?**
- 1차 고객은 **화장품 브랜드 / 병원·뷰티 서비스 / 일반 대일 수출 기업** 중 무엇인가?
- **무료 5분 진단**에서 실제로 진단해 줄 항목은 무엇인가?
- Before/After 예시는 **어떤 산업군**으로 보여줄 것인가?
- CTA는 **"무료 진단 신청" vs "일본향 개선안 받아보기"** 중 무엇이 좋은가?

---

## 8. 주의 사항
- **일본어 카피 로컬라이즈 작업은 보류.**
- 먼저 **한국어 랜딩 구조와 B2B 메시지부터 확정**한다.
- **Figma는 클라우드 문서라 git 커밋 대상이 아님** — 상태는 본 문서와 node id로 참조한다.
- 커넥터 계정 주의: Figma는 개인 계정 `wildsoulvibeslab@gmail.com`으로 작업(회사계정 `hnkim@castingn.com` 접근 금지).

---

## 9. 업데이트 (2026-07-08 오후) — 한국어 B2B 카피 복원 & "5분" 표기 정리

Figma `Sections`(`45:3`) · `Landing / Desktop`(`50:3`) · `Landing / Mobile`(`51:2`)에 반영 완료.

1. **랜딩 본문이 한국어 B2B 기준으로 복원됨** — 일본어 UI 카피를 한국어로 되돌림(Sections 69 · Desktop 69 · Mobile 58건).
2. **일본어는 Before/After 샘플 본문에만 유지** — 나머지 전 프레임 한국어(잔여 일본어 0).
3. **세라마이드 크림 Before/After 예시 유지** — Before=직역·과장(나쁜 예), After=성분·사용감·근거 중심 재설계. 제목·태그·노트는 한국어. `※ 예시 카피이며 최종 광고 심의 문구 아님` 노트 추가.
4. **메인 CTA = `무료 진단 신청` 확정** (폼 제출 `무료 진단 신청하기` 유지).
5. **Lead Form 상태 추가** — helper(라이브), success 확인 패널(3곳), Components 페이지에 Input States(Default/Helper/Error/Success) 그룹 신설(변수 바인딩).
6. **Footer 대비 검토 통과** — 링크 `#c9cbcf` on `#202124` ≈10.6:1(AAA), 저작권 `#9a9c9f` ≈6.3:1(AA). 변경 불필요.
7. **Section은 아직 Component로 미승격** (보류 유지).

### "5분" 표기 정리 (소요시간 미확정 → 삭제)
- Offer 제목: `무료 5분 진단 + 7일 스타터 키트` → **`무료 진단 + 7일 스타터 키트`**
- How 1단계: `신청 · 5분 진단` → **`신청 · 사전 진단`**
- FAQ 답변: `무료 5분 진단은 신청 즉시…` → **`무료 진단은 신청 즉시…`**
- Final CTA 서브: `…무엇을 바꿔야 하는지부터 5분 만에 확인하세요.` → **`…확인하세요.`** (`5분 만에` 삭제)
- → 3개 프레임 잔여 "5분" **0건**. CTA 문구는 유지.

### 결정 보류 (팀 확정 필요)
- **[보류] 진단 소요시간**: 실제 소요시간이 확정되면 `무료 진단` → **`무료 5분 진단`** 등으로 되돌릴 수 있음. 지금은 `5분` 미표기.

### 남은 리스크
- 핵심 카피(Hero/CTA 등) **팀 최종 승인 필요**.
- **`5분` 표현 보류** — 진단 소요시간 확정 전까지 미표기.
- Before/After 일본어 샘플은 **약기법(薬機法) 검수 필요**(예시 카피).
- **이미지 / 아이콘 자산 필요**(현재 텍스트 시안).
- **Mobile 햄버거(≡) 메뉴 미구현**.
- Section이 프레임이라 카피 수정 시 **3곳(Sections/Desktop/Mobile) 동기화 필요** — 승격 시 해소.

---

## 10. 업데이트 (2026-07-08) — Before/After 한국어 보조 설명 추가

1. **Before/After 섹션은 일본어 샘플 본문만 유지하고, 한국어 보조 설명을 추가**했다.
2. **이유:**
   - 랜딩의 1차 고객은 **대일 수출을 준비하는 한국 기업**.
   - **일본어 샘플만으로는 개선 포인트를 즉시 이해하기 어려움.**
   - 따라서 **"일본어 예시 + 한국어 해설"** 구조로 변경.
3. **추가된 카드 구조:** 태그(한국어) → 일본어 샘플 본문 → 구분선 → 한국어 설명 라벨 → 3개 불릿 설명 → (섹션 하단) 예시 노트.
4. **Before 설명** (라벨 "일본 고객에겐 이런 점이 아쉽습니다", 회색 불릿):
   - 효능 단정 표현이 강해 과장처럼 보일 수 있음.
   - '국민 크림' 같은 한국식 표현이 일본 고객에게 어색할 수 있음.
   - 성분·사용감·구매 이유보다 홍보 문구가 먼저 보임.
5. **After 설명** (라벨 "일본 고객 관점으로 이렇게 바꿨습니다", coral `#D93636` 라벨 + 초록 `success #00b97c` 불릿):
   - 건조·민감·장벽 케어 니즈 중심으로 재구성.
   - 세라마이드, 무첨가, 사용감 등 확인 가능한 근거를 앞세움.
   - 과장 표현을 줄이고 일본 고객이 안심하고 이해할 수 있는 톤으로 정리.
6. **Figma 반영 위치:**
   - Sections Before/After (`46:18` — Before `46:22` / After `46:27`)
   - Landing / Desktop 1200 Before/After (`50:54` — Before `50:58` / After `50:63`)
   - Landing / Mobile 390 Before/After (`51:37` — Before `51:39` / After `51:42`)
   - ※ 기존 1줄 카드 노트는 3불릿 설명으로 통합(중복 제거). 하단 예시 노트·태그·제목·일본어 샘플·컬러 구조는 유지. 레이아웃 깨짐 없음.
7. **남은 리스크:**
   - 일본어 샘플은 **약기법(薬機法) 검수 필요**.
   - **Section은 아직 Component 미승격** (3곳 동기화 필요).
   - **핵심 카피 팀 최종 승인 필요.**

---

## 11. 업데이트 (2026-07-08) — 버튼 컬러 정책 재조정

**이유:** Primary Button 배경이 `primary-strong #D93636`이라 **에러/위험 상태처럼** 보임. CTA는 에러가 아니라 브랜드 행동 유도이므로 **기본 배경을 `primary #FF6464`로** 변경.

### 새 토큰 역할 (확정)
- `primary #FF6464` — **brand coral / default CTA / primary button / large emphasis**
- `primary-tint #FFF8F8` — tint surface · CTA band · soft selection background
- `primary-strong #D93636` — **hover / pressed / active / focus·contrast support** (기본 CTA 배경으로는 사용하지 않음). 작은 텍스트·텍스트 링크 대비 보조.
- `error #F0483C` — **error / destructive / validation only** (CTA 색과 명확히 구분)

### Figma 반영
- **Variable `interactive/default` → `coral/base(#FF6464)` 재지정** → 바인딩된 모든 CTA(Header/Hero/Offer/Final CTA/Lead submit) + Components `Button` Primary가 **일괄 #FF6464**로 전환.
- **`interactive/hover(#D93636)` 신설** (hover/pressed/active용).
- **Text Link 컴포넌트(`40:16`)는 #D93636 유지** — 작은 링크 텍스트 대비.
- **Color System 보드**: §3 `Primary button`·`Focus ring` 샘플 → `#FF6464`(+caption); §1 primary/primary-strong 카드 노트, §2 Interactive 설명, §4 Product-UI 패널(주블록=primary #FF6464·보조=primary-strong #D93636), §5 Do/Don't 문구 갱신. (Selection/Active/Text link 샘플은 #D93636 유지)
- `primary-strong` 토큰은 **삭제하지 않음**. focus ring은 `#FF6464`(필요 시 `#FFF8F8` 조합)로 정리.

### 문서 반영
- `design/DESIGN.md` — button-primary bg(#ff6464), §2 Primary Strong 역할, §7 Do, §9 Quick Ref, §12 원칙, §14 focus/retry 적용값 갱신. error vs CTA 역할 차이 명시.

### 접근성 주의점 (중요)
- **`#FF6464` + 흰 텍스트 ≈ 2.9:1 → WCAG AA(4.5:1)·대형 텍스트(3:1) 모두 근소 미달.** 이번 변경은 "에러처럼 안 보이게" 하는 **브랜드 우선 결정**.
- 완화책: CTA는 **large/bold 흰 텍스트** 사용, hover 시 `#D93636`로 대비 보강, **작은 인터랙티브 텍스트·링크는 `#D93636`** 사용.
- **[동기화 필요] `design/DESIGN.md` ↔ `design/references/wanted-design.md`** — 이번엔 DESIGN.md만 수정해 두 파일이 diverge. 필요 시 wanted-design.md 동기화.

---

## 12. 업데이트 (2026-07-09) — Refined Landing v2 DS 정합성 감사 & 정리

> 대상: Figma 페이지 **`04 Screen Refinement`(`110:298`)** — 기존 `Landing`(`50:2`)과 **별개로 새로 그린 리파인 랜딩**(Desktop `110:2201` / Mobile `110:2676`). DS를 재사용하지 않고 직접 그려져 정합성 이슈가 있었음. 전수 감사·정리 문서: [`design/audit-refined-landing-ds.md`](./audit-refined-landing-ds.md).

### 이번 세션 완료
1. **CTA 컬러 정정** — 버튼 오프스펙 `#f04e4e` 25개 → coral `#ff6464`(변수 바인딩). 텍스트 링크 CTA는 `coral/strong #d93636`.
2. **① 컴포넌트(부분)** — 채움형 CTA **17개 → DS `Button`(Primary) 인스턴스화**(데스크톱+모바일).
3. **② 타이포(부분)** — **232개 텍스트 스타일 연결 + 9개 크기 정규화**. 오프스케일 제목 34→32·30→24·22→20·18→20.
4. **③ 컬러 바인딩/라디우스** — raw fill **555개 변수 바인딩(96%)** + 카드 **radius 16→12**.

### 보류/백로그 (다음 세션)
- **[deferred] ④ 그리드·컨테이너** — 1185폭+컬럼그리드. 정렬 재배치 시각영향 커서 **나중에 검토**.
- **[수동] ⑤ 외부 UI 킷 detach** — Plugin API 불가. Figma Assets 패널에서 Material 3/Simple DS/Apple 수동 제거(인스턴스 0, 영향 없음).
- **[별도 세션 · 큰 작업]** DS 자체 확장 필요:
  - ~~**컴포넌트 슬롯화** → 카드/인풋/배지 인스턴스화(①잔여).~~ ✅ **완료(2026-07-10)**: Button 라인변형·**Input 5필드**·**Badge(Status Pill) 10**·**Card 6타입 16장**(PricingCard/ReportCard/CheckerMock/ResultPreview/BeforeCard/AfterCard) 인스턴스화 + `success-tint` 토큰·아이콘 4종·`Status Pill` 세트 신설. 상세: `audit-refined-landing-ds.md` §1·§8.
  - **타이포 램프에 굵기·히어로 변형 추가** → 미연결 텍스트(강조·히어로 ~100개) 스타일화(②잔여).
  - **오프토큰 토큰 신설**(success-tint·bg/inverse·다크푸터 그레이) → 잔여 21 fill 바인딩(③잔여).
  - 상세 백로그: `audit-refined-landing-ds.md` §8.

> ⚠️ Figma는 git 대상 아님 — 위 상태는 본 문서와 `audit-refined-landing-ds.md`의 node id로 참조(§8 정책 동일).
