import type { MetadataRoute } from "next";

// 검색엔진 크롤링 가이드
// - 공개 페이지(메인, 카드 상세, 아카이브)는 모두 인덱싱 허용
// - 개인화/관리/인증 페이지는 차단 (사용자별 데이터 노출 방지 + 크롤러 낭비 방지)
// 결과물: https://umbba-radar.com/robots.txt
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/auth/",
          "/signup",
          "/signup/",
          "/login",
          "/login/",
          "/me",
          "/my",
        ],
      },
    ],
    sitemap: "https://umbba-radar.com/sitemap.xml",
    host: "https://umbba-radar.com",
  };
}
