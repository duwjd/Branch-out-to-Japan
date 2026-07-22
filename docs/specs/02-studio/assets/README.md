# ② 스튜디오 프로토타입 이미지 자산 — 출처·라이선스

비배포 · 기획 검토용 프로토타입에서만 쓴다. 제품 UI 반영은 별도 결정이다.
전부 `scripts/build-studio-assets.mjs` 로 재생성된다 — 이 폴더를 지우고 스크립트를 다시 돌리면 동일한 산출이 나온다.

성격이 다른 두 묶음이므로 **화면에서도 라벨로 구분한다**. `templates/` 는 "실측 참고", `samples/` 는 "생성 결과"다.

## `templates/` — 실측 참고 컷 8종 (타사 저작물 · 인용)

템플릿 선택 카드(CREATE-04)·빈 상태 스트립(HOME-03)의 프리뷰. **우리 생성물이 아니라 시장에서 수집한 실물**이며, 8종 문법이 실제로 어떤 화면인지 보여주려고 쓴다.

출처·원 URL 정본은 [`../../01-report/assets/README.md`](../../01-report/assets/README.md) 의 `market/` 표다. 여기 있는 파일은 그 원본을 800×800으로 정규화한 사본이고, 분류 정본은 [`../../../research/jp-thumbnail-style-taxonomy.md`](../../../research/jp-thumbnail-style-taxonomy.md) 이다.

| 파일 | 원본 | 스타일 |
|---|---|---|
| `01-clean.jpg` | `thumb-A_amazon_B0BT99BF83.jpg` | 클린 스튜디오 단독컷 |
| `02-texture.jpg` | `thumb-B_amazon_B0BY8NVDX5.jpg` | 제품+텍스처 스와치 |
| `03-official.jpg` | `thumb-C_rakuten_aestura-japan_atobarrier365cream.jpg` | 공식샵 신뢰 배지형 |
| `04-copy-ingredient.jpg` | `thumb-D_rakuten_kiso_kiso-k47.jpg` | 캐치카피+성분 비주얼형 |
| `05-award.jpg` | `thumb-E_rakuten_tvert_352.jpg` | 수상 실적 스택형 |
| `06-model.jpg` | `thumb-F_rakuten_norm-plus_nm1007-f.jpg` | 모델+카피형 |
| `07-promo.jpg` | `thumb-G_qoo10_8365200734.jpg` | 프로모션 강조형 |
| `08-premium.jpg` | `thumb-H_rakuten_attenir_132551.jpg` | 프리미엄 무드형 |

**사용 조건** (①의 원칙을 그대로 승계한다)

1. 분석·비평 목적의 **소량 인용**만 한다. 원본 재배포·장식 목적 사용 금지.
2. 화면에 **"실측 참고" 라벨**을 붙여 생성 결과와 구분한다. 출처 플랫폼은 카드 메타에 병기한다.
3. 제품(실서비스 UI)에 그대로 싣지 않는다 — 싣는다면 **별도 법무 검토** 후 결정한다.
4. ⚠ `06-model.jpg` 는 **인물이 포함**되어 초상권 리스크가 별도로 있다. 제품 반영 검토 시 우선 교체 대상이다. (2026-07-22 개정으로 해당 템플릿의 생성 잠금은 풀렸지만, 이 파일은 여전히 **타사 실측 참고 컷**이다 — 생성 입력으로 쓰는 모델컷은 브랜드가 직접 업로드한 보유컷이며 사용 권한 동의를 받는다. 카드 프리뷰용 인용과 혼동하지 않는다.)

## `samples/` — HARUON 데모 생성물 8장 (우리 자산)

갤러리 카드(HOME-02)·결과 이미지(RESULT-01)·업로드 프리뷰(CREATE-02)에 쓴다. **"우리가 생성한 결과물" 자리이므로 실측 참고 컷을 쓰지 않는다.**

`docs/presentation/샘플.png`(일본향 재설계 실물)와 `docs/presentation/샘플원본.webp`(그 KR 원본)에서 파생했다. 원본에서 오버레이(좌상단 브랜드 칩·하단 스펙 칩)를 지운 클린 베이스를 만들고, 그 위에 문법별 오버레이를 얹어 1024×1024로 구운 것이다.

| 파일 | 스타일 | 비고 |
|---|---|---|
| `haruon-clean.png` | 클린 스튜디오 단독컷 | 배경을 스튜디오 화이트로 |
| `haruon-texture.png` | 제품+텍스처 스와치 | 무텍스트 + 제형 스와치 |
| `haruon-official.png` | 공식샵 신뢰 배지형 | 원본 구성 유지 + 브랜드 칩만 HARUON |
| `haruon-copy-ingredient.png` | 캐치카피+성분 비주얼형 | 대형 JP 카피 + 성분 비주얼 + 조건 각주 |
| `haruon-award.png` | 수상 실적 스택형 | 실적 배지 스택. 문구는 생성 폼의 실적 3필드 예시 그대로 |
| `haruon-promo.png` | 프로모션 강조형 | 세트 밴드 + GIFT + 가격 패널 |
| `haruon-premium.png` | 프리미엄 무드형 | 시네마틱 어두운 연출 + 세로쓰기 카피 |
| `haruon-before.jpg` | (원본) | KR 원본(Before). 업로드 프리뷰·생성중 블러에도 공용 |

모델+카피형은 아직 샘플이 없다. 구 사유(모델컷 업로드 미지원으로 생성 자체가 잠김)는 2026-07-22 개정으로 해소됐고, **2차 개발(09-dev-spec M10) 때 목 샘플 `haruon-model.png`을 추가**한다 — 그 전까지는 목 모드에서 `haruon-clean.png`로 폴백한다. 샘플용 모델은 실존 인물 사진이 아닌 것으로 준비한다(데모 자산도 초상권 원칙을 따른다).

- **일본어 카피는 새로 짓지 않았다.** 프로토타입에 이미 있던 문자열(스펙 §3 골든 픽스처 치환분)을 그대로 옮겼다.
- **제품컷 자체는 실제 K뷰티 제품의 실물 컷**이다. 가상 브랜드 HARUON은 오버레이 칩 표기에만 쓴다 — 결과 화면에 이 사실을 1줄로 고지한다.
