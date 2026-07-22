# 스펙 · ② 썸네일 변환기 (KR→JP) — 프롬프트 파이프라인

> 마케팅 스튜디오(상품 ②)의 **"한국 썸네일 → 일본향 썸네일 변환"** 기능 구현 스펙.
> 작성: 2026-07-08 · 상태: **프롬프트 파이프라인 확정 / API 실검증 전** (스튜디오 개발 주간 2026-07-18~24에 검증)
> 관련: [[../research/jp-thumbnail-style-taxonomy]] · [[01-report-spec]] · [[../research/jp-detail-message-patterns]] · [[../decisions/2026-07-04-상품-구조-구체화]]

---

## 0. 자산 맵 — 이 기능이 로드하는 것

| 자산 | 역할 |
|---|---|
| `data/processed/thumbnail-style-prompts.json` (v1.1.0) | **기능이 직접 로드하는 프롬프트 팩** — 스타일 A~H 템플릿·슬롯 정의·법적 가드·조립 규칙(`usageNotes`·`inputCleanupNote`·`slotFillingRules`)·플랫폼 선택 가이드 |
| `docs/research/jp-thumbnail-style-taxonomy.md` | 스타일 8종의 정의·경계 규칙·근거 (사람이 읽는 단일 근거) |
| `data/processed/thumbnail-style-labels.jsonl` | 라벨 120장 — few-shot 예시·스타일 자동판별 평가셋 |
| 이 문서 | 파이프라인 절차·조립 알고리즘·워크드 예시(골든 픽스처)·검증 계획 |

**핵심 원칙 (프로젝트 포지셔닝과 동일):** 이 기능은 이미지 "자동 생성툴"이 아니다. 일본 고객의 신뢰 문법(스타일 8종)이 내장된 **메시지 재설계 도구**이며, 카피는 반드시 jp-localizer 산출물을 쓰고 실적 배지는 근거 없이는 생성되지 않는다.

**입력 원본 기반 원칙 (2026-07-22 추가):** 생성물은 반드시 **사용자가 입력한 제품컷을 기반**으로 한다. 어떤 폴백·데모·목 모드도 입력과 무관한 이미지를 "내 결과"처럼 제시하지 않는다 — 입력 원본이 결과 화면에 항상 병기되고(② 기획서 RESULT-01), 입력이 반영되지 않은 산출물은 반드시 샘플임을 고지한다(아래 §4 목 모드 계약).

---

## 1. 목표 · 비목표

**목표**
1. 한국 썸네일/제품컷 1장을 입력받아, 타깃 플랫폼(아마존JP/라쿠텐/Qoo10)에 맞는 스타일로 일본향 썸네일을 생성한다.
2. 생성 전 과정에서 법적 가드(경품표시법·약기법 인접 영역)가 **구조적으로** 작동한다 — 근거 없는 배지·가격·효능 주장은 프롬프트에 진입 자체가 불가.
3. 제품 실물(형상·라벨·로고)은 절대 변형하지 않는다.
4. **스타일 8종이 전부 자기 서명 요소를 실제로 렌더한다**(2026-07-22 추가). 지어낼 수 없는 요소(수상 실적·모델·가격)는 화면에서 입력받아 그대로 렌더하고, 입력이 없으면 그 요소 없이 생성하거나(E 외) 생성 조건을 안내한다.

**입력 계약 (2026-07-22 확정 — ② 기획서 HOME-02·02b·05·05b 정본)**

| 입력 | 필수 여부 | 대응 스타일 | 비고 |
|---|---|---|---|
| 제품컷 1장 | 항상 필수 | 전체 | JPG·PNG·WebP / 10MB / 권장 1024px+ |
| 타깃 플랫폼 | 선택 | 전체 | 미지정 시 추천·부적합 표시 없음 |
| 실적 3필드(실적명·부문·집계일) | E 필수 · 그 외 선택 | C·D·E·F·G | `conditionalBadgeSlots`의 proof. 3필드 전부 있을 때만 배지 문단 삽입 |
| **모델컷 1장 + 사용 권한 동의** | **F 필수** | F | 브랜드 보유컷만. 동의 미체크 시 파이프라인 진입 불가. 생성 호출은 `[제품컷, 모델컷]` 배열 |
| **프로모 입력**(세트명·판매가 필수 / 통상가·할인율·GIFT·한정 칩·각주 선택) | **G 필수** | G | 통상가는 `normalPriceVerified` 체크가 있을 때만 취소선 렌더(有利誤認 방지) |

**비목표**
- 범용 이미지 생성기(금지 포지션 1번과의 경계선). 스타일 8종 밖의 자유 생성은 제공하지 않는다.
- 카피 작문 — 카피는 jp-localizer(→ 약기법 검수)의 몫이고, 이 기능은 렌더링만 한다.
- 일본어 라벨 패키지 재디자인 — 물리 패키지 현지화는 별도 서비스 영역.

---

## 2. 파이프라인 6단계

```
① 입력 분석 → ② 스타일 선택 → ③ 카피 재설계 → ④ 슬롯 채움 → ⑤ 프롬프트 조립 → ⑥ 생성·후처리
   (이미지)     (플랫폼 매핑)    (jp-localizer)   (proof 게이트)    (결정적 코드)      (images API)
```

### ① 입력 분석
- 입력 이미지에서 추출: 제품 정보(브랜드·제품명·패키지 표기 사실 — SPF/PA·용량 등), 기존 KR 오버레이 요소 목록.
- **입력 유형 판정**: `제품 단독컷` vs `프로모 썸네일`(오버레이 존재). 프로모 썸네일이면 ⑤에서 `inputCleanupNote`를 프리펜드.
- 각 KR 요소를 3분류: **유지·정제**(브랜드 자산인 배경 모티프 등) / **재설계**(카피 — ③으로) / **제거**(한국 기획전 뱃지·형광 테두리·특가 밴드).

### ② 스타일 선택
- `selectionGuide.byPlatform`으로 후보 축소 → `tieBreakRules`로 확정.
  - amazon-jp → A·B / rakuten-official → C·H·D·E / rakuten-reseller → A·G / qoo10 → G·F·D
- 제약(2026-07-22 개정 — **입력 게이트 3종**): E는 실제 수상 이력 3필드, F는 브랜드 보유 모델컷 1장 + 사용 권한 동의, G는 세트명·판매가. 화면에서 조건 입력을 받아 채우며(② 기획서 HOME-02b·05·05b), **미충족 시 생성 자체가 성립하지 않는다** — 차순위 자동 폴백은 하지 않고 무엇을 채우면 되는지 안내한다(사용자 선택권 보존).

### ③ 카피 재설계 (jp-localizer 호출)
- 한국 카피의 **의도**를 추출해 일본 고민 어휘·관례어로 재설계 — 번역 금지.
- 예: "쿨톤 치트키"(밈 어휘) → 의도 = 하얗게 들뜨지 않는 톤업 → `白浮きしない、透け感トーンアップUV` (白浮き = 코퍼스 확인 고민 어휘, トーンアップUV = 관례어).
- 산출 카피는 약기법 검수(리포트 ① 파이프라인의 판정 로직 재사용)를 통과한 것만 ④로 전달.

### ④ 슬롯 채움
- 팩의 `textSlots` 정의대로 채운다. `slotFillingRules` 준수 (성분 미상 시 제형 비주얼 대체, 톤업 카피에 `※メーキャップ効果による` 각주 등).
- **requiresProof 게이트**: `conditionalBadgeSlots`는 proof 데이터(수상명·연도·부문·집계기간)가 온전히 있을 때만 `template`을 채워 삽입, 없으면 **플레이스홀더를 빈 문자열로 제거**. 기본값 = 배지 없음.
- **가격 슬롯 게이트 (2026-07-22 개정)**: `G.priceBlock`·`G.giftInsetParagraph`는 LLM이 채우지 않고 **사용자 프로모 입력에서 코드가 조립**한다. 조립 규칙 —
  - `priceBlock` = 판매가(필수) + 할인율(있으면) + **통상가는 `normalPriceVerified === true`일 때만** 취소선으로 포함. 체크가 없으면 통상가 문자열이 있어도 버린다(有利誤認 방지, `slotFillingRules` 3항)
  - `giftInsetParagraph` = GIFT 입력이 있을 때만 문단 삽입, 없으면 문단째 제거
  - 입력 문자열은 **자단위 그대로** 프롬프트에 들어간다. 통화 기호·세금 표기·쉼표를 코드가 재가공하지 X
  - 구 정책 "가격 슬롯 v1 항상 공란"(입력 UI가 없던 시기의 임시 차단)은 **폐기**. 지어내기 차단 목적은 `commonNegativeConstraints`의 "No fabricated ... prices"와 이 조립 규칙이 계속 담당한다

### ⑤ 프롬프트 조립 (결정적 코드 — LLM 개입 없음)
```typescript
import promptPack from "@/data/processed/thumbnail-style-prompts.json";

/** 스타일 카테고리와 슬롯 값으로 최종 프롬프트를 조립한다 (미채움 슬롯·미증빙 배지 문단은 제거) */
function buildPrompt(categoryId: string, slots: Record<string, string>, isPromoInput: boolean): string {
  const cat = promptPack.styleCategories.find((c) => c.id === categoryId);
  if (!cat) throw new Error(`unknown style category: ${categoryId}`);
  const body = cat.promptTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => slots[key] ?? "");
  const constraints = [
    ...cat.constraints, ...promptPack.commonConstraints,
    ...cat.negativeConstraints, ...promptPack.commonNegativeConstraints,
  ];
  const cleanup = isPromoInput ? promptPack.inputCleanupNote.template + "\n\n" : "";
  return `${cleanup}${body}\n\nStrict requirements:\n- ${constraints.join("\n- ")}`;
}
```

### ⑥ 생성 호출 · 후처리
```typescript
const result = await openai.images.edit({
  model: "gpt-image-2",                      // 실검증으로 확정(2026-07-21, §6-Q1)
  image: sources,                            // 입력 이미지 배열 — 아래 "다중 이미지 입력" 참조
  prompt: buildPrompt(categoryId, slots, isPromoInput),
  size: "1024x1024",
  quality: "high",                           // 개발 반복 중엔 "medium"으로 비용 절약
  input_fidelity: "high",                    // ★ 제품 라벨·로고 보존 — 지원 모델에만 조건부(gpt-image-2는 항상 고정밀이라 파라미터 거부)
});
```

**다중 이미지 입력 (2026-07-22 본문 계약으로 승격)** — `images.edit`의 `image`는 단일 파일과 배열을 모두 받는다(gpt-image 계열 최대 16장, SDK 타입 `Uploadable | Array<Uploadable>`). 이 기능은 아래 2가지만 쓴다.

| 스타일 | `image` | 순서 의미 |
|---|---|---|
| A~E · G · H | `[제품컷]` | 편집 대상 = 제품컷 |
| **F 모델+카피형** | `[제품컷, 모델컷]` | 1번째 = 변형 금지 제품, 2번째 = 그대로 쓸 모델 원본 |

F의 `promptTemplate`은 이미 이 2장을 전제한다("Transform the provided **images**… Use the provided model photo **as-is**"). 얼굴 합성 금지는 팩 F `constraints` 1·3항이 프롬프트에서, 사용 권한은 화면 동의 체크(HOME-02b)가 입력 단계에서 각각 강제한다.
- **하이브리드 오버레이(권장)**: 가격·할인율 등 법적 구속력 있는 텍스트와 오탈자가 치명적인 소형 일본어는 모델이 그리게 하지 말고, 생성 결과 위에 코드(sharp/canvas)로 오버레이한다. 이때 해당 텍스트 슬롯은 프롬프트에서 "빈 밴드/빈 칩만 그리도록" 조정한다. 실검증(§5) 결과에 따라 텍스트 슬롯별로 모델 렌더 vs 오버레이를 확정한다.
- 제품 라벨 열화가 심하면 폴백: 배경·레이아웃만 생성 → 원본 제품 누끼를 합성.

---

## 3. 워크드 예시 (골든 픽스처) — Chasin' Rabbits 톤업선

**입력:** 한국 프로모 썸네일 — 〈All About Glow Tone Up Sun〉 SPF50+ PA++++ 70mL. 형광 그린 테두리, "7/8(수) 오늘의 특가"·"얼굴부터 바디까지 OK"·"쿨톤 치트키" 카피, SURVIVAL BEAUTY·"유분·땀 케어" 뱃지, 하늘 배경.

### ①단계 산출 — KR 요소 처리 매핑

| 입력 요소 | 판정 | 근거 |
|---|---|---|
| 형광 그린 테두리 | 제거 | 라쿠텐 테두리 금지 |
| "7/8(수) 오늘의 특가" | 제거 | C·D는 가격 요소 금지. 특가 소구 필요 시 G 선택 |
| "쿨톤 치트키" | 재설계 | 밈 어휘 → `白浮きしない、透け感トーンアップUV` |
| "얼굴부터 바디까지 OK" | 재설계 | 관례 표기 `顔・からだ用` |
| "유분·땀 케어" 뱃지 | 제거 | 효능 인접 주장 — 근거 검수 전 미표기 |
| SURVIVAL BEAUTY 뱃지 | 제거 | 한국 기획전 마커 |
| 하늘·구름 배경 | 유지·정제 | 브랜드 자산 + 일본 선케어 무드 호환 |

### 예시 1 — C (라쿠텐 공식샵 가정)

슬롯: `brandName` "Chasin' Rabbits" · `backgroundVisual` 하늘 모티프 정제 · `catchCopyJa` `白浮きしない、透明感トーンアップUV` · `featureChipsJa` `SPF50+ / PA++++ / 顔・からだ用` · `accentColor` sky blue(#3D8FDD) · `rankingBadgeParagraph` **""(실적 없음 → 문단 제거)**

```text
The input is a Korean promotional thumbnail: first isolate the physical product
exactly as it appears, discarding every existing overlay element (frames, badges,
price bands, character stickers, and all Hangul text).

Transform the provided Korean product image into a Rakuten official-brand-shop
style thumbnail. Layout: (1) Top-left: a compact brand chip — brand logo text
'Chasin' Rabbits' with a small attached tag reading '公式ショップ' in white on a
dark accent block. (2) Center: the product as the hero, unchanged, on a background
of a clear summer sky — soft gradient from deep blue to white, wispy clouds near
the bottom, gentle sunlight from upper left (refined continuation of the brand's
sky motif). (3) Bottom: a horizontal copy band with the Japanese catch copy
'白浮きしない、透明感トーンアップUV' in bold gothic type, dark text on light band
(or white on dark, matching sky blue (#3D8FDD) matching the product cap).
(4) Optional feature chips near the product: SPF50+ / PA++++ / 顔・からだ用 as
small rounded rectangles.  Keep total text coverage under 20% of the image area.

Strict requirements:
- Badges and chips must follow Rakuten conventions: official chip top-left, medal top-right, copy band bottom.
- Any No.1 or ranking claim must visually include its fine-print footnote.
- (이하 commonConstraints 4 + negativeConstraints 1 + commonNegativeConstraints 6 — buildPrompt가 팩에서 자동 연결)
```

### 예시 2 — D (성분 비주얼형, 성분 데이터 없음 케이스)

슬롯: `catchCopyJa` `白浮きしない、透け感トーンアップUV` · `copyColor` deep sky blue(#2E6FB7) · `ingredientVisual` **제형 비주얼로 대체**(물방울+톤업 크림 스미어 — 성분 미상이므로 성분명 생성 금지) · `featureChipJa` `顔・からだ用` · `footnoteJa` **`※メーキャップ効果による`**(톤업 주장 표준 각주) · `backgroundColor` 하늘색→흰색 그라데이션 · `rankingBadgeParagraph` ""

```text
(inputCleanupNote 동일)

Transform the provided Korean product image into a Japanese ingredient-forward
thumbnail. Layout: (1) Top: the Japanese catch copy '白浮きしない、透け感トーン
アップUV' in large bold gothic type across the upper zone, dark charcoal text
(or deep sky blue (#2E6FB7)). (2) Center: the product unchanged as hero,
surrounded by realistic ingredient visuals: fresh translucent water spheres and
a soft white tone-up cream smear floating around the tube, with faint sunlight
sparkles. (3) A small feature chip reading '顔・からだ用' in a rounded outline
box near the bottom-left. (4) Small fine-print footnote line '※メーキャップ効果
による' at the very bottom in light grey, if provided.  Background: a clear
sky-blue gradient fading to white at the bottom with soft depth-of-field.
Text coverage under 20%.

Strict requirements:
- (D constraints 2 + 공통 제약 — buildPrompt가 자동 연결)
```

**C↔D 차이 요점:** 카피 위치(하단 밴드 → 상단 대형), 公式 칩 유무, 배경(무드 → 제형·성분 비주얼), 그리고 D의 `※メーキャップ効果による` 각주가 톤업 카피를 약기법 관례상 안전하게 만든다.

---

## 4. 생성물 품질 체크리스트 (검수 게이트)

생성 이미지는 아래를 통과해야 고객에게 노출된다 (초기엔 사람 검수, 이후 비전 모델 자동화 후보):

- [ ] **생성물이 입력 제품컷 기반인가** — 폴백(누끼 합성)을 포함해, 입력과 무관한 이미지가 결과로 나가는 경로가 없는가 ← 입력 원본 기반 원칙(§0)
- [ ] 제품 형상·라벨·로고가 입력과 동일한가 (라벨 글자 뭉개짐 없음)
- [ ] 오버레이 일본어에 오탈자·유령 글자가 없는가 (슬롯 원문과 자단위 대조)
- [ ] 한글·간체자가 남아 있지 않은가
- [ ] 제공하지 않은 배지·순위·가격·효능 문구가 생성되지 않았는가 ← **법적 게이트, 최우선**
- [ ] 스타일 시그니처 충족 (C면 칩·밴드 위치, D면 카피·비주얼 구도 등 — taxonomy §3 기준)
- [ ] 텍스트 점유율 상한 준수 (A·B 0% / C·D 20% / F 25% / G 35% / H 10%)
- [ ] **(F) 모델 얼굴이 업로드한 모델컷과 동일한가** — 새 얼굴 합성·이목구비 변형 없음. 조명·색 조화만 허용 ← 초상권 게이트
- [ ] **(G) 가격·할인율·GIFT가 입력값과 자단위로 일치하는가** — 통상가 취소선은 실적 확인 체크가 있을 때만 존재 ← 법적 게이트

F·G 2항은 2026-07-22 조건 입력 도입과 함께 추가됐다. 구현상 v1 검수 게이트는 **구조적 보증 기록**(파이프라인이 보장하는 사실을 근거와 함께 남김)이고 비전 자동검수는 없다 — 위 항목은 그 기록의 계약이자 사람 검수·자동화의 기준이다.

### 목(mock) 모드 계약 (2026-07-22 추가)

API 키 없이 도는 목 모드는 실생성 대신 고정 샘플(HARUON 데모 자산)을 반환한다. 이 폴백이 §0 입력 원본 기반 원칙을 깨지 않도록, 목 모드 산출물은 아래 계약을 지킨다.

1. **샘플 고지 의무** — 목 산출물은 결과 화면에서 "데모 이미지입니다. 업로드한 제품컷이 반영되지 않은 샘플입니다" 수준의 고지를 배너로 노출한다. 작은 배지 하나로 흘리지 않는다(사용자가 "내 결과"로 오인하는 것이 이 계약이 막는 사고다).
2. **업로드 원본 유지 표시** — 목 모드에서도 사용자가 올린 원본은 결과 화면 Before 자리에 그대로 남는다. 원본까지 샘플로 바꿔치기하지 않는다.
3. **목 카피도 데모 고지** — 목 카피(HARUON 고정 상수)로 렌더된 재설계 해설에도 데모 표기를 병기한다.
4. **다운로드 전파** — 목 산출물 다운로드 파일명·고지에 데모 표기를 포함한다.

화면 동작 정본은 ② 기획서(RESULT-01·02·06)다. ⚠ **후속 코드 동기화 필요**: 현 구현(`lib/studio/imageGen.ts`·`lib/studio/fixtures.ts`)은 목 모드에서 업로드를 무시하고 샘플 PNG·고정 카피를 반환하며 위 1·2·4를 충족하지 않는다 — 다음 개발 스프린트에서 이 계약대로 정렬한다.

## 5. 실검증 계획 (API 키 확보 후 — 스튜디오 개발 주간)

1. 카테고리당 1~2장, 실제 한국 썸네일 입력으로 생성 (2026-07-08 결정으로 보류했던 것).
2. 확인 항목: `input_fidelity: high`의 라벨 보존력 / 일본어 렌더링 오탈자율 / 배지 무단 생성 여부(빈 proof로 호출해 배지가 안 나오는지) / 스타일 재현율.
3. 결과에 따라: 텍스트 슬롯별 모델 렌더 vs 하이브리드 오버레이 확정, 프롬프트 문구 조정 → 팩 v1.2.0.

## 6. 열린 질문

- **Q1. 모델 ID·파라미터**: 모델 ID는 실 API 검증으로 **`gpt-image-2` 확정**(2026-07-21). `input_fidelity`는 **gpt-image-2 미지원 확인**(2026-07-22 실검증 400 — 입력을 항상 고정밀 처리해 파라미터 자체가 불필요·거부). 코드가 지원 모델에만 조건부 부여 + 미지 모델 거부 시 제거 재시도. 라벨 보존력 자체는 골든 픽스처 스모크(§5)에서 확인 — 미달 시 폴백(누끼 합성 방식) 우선.
- **Q2. 스타일 자동 추천**: 입력 분석(①)에서 스타일을 자동 추천할지, 고객이 8종 갤러리에서 고르게 할지 — UT(8/1~3)에서 확인. labels.jsonl이 자동판별 학습·평가셋.
- **Q3. 비용 모델**: high 품질 장당 비용 × 고객당 생성 횟수 → 스튜디오 요금제에 반영 (02-product-spec 커머셜 모델과 연결).
