# 데이터 수집 계획 — 일본 시장 레퍼런스 코퍼스

작성일: 2026-07-08 · 저장 위치: `data/` · 관련: `docs/research/beautyContent/`

## 목표
서비스 런칭에 필요한 3종 데이터를 **내부 분석용 레퍼런스**로 수집한다.
① 제품 썸네일 · ② 상세페이지 이미지 · ③ SNS 유행어/뷰티 문구.
→ 일본 고객 관점의 **비주얼·메시지 관례**를 도출해 진단 리포트·스튜디오 카피 설계의 근거로 쓴다.

## 원칙 (요약)
- **공식 API 우선**, 스크래핑은 최후수단. robots.txt·rate limit 준수. PII 미수집.
- 수집물은 **내부 분석용** — 완성물에 원본 재배포 금지 (`data/README.md` 참조).

---

## ① 제품 썸네일 — `data/raw/product-thumbnails/`

> **직접 크롤링 실측(2026-07):** 라쿠텐 검색은 Akamai 봇차단으로 플레인 HTTP 크롤 불가(빈 스텁).
> **Playwright 헤드리스는 통과** → `scripts/crawl/rakuten-browser.mjs` (키 불필요, 600×600 저장). Qoo10은 523 차단.

| 소스 | 방법 | 수집 결과 | 비고 |
|---|---|---|---|
| **라쿠텐 이치바** | 헤드리스(`rakuten-browser.mjs`) / API(`rakuten.mjs`) | ✅ 썸네일 604 · 상세 313 | API가 안정·권장, 브라우저는 키 불필요 |
| **Amazon JP** | 헤드리스 검색(`amazon.mjs`) | ✅ 썸네일 328 (풀해상도) | 봇차단 없이 통과. 가격은 로케일 의존이라 미신뢰 |
| Qoo10 재팬 | 헤드리스 랭킹(`qoo10.mjs`) | △ 16 (고품질) | 페르소나 주력 채널. 랭킹 상위만 노출(탭 XHR)돼 수량 제한 |
| 야후! 쇼핑 | 헤드리스 | ⏳ 미구현 | 렌더 O, 셀렉터 obfuscated·lazy-load라 공수 필요 |
| 아마존 PA-API | 공식 API | 대안 | 제휴계정 필요. 헤드리스로 충분해 보류 |

**수집 파라미터 (제안):** 카테고리 = 스킨케어/색조/선케어/클렌징 등, 인기순 상위 N개(카테고리당 100~200), 키워드 = `化粧水`, `美容液`, `日焼け止め`, `ティント` 등.
**산출물:** 이미지 → 폴더, 메타 → `data/processed/product-catalog.jsonl` (type=`thumbnail`).
**분석 산출물(2026-07-08):** 스타일 분류 체계 → `docs/research/jp-thumbnail-style-taxonomy.md` · 스타일 라벨 120장 → `data/processed/thumbnail-style-labels.jsonl` · KR→JP 변환 프롬프트 팩 → `data/processed/thumbnail-style-prompts.json`.

## ② 상세페이지 이미지 — `data/raw/product-detail/`

상세 이미지는 API로 잘 안 나옴 → **상품 URL 확보(①의 sourceUrl) 후 상세페이지 내 이미지 추출** 흐름.

1. ①에서 모은 `sourceUrl` 리스트를 입력으로 사용.
2. 각 상세페이지 방문 → 본문 영역 이미지(`<img>`) 추출, 광고/UI 아이콘 필터링.
3. 라쿠텐 상세는 셀러가 만든 긴 이미지(소구 카피 포함)가 핵심 — **일본향 메시지 관례 분석에 가장 값짐**.

**주의:** 저속(1~2초 딜레이)·소량 우선. 분석 목적상 브랜드당 대표 1~3개면 충분.
**산출물:** 이미지 → 폴더, 메타 → `product-catalog.jsonl` (type=`detail`).
**OCR 텍스트 레이어:** 상세 이미지는 `ocr-detail.mjs`(Claude 비전 + Batch API)로 일본어 텍스트화 →
`data/processed/detail-ocr.jsonl`(rawText·appeals·ingredients·trustBadges). 상품명이 아닌 **실제 소구 문장**이
①(카피 갭 진단)·②(생성 grounding)·렉시콘의 핵심 코퍼스가 됨.

## ③ SNS 유행어/뷰티 문구 — `data/raw/sns-copy/`

> Instagram·X는 스크래핑이 ToS 위반. **공식·공개 소스 + 수작업 큐레이션**으로 우회.

| 소스 | 얻는 것 | 방법 |
|---|---|---|
| **TikTok Creative Center** | 일본 인기 해시태그·키워드·트렌드 (공식·무료·공개) | 웹에서 지역=Japan, 카테고리=Beauty 조회 → 표로 정리 |
| **@cosme** | 실제 일본어 뷰티 어휘(피부고민·질감·성분 표현), 랭킹 | 리뷰/랭킹 텍스트 마이닝 (저속) |
| Google/Yahoo Japan 트렌드 | 검색 유행어 | 공개 트렌드 페이지 |
| Instagram (수동) | 해시태그·캡션 관용구 | 공개 게시물 **수작업** 수집 (핸들 등 PII 제외) |

**산출물:** 원본 텍스트 → `data/raw/sns-copy/<소스>/`, 정제 사전 → `data/processed/sns-lexicon.csv`.
정제 시 `jp-localizer` 관점으로 **카테고리(피부고민·소구·질감·성분·감정어)** 태깅.

---

## 실행 순서 (제안)
1. **라쿠텐 API 수집기** 먼저 구축 (합법·즉시·풍부) → 썸네일 + sourceUrl 확보 → `product-catalog.jsonl` 시드.
2. sourceUrl 기반 **상세 이미지 추출기** (저속).
3. **TikTok Creative Center + @cosme**로 SNS 렉시콘 1차 축적 → `sns-lexicon.csv`.
4. Qoo10/아마존은 필요 범위만 보강. 각 단계 후 `jp-localizer`가 인사이트 도출.

## 기술 메모
- 수집 스크립트는 `scripts/crawl/` (신설 예정)에 둔다. Node/TS 기반, 로거 유틸 사용(`console.log` 금지).
- 시크릿(API 앱ID 등)은 `.env`에 (`.gitignore` 이미 처리됨). `.env.example`에 키 이름만 문서화.
- 재현성: 각 수집기는 `collectedAt`·`sourceUrl`·요청 파라미터를 매니페스트에 남긴다.

## 열린 질문
- 각 카테고리당 목표 수량? (초기 제안: 썸네일 카테고리당 100~200, 상세 브랜드당 1~3)
- 상세 이미지 OCR로 카피 텍스트까지 추출할지? (일본향 메시지 분석엔 강력하지만 공수 큼)
