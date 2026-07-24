import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 코드가 fs 동적 경로로 읽는 데이터 자산을 서버리스 번들에 강제 포함한다(11 §3).
  // 대상: grounding 근거 3종(lib/engine/grounding) · 썸네일 프롬프트 팩(lib/studio/promptPack)
  //       · 목 모드 샘플 이미지(lib/studio/fixtures — 키 미설정 배포에서도 발동 가능).
  outputFileTracingIncludes: {
    "/**": ["./data/processed/**", "./docs/specs/02-studio/assets/samples/**"],
  },
};

export default nextConfig;
