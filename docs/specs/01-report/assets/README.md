# 와이어프레임 이미지 자산 — 출처·라이선스

비배포 · 기획 검토용 와이어프레임에서만 쓰는 자산이다. 제품(ReportView) 사용 여부는 별도 결정.

## 원칙 (2026-07-18 개정)

1. 데코 이미지는 판정·증거처럼 읽히지 않는 자리(페르소나·무드)에만 쓴다. 감사·점수 영역에는 데이터 시각화(SVG·CSS)만 쓴다 — 증거 원칙.
2. **시장 브리핑(1장)에 한해 실측 시장 이미지를 "인용 증거"로 허용한다.** 조건:
   - 출처(플랫폼·상품·원 URL)와 수집일을 캡션으로 **반드시 병기**한다 (`.img-cite`).
   - 분석·비평 목적의 **소량 인용**만 한다. 원본 재배포·장식 목적 사용 금지.
   - 원본은 `data/raw/`(gitignore·내부 분석용)에 있고, 여기 있는 것은 와이어프레임 검토용 선별 사본이다.
   - 제품(ReportView)에 실을지는 **별도 법무 검토** 후 결정한다 (`index.html` 미결정표 참조).
   - 인물이 포함된 컷(모델 카피형 등)은 초상권 리스크가 별도로 있다 — 제품 반영 검토 시 우선 교체 대상.

## 자산 목록

### 공용

| 파일 | 용도 | 출처 | 라이선스 |
|---|---|---|---|
| `persona-nao.svg` | 3-report.html 블록 2 페르소나 아바타(가상 인물 "나오" 표지용 일러스트) | [DiceBear](https://dicebear.com) `open-peeps` 스타일 (원작: Pablo Stanley, [Open Peeps](https://openpeeps.com)) — 시드 `nao-yuragi`로 결정적 생성 | **CC0 1.0** (Open Peeps) · DiceBear API 생성물 |

### `market/` — 썸네일 스타일 8종 대표 + KR 반면교사 (시장 브리핑 갤러리)

분류 정본: `docs/research/jp-thumbnail-style-taxonomy.md`. 전부 2026-07-07 수집, 브랜드/셀러 저작물 — 내부 분석용 인용.

| 파일 | 스타일 | 플랫폼·상품 | 원 URL |
|---|---|---|---|
| `thumb-A_amazon_B0BT99BF83.jpg` | A 클린 스튜디오 단독컷 | Amazon JP · キュレル(Curél) 潤浸保湿 UVエッセンス | https://www.amazon.co.jp/dp/B0BT99BF83 |
| `thumb-B_amazon_B0BY8NVDX5.jpg` | B 제품+텍스처 스와치 | Amazon JP · Laka フルーティーグラムティント | https://www.amazon.co.jp/dp/B0BY8NVDX5 |
| `thumb-C_rakuten_aestura-japan_atobarrier365cream.jpg` | C 공식샵 신뢰 배지형 | 라쿠텐 · AESTURA アトバリア365クリーム (K뷰티 모범 현지화) | https://item.rakuten.co.jp/aestura-japan/atobarrier365cream/ |
| `thumb-D_rakuten_kiso_kiso-k47.jpg` | D 캐치카피+성분 비주얼형 | 라쿠텐 · KISO CARE ヒト幹細胞培養液エキス 15％配合 | https://item.rakuten.co.jp/kiso/kiso-k47/ |
| `thumb-E_rakuten_tvert_352.jpg` | E 수상 실적 스택형 | 라쿠텐 · TOUT VERT バランシングGAローション | https://item.rakuten.co.jp/tvert/352/ |
| `thumb-F_rakuten_norm-plus_nm1007-f.jpg` | F 모델+카피형 (⚠ 인물 포함 — 초상권 유의) | 라쿠텐 · norm+ トーンアップUVエッセンシャル | https://item.rakuten.co.jp/norm-plus/nm1007-f/ |
| `thumb-G_qoo10_8365200734.jpg` | G 프로모션 강조형 | Qoo10 · numbuzin 미용액 세트 (K뷰티 프로모 문법의 일본어판) | https://www.qoo10.jp/item/1188351647 |
| `thumb-H_rakuten_attenir_132551.jpg` | H 프리미엄 무드형 | 라쿠텐 · アテニア スキンアップニュアンサー | https://item.rakuten.co.jp/attenir/132551/ |
| `thumb-KR_amazon_B0BYHXVPW4.jpg` | KR 반면교사 — 한국어 박스 카피가 그대로 노출 | Amazon JP · Dr.G R.E.D BLEMISH クリーム | https://www.amazon.co.jp/dp/B0BYHXVPW4 |

### `detail/` — 상세페이지 메시지 관례 4패턴 실물 컷 (시장 브리핑 패턴 카드)

분류 정본: `docs/research/jp-detail-message-patterns.md` §2·§4 (A~E 루브릭). OCR 코퍼스 `data/processed/detail-ocr.jsonl`에서 시그니처 문구로 역추적한 단일 세그먼트. 전부 라쿠텐, 2026-07-07~08 수집.

| 파일 | 관례(루브릭) | 상품 · 보이는 것 | 원 URL |
|---|---|---|---|
| `pattern-trust_fujifilm_8.jpg` | A1 근거 라벨 + A2 조건 각주 | アスタリフト(FUJIFILM) — 「効能評価試験済み」+「＊朝と夜お使いの場合」 | https://item.rakuten.co.jp/fujifilm-h/16503511/ |
| `pattern-story_macchialabel_8.jpg` | C1~C2 서사 구조 | マキアレイベル — 「こんな経験していませんか？」→원인→도식→기전, ※각주 한정 | https://item.rakuten.co.jp/macchialabel/300252/ |
| `pattern-quant_manyo_4.jpg` | D3 정량 시각화 + C3 즉단정 회피 | 마녀공장(manyo) — 「ブラックヘッド58%洗浄」그래프 + 임상기관·기간·n수·個人差 각주 (K뷰티 모범) | https://item.rakuten.co.jp/manyo-official/ma127/ |
| `pattern-thirdparty_tvert_1.jpg` | A4 제3자 지표 | TOUT VERT — 랭킹 1位 4주 스택 + 「集計日」명기 + レビュー(2,375件) | https://item.rakuten.co.jp/tvert/352/ |
| `pattern-free_fancl_4.jpg` | B1~B2 무첨가·프리 처방 | FANCL エンリッチプラス — 프리 처방 5종 원형 배지(防腐剤·合成香料·合成色素·石油系界面活性剤·紫外線吸収剤) | https://item.rakuten.co.jp/fancl-shop/3762-21/ |
