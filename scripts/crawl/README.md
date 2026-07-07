# scripts/crawl/ — 데이터 수집기

`data/` 레퍼런스 코퍼스를 채우는 수집 스크립트. 헤드리스 브라우저는 Playwright, 나머지는 Node 네이티브.
계획·규칙: [`docs/research/data-collection-plan.md`](../../docs/research/data-collection-plan.md), [`data/README.md`](../../data/README.md).

## 소스별 수집기 & 실측 가능 여부 (2026-07)

| 소스 | 스크립트 | 방식 | 결과 |
|---|---|---|---|
| 라쿠텐 | `rakuten-browser.mjs` / `rakuten.mjs` | 헤드리스 / API | ✅ 썸네일 604 · 상세 313 |
| Amazon JP | `amazon.mjs` | 헤드리스 검색 | ✅ 썸네일 328 (풀해상도) |
| Qoo10 | `qoo10.mjs` | 헤드리스 랭킹 | △ 16 (랭킹 상위만 노출·고품질) |
| @cosme | `cosme.mjs` | 헤드리스 랭킹 | ✅ 68 제품·브랜드명 (SNS 어휘) |
| 렉시콘 빌드 | `build-lexicon.mjs` | 코퍼스 집계 | ✅ 101 용어 |
| Yahoo 쇼핑 | (미구현) | 헤드리스 | △ 가능하나 셀렉터 지저분 |
| TikTok CC | (불가) | — | ✗ 전체 트렌드가 로그인 게이트(비로그인 3개 미리보기만) |
| Instagram | (수작업) | — | ✗ ToS상 스크래핑 불가 → 수작업 큐레이션 |

> 모든 수집기는 같은 `product-catalog.jsonl` 에 저장하며 id 포맷이 달라 소스 간 충돌 없음.
> 사용법: `node scripts/crawl/amazon.mjs [--per-category 80] [--category skincare] [--no-images]`,
> `node scripts/crawl/qoo10.mjs [--target 60]`. 상세 옵션은 각 파일 헤더 주석 참조.

## 두 가지 방식 (둘 다 같은 카탈로그에 저장, id 포맷 동일 → 교차 중복제거)

| 스크립트 | 방식 | 키 | 특징 |
|---|---|---|---|
| `rakuten.mjs` | 공식 API | 필요(무료) | 안정·합법. **권장** |
| `rakuten-browser.mjs` | 헤드리스 브라우저 | 불필요 | 키 없이 즉시. 사이트 변경에 취약·ToS 회색지대 |

> 실측(2026-07): 라쿠텐 검색은 Akamai 봇차단으로 **플레인 HTTP 크롤 불가**(빈 스텁 반환).
> Playwright 헤드리스는 통과됨. Qoo10 재팬은 비브라우저 요청을 523으로 차단.

## A. 라쿠텐 썸네일 — 브라우저 버전 (`rakuten-browser.mjs`, 키 불필요)

### 준비
```bash
npm install            # playwright 설치
npx playwright install chromium
```

### 실행
```bash
node scripts/crawl/rakuten-browser.mjs                                   # 4카테고리 × 150
node scripts/crawl/rakuten-browser.mjs --category skincare --per-category 100
node scripts/crawl/rakuten-browser.mjs --per-category 5 --no-images --headful  # 브라우저 눈으로 확인
```

### 동작 메모
- 실제 UA·JS 렌더링만. **CAPTCHA 우회·핑거프린트 스푸핑은 하지 않음**(설계 원칙).
- 페이지 이동 간 2.5초 딜레이. 썸네일은 600×600으로 업스케일 저장.
- 상품 0개 응답 시 "차단/결과끝"으로 보고 다음 키워드로 넘어감.

## B. 라쿠텐 썸네일 — API 버전 (`rakuten.mjs`, 권장)

### 준비
1. 라쿠텐 앱ID 발급 (무료): https://webservice.rakuten.co.jp/
2. `.env.example` → `.env` 복사 후 `RAKUTEN_APP_ID` 입력.

### 실행
```bash
# 기본: 4개 카테고리 × 각 150개 목표, 썸네일 다운로드 포함
node scripts/crawl/rakuten.mjs

# 특정 카테고리만 (skincare | makeup | suncare | cleansing)
node scripts/crawl/rakuten.mjs --category skincare --per-category 100

# 메타데이터만(이미지 다운로드 생략) — 빠른 스모크 테스트에 유용
node scripts/crawl/rakuten.mjs --per-category 5 --no-images
```

### 산출물
- 이미지 → `data/raw/product-thumbnails/rakuten/` (git 미포함)
- 메타 → `data/processed/product-catalog.jsonl` (append, `id` 기준 중복 제거)

### 동작 메모
- 요청 간 1.2초 딜레이 · 리뷰 많은 순 정렬 · 이미지 있는 상품만.
- 이미지 다운로드 실패는 경고만 남기고 진행(카탈로그 메타데이터는 보존).
- 재실행하면 기존 카탈로그의 `id` 를 읽어 **이미 모은 상품은 건너뜀**.
