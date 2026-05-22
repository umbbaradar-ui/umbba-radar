import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // React 19.2 ViewTransition — 페이지 전환 시 공유 요소 모핑
    viewTransition: true,
  },
};

export default nextConfig;
