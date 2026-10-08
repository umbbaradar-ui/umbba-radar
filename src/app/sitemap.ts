import type { MetadataRoute } from "next";
import { listPosts } from "@/modules/content/service";
import { listGuideLinks } from "@/modules/guide/service";

// 사이트맵 — 정적 페이지 + DB의 모든 published 카드
// Google·Naver 크롤러가 1회 호출로 전 페이지 발견
// 결과물: https://umbba-radar.com/sitemap.xml
//
// 매 요청마다 DB에서 새로 만든다(force-dynamic) — 새 카드가 발행되는 즉시 반영.

const BASE_URL = "https://umbba-radar.com";

// ISR(revalidate = 60)은 2026-10-07 08:08 KST 이후 재생성이 멈춰 Vercel 캐시가 36시간 넘게
// 옛 목록(카드 184)을 내보냈다(x-vercel-cache: HIT, age 129,543s). 같은 시각 /·/explore는 정상.
// 사이트맵은 크롤러만 가끔 부르고 카드가 수백 건이라 매 요청 조회 비용이 작다 → 캐시를 쓰지 않는다.
export const dynamic = "force-dynamic";

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
      url: `${BASE_URL}/guide`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
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

  // 시기별 가이드 — 코드에 들어 있는 정적 글이라 DB 실패와 무관하게 항상 포함.
  // lastModified = 원고의 최종 확인일(내용을 다시 확인한 날).
  for (const g of listGuideLinks()) {
    staticPages.push({
      url: `${BASE_URL}/guide/${g.slug}`,
      lastModified: new Date(`${g.checkedAt}T00:00:00+09:00`),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  // published 카드. listPosts는 limit 미지정 시 전량 로드 — 사이트맵은 1000개 상한 유지.
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
