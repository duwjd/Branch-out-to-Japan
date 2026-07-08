# data/ — 일본 시장 레퍼런스 데이터셋

일본 화장품 쇼핑몰·SNS에서 수집한 **내부 분석용 레퍼런스 코퍼스**.
목적: 일본 고객 관점의 비주얼·메시지 관례를 파악해 진단 리포트/스튜디오 카피 설계에 활용.

> ⚠️ **용도 제한**: 여기 모인 이미지·문구는 **팀 내부 분석·학습용**이다.
> 브랜드/셀러 저작물이므로 **완성 서비스·마케팅물에 원본 그대로 재배포·삽입 금지**.
> 산출물에 넣을 때는 우리가 새로 제작한 것으로 대체한다 (CLAUDE.md 금지 포지션과 동일 원칙).

## 폴더 구조
```
data/
├── raw/                         # 원본 크롤 결과 (이미지는 .gitignore — 커밋 안 함)
│   ├── product-thumbnails/      # 제품 썸네일  (rakuten / qoo10 / amazon-jp / yahoo-shopping)
│   ├── product-detail/          # 상세페이지 이미지 (rakuten / qoo10 / amazon-jp)
│   └── sns-copy/                # SNS 문구·유행어 (tiktok / cosme / instagram-manual)
└── processed/                   # 정제·라벨링 산출물 (커밋함)
    ├── product-catalog.jsonl    # 제품 이미지 메타데이터 카탈로그
    ├── sns-lexicon.csv          # 일본 뷰티 유행어/문구 사전
    ├── thumbnail-style-labels.jsonl   # 썸네일 스타일 라벨 (층화 표본 120장)
    └── thumbnail-style-prompts.json   # KR→JP 썸네일 변환 프롬프트 팩 (GPT Image 2.0)
```

## 수집 규칙 (전 소스 공통)
1. **공식 API 우선.** 스크래핑은 API가 없을 때만. (라쿠텐·야후쇼핑은 공식 API 존재)
2. **robots.txt 준수 + rate limit.** 요청 간 최소 1~2초 딜레이, 동시요청 1~2개, 식별 가능한 User-Agent.
3. **개인정보 최소화.** SNS 계정 핸들·이름 등 PII는 저장하지 않는다 (문구·해시태그·단어만).
4. **출처·수집일 기록 필수.** 모든 항목에 sourceUrl / collectedAt / license 메모.
5. **원본 이미지는 git에 넣지 않는다** (`.gitignore` 처리). 공유는 메타데이터 매니페스트로.

## 매니페스트 스키마

### product-catalog.jsonl (한 줄 = 이미지 1건)
```json
{
  "id": "rakuten_00123",
  "source": "rakuten",
  "type": "thumbnail",              // thumbnail | detail
  "productName": "商品名",
  "brand": "ブランド名",
  "category": "스킨케어|색조|선케어|...",
  "price": 1980,
  "sourceUrl": "https://item.rakuten.co.jp/...",
  "imageUrl": "https://thumbnail.image.rakuten.co.jp/...",
  "localPath": "raw/product-thumbnails/rakuten/rakuten_00123.jpg",
  "collectedAt": "2026-07-08",
  "license": "브랜드/셀러 저작물 — 내부 분석용"
}
```

### sns-lexicon.csv
```
term,reading,source,category,exampleContext,frequency,collectedAt
毛穴,けあな,cosme,피부고민,"毛穴の黒ずみが気になる",高,2026-07-08
```

### thumbnail-style-labels.jsonl (한 줄 = 썸네일 1건)
층화 표본 120장(라쿠텐 70 · 아마존 34 · Qoo10 16)의 스타일 라벨. `id`는 product-catalog.jsonl 참조.
스타일 정의·경계 규칙: `docs/research/jp-thumbnail-style-taxonomy.md`.
```json
{
  "id": "rakuten_tvert_352",
  "source": "rakuten",
  "category": "skincare",
  "styleCategory": "E",             // A~H | noise
  "styleSignals": ["awardRibbonStack", "whiteProduct"],
  "isNoise": false,
  "notes": "라벨 근거 메모 (한국어)"
}
```

### thumbnail-style-prompts.json
KR 썸네일/제품컷 → 일본향 썸네일 변환용 **GPT Image 2.0 프롬프트 팩** (스타일 A~H, 카테고리별 1개).
`{{slot}}` 치환 후 사용. 실적 배지 슬롯은 `requiresProof: true` — 근거 미입력 시 해당 문단 제거가 기본값(경품표시법 가드).
일본어 카피 슬롯은 jp-localizer 산출물만 주입한다.
조립 절차·API 호출·워크드 예시: `docs/specs/02-thumbnail-converter-spec.md` (파이프라인 스펙).
