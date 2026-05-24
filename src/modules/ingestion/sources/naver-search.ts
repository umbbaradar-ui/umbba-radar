// ============================================
// 네이버 검색 API — 블로그·뉴스 키워드 조회
// 일 25,000건 무료
// ============================================

import "server-only";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

export interface NaverBlogItem {
  title: string;
  description: string;
  link: string;
  blogger_name: string;
  postdate: string; // YYYYMMDD
}

function ensureKeys(): void {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    throw new Error(
      "Missing NAVER_CLIENT_ID or NAVER_CLIENT_SECRET env var"
    );
  }
}

function stripHtmlTags(s: string): string {
  return s
    .replace(/<\/?b>/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchBlog(
  query: string,
  display = 20
): Promise<NaverBlogItem[]> {
  ensureKeys();

  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(
    query
  )}&display=${display}&sort=date`;

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": NAVER_CLIENT_ID!,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET!,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Naver search failed [${res.status}]: ${text}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      title: string;
      description: string;
      link: string;
      bloggername: string;
      postdate: string;
    }>;
  };

  return (data.items ?? []).map((it) => ({
    title: stripHtmlTags(it.title),
    description: stripHtmlTags(it.description),
    link: it.link,
    blogger_name: it.bloggername,
    postdate: it.postdate,
  }));
}
