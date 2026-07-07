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
- 현재 `Sections`·`Landing`(Desktop `50:3`/Mobile `51:2`)의 **본문 카피는 일본어 상태**다(오늘 로컬라이즈).
- 3번 결정에 따라 **한국어 B2B 카피로 재작성**해야 한다. 일본어는 Before/After 등 "예시"에만 남긴다.
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
