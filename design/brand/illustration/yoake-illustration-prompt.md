---
title: YOAKE 브랜드 일러스트 — ChatGPT 생성 프롬프트 팩
space: 디자인
status: 정본
phase: Phase 0
updated: 2026-08-18
owner:
tags: [디자인, 일러스트, 브랜드]
---

# YOAKE 브랜드 일러스트 — ChatGPT 생성 프롬프트 팩

> 대상: Figma `LP_Illustration_Style`(node 1118:3553) 및 `LP_Assets_Illustrations`의 ILL_* 8종 고도화
> 작성 2026-08-16 · 레퍼런스는 **스타일 속성만** 참고하며 특정 브랜드·작가의 캐릭터/구도는 복제하지 않는다

---

## 0. 먼저 알아야 할 것 — 왜 이 워크플로인가

ChatGPT 이미지 생성은 **SVG를 만들지 못한다.** PNG 래스터만 나온다. 그리고 지정한 헥사값(`#182333`, `#FF6F61`)을 정확히 재현하지 못하고 매번 조금씩 어긋난다. 그래서 색까지 한 번에 뽑으려 하면 8장의 색이 전부 미묘하게 다른 사고가 난다.

**따라서 2단계로 나눈다.**

| 단계 | 도구 | 산출물 |
|---|---|---|
| ① 형태 생성 | ChatGPT | **순수 흑백** 선화 PNG (2048px 이상) |
| ② 벡터화 | Illustrator Image Trace / vectorizer.ai | SVG |
| ③ 리컬러 | Figma | Deep Navy·Dawn Coral 토큰 적용 |

②③에서 색을 입히므로 **①에서는 색을 요구하지 않는다.** 레퍼런스도 원래 흑백이라 이 방식이 스타일에도 더 맞는다.

> 코랄이 들어갈 자리는 프롬프트에서 `mid-gray (50% gray) fill`로 지정한다. 벡터화 후 Figma에서 그 회색만 골라 `color/brand/coral`로 바꾸면 된다. 코랄 면적 10% 이내 규칙도 이 단계에서 통제된다.

---

## 1. 마스터 스타일 프롬프트

**매 대화 첫 메시지로 한 번 붙여넣는다.** 이후에는 §2의 장면 프롬프트만 이어서 보낸다. 대화를 새로 열면 이것부터 다시 붙여야 한다.

```
You are illustrating a coherent set of editorial spot illustrations for a B2B SaaS
brand. I will send you one scene at a time. Apply this style sheet to every scene
without exception, so that all illustrations look like they came from one artist's
hand on the same afternoon.

=== MEDIUM ===
Monochrome pen-and-ink drawing in the tradition of independent Japanese editorial
magazines and quiet Japanese web design. Pure black ink on pure white. No color,
no gray shading, no gradients, no halftone, no texture, no cross-hatching.

=== LINE ===
- Hand-drawn contour lines with a slight, natural wobble — never a perfect
  computer-straight line, never a perfect circle.
- Uniform pen pressure. Consistent line weight throughout the whole set:
  roughly 2px on a 1000px-wide canvas for figures, slightly thinner for objects.
- Open, confident strokes. Lines may slightly overshoot at corners.
- No tapering calligraphic brush strokes. No sketchy multi-stroke scribbling.

=== BLACK MASSES ===
The signature of this style is the contrast between thin outlines and large,
flat, solid black shapes. Fill these areas 100% black with no outline:
hair, one garment per figure (a sweater, a jacket, trousers, or a skirt),
shoes, and one or two key objects.
Everything else stays white with a thin black outline.
Aim for roughly 25-35% of the drawing being solid black mass.

=== FIGURES ===
- Adult office workers, late 20s to 40s. Smart-casual clothing — knit tops,
  shirts, wide trousers, simple skirts. No suits and ties, no hoodies, no uniforms.
- Mixed genders and body types across the set. No one is glamorous, no one is a
  caricature.
- Slightly stylized proportions: head about 1/6 of full body height, long simple
  limbs, relaxed posture. Full-body or three-quarter-body figures.
- FACES: absolute minimum. Two small solid dots for eyes. A single short line for
  the mouth ONLY if the scene needs it, otherwise no mouth at all. No nose,
  no eyebrows, no ears, no blush, no wrinkles, no anime features.
- HANDS: simplified mittens or three-finger shapes. Never draw five detailed
  fingers.
- The humor lives entirely in the BODY LANGUAGE — a lean, a shrug, arms thrown
  up, a squat, a stretch. Dry adult wit, never slapstick, never cute.

=== COMPOSITION ===
- One clear action per scene. If you cannot name the action in three words, simplify.
- Figures and objects float freely in white space. NO ground line, NO horizon,
  NO room, NO furniture beyond what the action requires, NO background scenery,
  NO frame or border.
- Objects orbit the figure at slightly playful angles — tilted papers, floating
  cards, a document mid-air. This gives the set its rhythm.
- Generous negative space. The drawing should occupy roughly 70% of the canvas
  with clear breathing room around it.
- Asymmetric, editorial placement. Do not center everything.

=== ACCENT AREAS (important) ===
A few specific elements must be filled with FLAT 50% MID-GRAY instead of black.
These are the spots that will later be recolored to the brand accent color.
I will name them explicitly in each scene. Keep them small — no more than about
10% of the drawing. Use exactly one gray value, flat, no shading.

=== OUTPUT ===
- Square canvas, pure white background, drawing centered with margin.
- Highest resolution available.
- NO text, NO letters, NO numbers, NO logos, NO signage, NO speech bubbles with
  writing. Where a document would have text, draw simple horizontal ink rules
  instead. This is critical — any attempted lettering will be garbled and unusable.
- NO watermark, NO signature, NO caption.

=== NEVER DRAW ===
Mount Fuji, cherry blossoms, torii gates, kimono, folding fans, sushi, geisha,
samurai, rising-sun rays, national flags, maneki-neko, lanterns, chopsticks.
No cultural tourism symbols of any kind. The Japanese quality of this work comes
from restraint, white space and asymmetry — never from motifs.
Also never: handshakes, business-people-shaking-hands, thumbs up, lightbulb ideas,
gears, rocket ships, checkmark badges, trophies, dollar signs, generic corporate
stock clichés, 3D rendering, watercolor, sketchy pencil, comic screentone,
drop shadows, isometric perspective.

Confirm you understand, then wait for my first scene.
```

---

## 2. 장면별 프롬프트 (8종)

마스터 프롬프트 뒤에 **하나씩** 보낸다. 8개를 한 번에 보내면 스타일이 뭉개진다.

### ① ILL_Hero_Input — 자료를 넣는 사람

```
SCENE 1 of 8. Title: "handing over the copy".

A standing woman seen from the side, leaning forward slightly, holding out a
single sheet of paper with both hands as if feeding it into something just
outside the frame to her right. Her expression is neutral and focused.
Solid black: her hair (short bob) and her knit sweater. White with outline:
her trousers and the paper.
Two more sheets of paper float behind her shoulder at tilted angles, waiting.
The papers carry only horizontal ink rules, no text.
MID-GRAY ACCENT: the top header bar of the sheet she is holding out.
```

### ② ILL_Hero_Output — 결과를 확인하는 사람

```
SCENE 2 of 8. Title: "checking what came out".

A standing man in three-quarter view, holding a rectangular card up at eye level
with one hand, tilting his head to inspect it. His other hand rests on his hip.
Below and beside him, two more finished cards of different proportions float in
the air — one wide, one tall.
Solid black: his hair and his wide trousers. White with outline: his shirt and
all the cards.
Each card shows a simple image block and a few horizontal ink rules, no text.
MID-GRAY ACCENT: the image block inside the card he is holding.
```

### ③ ILL_Gap_Evidence — 근거가 끊긴 상태

```
SCENE 3 of 8. Title: "the paper that does not connect".

A woman standing, holding a large sheet of paper in her left hand and reaching
her right hand toward a second document that floats away from her, just out of
reach. Her posture leans after it. Slight frustration read purely from the lean.
Between the two documents, a short horizontal connecting line is visibly BROKEN
with a clear gap in the middle.
Solid black: her hair (tied back) and her long skirt. White with outline:
her top and both documents, which carry only horizontal ink rules.
MID-GRAY ACCENT: the broken connector line and the small break mark at its gap.
```

### ④ ILL_Gap_Channel — 규격이 안 맞는 상태

```
SCENE 4 of 8. Title: "one image, three frames".

A man standing with both arms raised, holding a single wide rectangular card,
trying to fit it into an empty rectangular outline that is clearly the wrong
shape. Shoulders slightly hunched, a small helpless shrug.
Around him float two more empty rectangular outlines at different proportions —
one tall and narrow, one small square. All three empty outlines are drawn with
thin lines only, no fill.
Solid black: his hair and his jacket. White with outline: his trousers and the card.
The card shows one image block and two ink rules, no text.
MID-GRAY ACCENT: the image block inside the card he is holding.
```

### ⑤ ILL_Service_Diagnose — 분류하고 연결하는 사람

```
SCENE 5 of 8. Title: "sorting and linking".

A woman crouching or kneeling on the floor, seen from the side, reaching out with
one hand to place a card into position. Around her, four rectangular cards are
laid out floating in two loose columns. Thin lines connect cards in the left
column to cards in the right column, pairing them up.
She holds a large round magnifying glass in her other hand, resting it near one card.
Solid black: her hair and her sweater. White with outline: her trousers, the
cards and the magnifying glass. Cards carry only horizontal ink rules.
MID-GRAY ACCENT: the connector lines between the two columns, and the header bar
of the top-left card.
```

### ⑥ ILL_Service_MarketingStudio — 조립하는 두 사람

```
SCENE 6 of 8. Title: "assembling the layout".

Two figures. On the left, a man standing on tiptoe, reaching up with both hands
to slot a rectangular block into place on a tall vertical layout that floats in
the air like a page under construction. On the right and slightly behind, a
woman stands calmly holding a document at chest height, looking at the layout to
check it.
The tall vertical layout is a thin outlined rectangle containing an image block
and several horizontal ink rules. Two loose blocks wait on the floor nearby.
Solid black: his hair and trousers; her hair and skirt. White with outline:
their tops, the layout, all blocks and the document.
MID-GRAY ACCENT: the image block inside the tall layout, and one of the loose
blocks waiting on the floor.
```

### ⑦ ILL_Future_Connect — 사이를 잇는 구조

```
SCENE 7 of 8. Title: "introduced across the gap".

Three figures spread horizontally with a wide gap in the middle. On the far
left, a woman holding a stack of documents and a card under her arm, turned
toward the right. On the far right, two figures standing together — a man and a
woman — turned toward the left, one of them holding a clipboard.
In the empty space between them floats a small circle, the meeting point.
Dotted lines run from the left figure to the circle, and from the circle to the
right pair. Below the right pair, two empty dotted-outline rectangles wait.
Solid black: the left woman's hair and sweater. The two right figures are drawn
with THIN OUTLINE ONLY and no solid black masses, so they read as lighter and
further away.
MID-GRAY ACCENT: the small circle in the middle, and the dotted line on the
left half only.
```

### ⑧ ILL_CTA_Pilot — 결과를 들고 다음 단계로

```
SCENE 8 of 8. Title: "walking on with the result".

A man mid-stride walking to the right, glancing down at a document he holds open
in one hand. Under his other arm he carries a wide rectangular card. Relaxed,
unhurried, one foot lifted.
A single loose sheet trails in the air behind him.
Solid black: his hair and his coat. White with outline: his trousers, the
document and the card. Both carry only horizontal ink rules and one image block.
MID-GRAY ACCENT: the header bar of the open document, and a small forward arrow
floating ahead of him at knee height.
```

---

## 3. 리터치 프롬프트 (결과가 어긋났을 때)

생성 직후 바로 이어서 보낸다. 새 대화에서 고치려 하면 스타일이 리셋된다.

| 증상 | 붙여넣을 문장 |
|---|---|
| 선이 너무 매끈함 | `Redraw with a more hand-drawn, slightly wobbly pen line. Nothing should look computer-perfect.` |
| 검정 면이 부족 | `Increase the solid black masses. Fill the hair and one garment completely black with no outline. Aim for about 30% of the drawing being flat black.` |
| 얼굴이 과함 | `Simplify the face to only two small dots for eyes. Remove the nose, eyebrows, mouth and any facial detail.` |
| 글자가 들어감 | `Remove all text, letters and numbers. Replace any writing with plain horizontal ink rules.` |
| 배경이 생김 | `Remove the background, ground line and all scenery. The figure and objects must float in pure white space.` |
| 회색이 여러 톤 | `Use exactly one flat mid-gray value for the accent areas only. Everything else must be pure black or pure white.` |
| 캐릭터가 달라 보임 | `Keep the same proportions, line weight and face style as the previous scene. This must look like the same artist drew both.` |
| 손가락 디테일 | `Simplify the hands into mitten shapes. Do not draw individual fingers.` |
| 너무 귀여움 | `Make it more restrained and adult. Editorial, dry, not cute. Remove any childlike or mascot quality.` |

---

## 4. Illustrator Image Trace 설정

`Preset: 3 Colors`에서 시작한 뒤 아래 값으로 맞춘다. **8장 전부 동일한 값**을 써야 선 두께와 질감이 일치한다.

| 항목 | 값 | 이유 |
|---|---|---|
| Mode | `Color` | `Black and White`는 중간회색 accent를 밀어버려 코랄 자리가 사라진다 |
| Palette | `Limited` | Colors 슬라이더 활성화 |
| Colors | `3` | 검정 · 중간회색 · 흰색 |
| Paths | `85%` | 기본 50%는 선을 뭉갠다 |
| Corners | `50%` | 높으면 둥근 선끝에 각이 생긴다 |
| **Noise** | **`1~3 px`** | **기본 25px는 눈 점(15~25px)을 노이즈로 보고 지운다** |
| Method | `Abutting` (왼쪽) | 면이 겹치지 않아 리컬러가 깔끔 |
| Create | Fills ☑ / Strokes ☐ | Strokes는 가변 폭이라 불안정 |
| Shapes | ☐ 해제 | 형태를 도형으로 정규화해 손그림을 왜곡 |
| Snap Curves To Lines | ☐ 해제 | 의도한 선의 흔들림이 직선으로 스냅됨 |
| Ignore Color | ☐ 해제 | 켜면 셔츠·문서 등 내부 흰 면까지 투명해져 배경 원이 비친다 |
| Auto Grouping | ☑ | **색상별로 그룹이 나뉘어 Figma 리컬러가 클릭 2번으로 끝난다** |

트레이스 품질은 설정보다 **원본 해상도**가 더 좌우한다. 최대 해상도 PNG로 받는다. JPEG은 압축 노이즈가 그대로 패스가 된다.

**후처리**
1. `Trace` → **`Expand`** (필수. 안 하면 내부에 원본 래스터를 안고 있는 Tracing Object라 이미지로 취급된다)
2. 바깥 흰 배경 패스 1개만 선택해 삭제 (내부 흰 면은 남긴다)
3. `Object › Artboards › Fit to Artwork Bounds`

---

## 5. SVG 저장 옵션

| 항목 | 값 |
|---|---|
| SVG Profiles | `SVG 1.1` |
| Image Location | `Embed` |
| Preserve Illustrator Editing Capabilities | ☐ 해제 (AI 원본이 통째로 박혀 용량 폭증) |
| **More Options › CSS Properties** | **`Presentation Attributes`** |
| More Options › Decimal Places | `2` |
| More Options › Responsive | ☐ 해제 |

> ⚠️ **CSS Properties가 가장 중요하다.** 기본값 `Style Elements`는 색을 `<style>` 블록의 CSS 클래스로 넣는데, Figma가 이를 놓쳐 **면이 전부 검정으로 들어오거나 색이 날아간다.**

> Windows에서는 Illustrator → Figma 클립보드 복붙이 **비트맵으로 떨어지는 경우가 많다.** SVG 파일로 저장해 캔버스에 드래그하는 경로를 쓴다.

---

## 6. 다크 배경 변형 (⑧ ILL_CTA_Pilot 전용)

Pilot CTA 섹션은 Deep Navy 배경이라 검정 선화를 그대로 올리면 인물이 묻힌다. 장면 프롬프트 ⑧ 끝에 아래를 덧붙여 반전 버전을 뽑는다.

```
IMPORTANT VARIANT: Draw this scene inverted — pure white ink lines and white
solid masses on a pure black background. The accent areas stay mid-gray.
```

**트레이스 전에 Photoshop에서 `Ctrl+I`(Invert)를 먼저 실행한다.** 반전하면 나머지 7장과 구조가 완전히 같아져서 §4 설정·후처리를 그대로 쓸 수 있다. 회색 accent는 반전해도 회색이라 그대로 살아남는다.

반전하지 않고 직접 트레이스하면, 바깥 검정 배경과 인물 내부 검정 면(셔츠·종이 안쪽)이 같은 색이라 한 그룹에 묶인다. 그룹째 지우면 내부 면까지 날아간다.

---

## 7. Figma 반입 · 리컬러

1. `.svg` 파일을 `LP_Assets_Illustrations` 프레임에 드래그
2. **리컬러** — Auto Grouping 덕분에 색상별 그룹을 하나씩 선택해 Fill만 바꾸면 된다

| 패스 색 | 밝은 배경 7장 | 다크 1장 (CTA_Pilot) |
|---|---|---|
| 검정 | `color/text/primary` #182333 | `color/text/on-navy` #FAF8F5 |
| 흰색 | 흰색 유지 | `color/bg/navy` #182333 |
| 중간회색 | `color/brand/coral` #FF6F61 | `color/brand/coral` #FF6F61 |

3. **배경 원 추가** — `#FFF1EE` 타원을 아트 뒤에 Figma에서 직접 그린다 (AI에게 맡기지 않는다)
4. **그룹 분리** — `인물` / `오브젝트` / `배경 원` / `강조색` 4개 그룹으로 나눠 레이어 이름 지정
5. **컴포넌트 교체** — 기존 `ILL_*` 컴포넌트 **안으로 들어가 `art` 노드만** 새 벡터로 교체

> ⚠️ `ILL_*` 컴포넌트를 삭제하면 데스크톱·모바일 페이지에 배치된 인스턴스가 전부 끊긴다. 반드시 내부 `art` 노드만 교체할 것.

> ⚠️ `ILL_*` 컴포넌트를 삭제하면 데스크톱·모바일 페이지의 인스턴스가 전부 끊긴다. 반드시 컴포넌트 안의 `art` 노드만 교체할 것.

---

## 8. 반입 전 체크리스트

- [ ] 8장의 선 두께가 육안으로 동일한가
- [ ] 8장의 머리 크기 : 전신 비율이 동일한가
- [ ] 얼굴에 눈 2점 외에 아무것도 없는가
- [ ] 글자·숫자가 한 글자도 없는가
- [ ] 배경·바닥선·프레임이 없는가
- [ ] 코랄로 바꿀 회색 면적이 전체의 10% 이내인가
- [ ] 악수 장면이 없는가
- [ ] 일본 관광 클리셰(후지산·벚꽃·기모노·부채·도리이)가 없는가
- [ ] 레퍼런스의 특정 캐릭터·구도를 그대로 옮기지 않았는가
- [ ] ⑦ Future_Connect의 우측 인물이 좌측보다 옅게 보이는가 (MVP 이후 표현)
- [ ] 제품 UI보다 일러스트가 더 강하게 보이지 않는가
