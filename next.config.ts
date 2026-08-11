import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 코드가 fs 동적 경로로 읽는 데이터 자산을 서버리스 번들에 강제 포함한다(11 §3).
  // 대상: grounding 근거 3종(lib/engine/grounding) · 썸네일 프롬프트 팩(lib/studio/promptPack)
  //       · 목 모드 샘플 이미지(lib/studio/fixtures — 키 미설정 배포에서도 발동 가능)
  //       · 상세페이지 일본어 폰트(lib/studio/detail/fonts — satori에 Buffer로 직접 넘긴다).
  // ⚠ 폰트를 빼면 배포본에서 파일이 사라지고, satori가 Google Fonts를 런타임 fetch하다
  //    실패해 두부(tofu)가 된다. 트레이싱은 정적 import만 따라가므로 여기에 명시해야 한다.
  // ⚠ data/processed 는 글롭이 아니라 **런타임에 실제로 읽는 파일만** 나열한다.
  //    `data/processed/**` 로 두면 분석용 원자료(detail-ocr.jsonl 1.8MB ·
  //    product-catalog.jsonl 2.1MB · 집계·시드 파일)까지 22개 함수 전부에 딸려 들어간다.
  //    새 런타임 데이터 파일을 추가하면 **여기에도 추가**해야 한다(누락 시 배포본에서 ENOENT).
  outputFileTracingIncludes: {
    "/**": [
      "./data/processed/thumbnail-style-prompts.json", // lib/studio/promptPack.ts
      "./data/processed/detail-style-prompts.json",    // lib/studio/detail/blockPack.ts
      "./data/processed/benchmark-aggregates.json",    // lib/engine/grounding/index.ts
      "./data/processed/regulatory-summary.json",      // lib/engine/grounding/index.ts
      "./data/processed/sns-lexicon.csv",              // lib/engine/grounding/index.ts
      "./docs/specs/02-studio/assets/samples/**",
      "./app/fonts/jp/**",
    ],
  },
};

export default nextConfig;
