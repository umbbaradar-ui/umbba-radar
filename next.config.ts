import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // React 19.2 ViewTransition — 페이지 전환 시 공유 요소 모핑
    viewTransition: true,
    // Server Action body size 제한 (기본 1MB → 10MB)
    // 인스타·HEIC 스크린샷은 종종 5MB 넘김. 5MB 제한이면 silent fail됨
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
