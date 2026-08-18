import type { NextConfig } from "next";

/**
 * 상세페이지 satori 렌더용 일본어 폰트(9.2MB).
 * 소비처는 lib/studio/detail/fonts.ts → render.tsx(블록 래스터화) · detailReadiness.ts(사전 점검)뿐이고,
 * 그 둘을 타는 라우트는 아래 두 트리로 한정된다.
 * ⚠ 빼면 배포본에서 파일이 사라지고 satori가 Google Fonts를 런타임 fetch하다 실패해 두부(tofu)가 된다.
 */
const JP_FONTS = ["./app/fonts/jp/**"];

/**
 * 썸네일 목 모드 샘플 — 키 미설정 배포에서만 발동한다(lib/studio/fixtures.ts:mockImageBuffer).
 * MOCK_IMAGE_BY_STYLE 이 실제로 읽는 7장만 나열한다. 같은 폴더의 haruon-before.jpg ·
 * haruon-mock-product.png(1.8MB)는 CLI 스크립트 전용이라 배포본에 필요 없다.
 * 스타일→파일 매핑을 바꾸면 여기도 함께 고친다(누락 시 목 모드에서 ENOENT).
 */
const MOCK_THUMBNAIL_SAMPLES = [
  "./docs/specs/02-studio/assets/samples/haruon-clean.png",
  "./docs/specs/02-studio/assets/samples/haruon-texture.png",
  "./docs/specs/02-studio/assets/samples/haruon-official.png",
  "./docs/specs/02-studio/assets/samples/haruon-copy-ingredient.png",
  "./docs/specs/02-studio/assets/samples/haruon-award.png",
  "./docs/specs/02-studio/assets/samples/haruon-promo.png",
  "./docs/specs/02-studio/assets/samples/haruon-premium.png",
];

const nextConfig: NextConfig = {
  // 서버 코드가 fs 동적 경로로 읽는 데이터 자산을 서버리스 번들에 강제 포함한다(11 §3).
  // 트레이싱은 정적 import만 따라가므로 fs 동적 경로는 여기에 명시해야 한다.
  //
  // ⚠ 키는 **필요한 라우트로 좁힌다**. `"/**"` 하나에 몰면 모든 함수(46개)에 전부 복사되어
  //    /api/auth/logout·/login·/lp 까지 JP 폰트 9.2MB + 샘플 7.4MB를 들고 배포된다.
  //    번들 크기는 곧 콜드스타트 시간이라, 상세페이지와 무관한 전 페이지가 함께 느려진다.
  // ⚠ data/processed 는 글롭이 아니라 **런타임에 실제로 읽는 파일만** 나열한다.
  //    `data/processed/**` 로 두면 분석용 원자료(detail-ocr.jsonl 1.8MB ·
  //    product-catalog.jsonl 2.1MB · 집계·시드 파일)까지 딸려 들어간다.
  //    새 런타임 데이터 파일을 추가하면 **여기에도 추가**해야 한다(누락 시 배포본에서 ENOENT).
  outputFileTracingIncludes: {
    // 전 라우트 공통 — 합계 약 107KB. grounding·프롬프트 팩은 어느 경로에서든 닿을 수 있다.
    "/**": [
      "./data/processed/thumbnail-style-prompts.json", // lib/studio/promptPack.ts
      "./data/processed/detail-style-prompts.json",    // lib/studio/detail/blockPack.ts
      "./data/processed/benchmark-aggregates.json",    // lib/engine/grounding/index.ts
      "./data/processed/regulatory-summary.json",      // lib/engine/grounding/index.ts
      "./data/processed/sns-lexicon.csv",              // lib/engine/grounding/index.ts
    ],
    // ② 상세페이지 — 폼 진입(readiness 점검)·생성·블록 재생성이 satori를 탄다
    "/app/studio/detail": JP_FONTS,
    "/app/studio/detail/**": JP_FONTS,
    "/api/studio/detail": JP_FONTS,
    "/api/studio/detail/**": JP_FONTS,
    // ② 썸네일 — 목 모드 이미지 생성(lib/studio/imageGen.ts)
    "/api/studio/thumbnail": MOCK_THUMBNAIL_SAMPLES,
    "/api/studio/thumbnail/**": MOCK_THUMBNAIL_SAMPLES,
  },
};

export default nextConfig;
