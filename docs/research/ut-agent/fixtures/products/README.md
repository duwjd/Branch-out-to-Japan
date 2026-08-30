---
title: UT용 제품컷 6종 — 출처·라이선스·배정
space: 검증·실험
status: 정본
phase: Phase 0
updated: 2026-08-21
owner:
tags: [UT, 자산, 라이선스]
---

# UT용 제품컷 6종 — 출처·라이선스·배정

> AI 에이전트 UT([../../00-ut-plan.md](../../00-ut-plan.md) §4-3)에서 **썸네일·상세페이지 생성의 편집 원본**으로 쓰는 이미지다.
> 썸네일은 제품 이미지 1장이 필수이고([thumbnail/route.ts](../../../../../app/api/studio/thumbnail/route.ts)), 상세페이지는 제품컷 1장이 별도 필수다([detail/route.ts](../../../../../app/api/studio/detail/route.ts)).

## 라이선스 · 출처

**전부 우리 자산이다.** 외부 저작물을 쓰지 않았다.

| 파일 | 만든 방법 |
|---|---|
| `product-serum.jpg` | [`docs/specs/02-studio/assets/samples/haruon-mock-product.png`](../../../../specs/02-studio/assets/samples/haruon-mock-product.png) 를 1024×1536 JPEG q92로 변환 (2026-08-11 생성 자산 재사용) |
| 나머지 5종 | `gpt-image-2` 로 신규 생성 — [`scripts/ut/make-ut-products.mjs`](../../../../../scripts/ut/make-ut-products.mjs) (2026-08-20) |

**왜 웹에서 받지 않았나.** CC0 스톡에는 *단일 · 무라벨 · 클린 배경* 화장품 컷이 사실상 없다 — Openverse의 CC0 결과는 대부분 빈티지 클립아트이거나, 라벨이 붙은 다중 제품 사진이다. `images.edit` 의 편집 원본은 **제품 하나가 화면 중앙에 서 있고 배경이 비어 있어야** 제대로 동작하고, CC-BY 계열은 변형·재배포 시 귀속 표기가 따라붙어 생성물에 얹기 곤란하다.

**왜 무지(無地) 용기인가.** [`docs/specs/02-studio/assets/README.md`](../../../../specs/02-studio/assets/README.md) 의 원칙을 그대로 승계한다 — 실존 브랜드를 닮지 않게 하고, 이미지 안에 글자를 넣지 않는다(② 파이프라인 negative 1순위). 기존 샘플 `haruon-before.jpg` 는 "실제 K뷰티 제품의 실물 컷"이라 UT 산출물의 원본으로 쓸 수 없다.

## 파일

| id | 파일 | 용기 | 크기 |
|---|---|---|---|
| `serum` | `product-serum.jpg` | 프로스트 글라스 드로퍼 병 (베이지 캡) | 1024×1536 |
| `cream` | `product-cream.jpg` | 넓은 크림 자 (아이보리 몸통 + 베이지 뚜껑) | 1024×1536 |
| `toner` | `product-toner.jpg` | 길쭉한 펌프 병 (반투명 글라스 + 화이트 펌프) | 1024×1536 |
| `tint` | `product-tint.jpg` | 슬림 립틴트 튜브 (코랄-로즈) | 1024×1536 |
| `suncare` | `product-suncare.jpg` | 아이보리 스퀴즈 튜브 (화이트 플립캡) | 1024×1536 |
| `cleansing` | `product-cleansing.jpg` | 그레이-화이트 스퀴즈 튜브 (스크류캡) | 1024×1536 |

전부 라벨·글자·로고가 없고, 인물이 없으며, 배경은 무광 웜그레이 심리스다. 상세 파이프라인의 세로 규격(1024×1536)에 맞춰 두었다 — 썸네일 쪽은 `images.edit` 가 1024×1024로 재구성한다.

## 페르소나 배정

| 제품컷 | 페르소나 |
|---|---|
| `serum` | P03 하루온(병풀 앰플) · P07 베러문(클린·비건) · P11 뮤트원 · P19 플레인(미니멀) |
| `cream` | P01 글로우리프(세라마이드 크림) · P09 오브제스킨 · P13 포레스트미(클린·더마) |
| `toner` | P02 무드바이(수분 토너) · P05 노트원(남성 올인원) · P14 슬로우데이 · P15 루미네(수분·진정) · P18 루트리(더마·두피) · P20 센트리(향·바디) |
| `tint` | P04 셀피지(틴트) · P10 데일리핏(색조) · P12 라라뷰(색조) · P16 타임리스(립·틴트) |
| `suncare` | P17 데이쉴드(선크림) |
| `cleansing` | P06 코튼밤(더마 립·핸드) · P08 리프레쉬랩(각질·클렌징) |

> ⚠ **자극물 한계.** 같은 카테고리의 페르소나는 같은 제품컷을 공유한다. 용기에 브랜드 글자를 넣지 않는 것이 원칙이라 페르소나별 개별화의 실익이 없다. 페르소나가 "내 제품 같지 않다"고 반응하면 `[자극물 한계]` 로 분류하고 **산출물 정확성 점수에서 제외**한다([01-산출물-형식 §2](../../01-산출물-형식.md)).

## 비용 실측 — `usage.json`

생성하면서 OpenAI 응답의 `usage` 를 그대로 기록했다. **이 UT의 이미지 단가 근거다.**

| 호출 | 크기 | 품질 | 입력 토큰 | 출력 토큰 | **실측 USD** |
|---|---|---|---|---|---|
| `images.generate` | 1024×1536 | medium | 텍스트 ~172 | 1372 | **$0.0420** |
| `images.edit` | 1024×1024 | medium | 이미지 1536 + 텍스트 46 | 1756 | **$0.0652** |

단가: 이미지 입력 $8/1M · 텍스트 입력 $5/1M · 출력 $30/1M ([OpenAI API Pricing](https://developers.openai.com/api/docs/pricing), 확인 2026-08-20).

**`images.edit` 가 더 비싸다** — 입력 이미지 토큰(1536)이 붙고, gpt-image-2가 입력을 항상 고정밀로 처리해 출력 토큰(1756)도 generate(1372)보다 많다. 썸네일이 상세 배경컷보다 장당 비싸다는 뜻이다.

**여기까지 실제 지출: 6콜 · $0.275** (제품컷 5장 $0.210 + 썸네일 단가 측정 프로브 1콜 $0.065).

## 다시 만들려면

```bash
node --env-file-if-exists=.env scripts/ut/make-ut-products.mjs            # 없는 것만
node --env-file-if-exists=.env scripts/ut/make-ut-products.mjs --force    # 전부 다시
node --env-file-if-exists=.env scripts/ut/make-ut-products.mjs --only tint,suncare
```
`OPENAI_API_KEY` 가 필요하다. 프롬프트를 바꾸면 결과가 달라지므로, **UT 진행 중에는 다시 굽지 않는다** — 자극물이 바뀌면 앞뒤 페르소나의 결과를 비교할 수 없다.
