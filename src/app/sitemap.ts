import type { MetadataRoute } from "next";
import { listPosts } from "@/modules/content/service";

// 사이트맵 — 정적 페이지 + DB의 모든 published 카드
// Google·Naver 크롤러가 1회 호출로 전 페이지 발견
// 결과물: https://umbba-radar.com/sitemap.xml
//
// 새 카드 published 되면 다음 revalidate(60s) 후 sitemap에 자동 반영.

const BASE_URL = "https://umbba-radar.com";

// 60초마다 재생성 (메인 페이지와 동일 정책)
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/archive`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/submit`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // 모든 published 카드. listPosts 기본 limit 100 → 사이트맵용은 1000개까지.
  try {
    const posts = await listPosts({ limit: 1000 });
    const now = Date.now();
    const postPages: MetadataRoute.Sitemap = posts.map((post) => {
      // 마감 임박 카드는 우선순위 ↑ (Google 크롤 빈도 올리기)
      const isActive = post.deadline
        ? new Date(post.deadline).getTime() > now
        : true;
      return {
        url: `${BASE_URL}/post/${post.id}`,
        lastModified: new Date(post.updated_at),
        changeFrequency: "daily",
        priority: isActive ? 0.9 : 0.4,
      };
    });
    return [...staticPages, ...postPages];
  } catch (e) {
    // 사이트맵 생성 실패해도 정적 페이지는 살림 (Google 에러 방지)
    console.error("[sitemap] failed to fetch posts:", e);
    return staticPages;
  }
}
