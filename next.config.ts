import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // React 19.2 ViewTransition — 페이지 전환 시 공유 요소 모핑
    viewTransition: true,
    // 이미지 업로드 Server Action body size 제한 (기본 1MB → 5MB)
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
