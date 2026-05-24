import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // gzip 압축 — Vercel은 기본 활성화지만 명시
  compress: true,
  // Powered-by 헤더 제거 (보안·미세한 대역폭 절감)
  poweredByHeader: false,
  // 이미지 최적화: 외부 호스트(Supabase Storage) 대응 + 차세대 포맷 우선
  images: {
    formats: ["image/avif", "image/webp"],
    // 메인 카드 이미지 사이즈 폭이 좁아서 deviceSizes 축소 → 캐시 효율 ↑
    deviceSizes: [360, 640, 750, 1080, 1200],
    imageSizes: [64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
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
