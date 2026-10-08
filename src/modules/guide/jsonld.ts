// ============================================
// 가이드 JSON-LD — Article(+citation) · FAQPage · BreadcrumbList
// 직렬화 시 "<" 를 \u003c 로 바꿔 <script> 조기 종료(XSS)를 막는다 (Next json-ld 가이드 권고).
// ============================================

import { GUIDE_SITE_URL, guideDateIso } from "./constants";
import { plainText } from "./inline";
import type { Guide, GuideLink } from "./types";

const PUBLISHER = {
  "@type": "Organization",
  name: "엄빠레이더",
  url: GUIDE_SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${GUIDE_SITE_URL}/icons/icon-512.png`,
  },
};

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function guideArticleJsonLd(guide: Guide) {
  const url = `${GUIDE_SITE_URL}/guide/${guide.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: "ko-KR",
    url,
    mainEntityOfPage: url,
    image: [`${GUIDE_SITE_URL}/feature-graphic.png`],
    datePublished: guideDateIso(guide.publishedAt),
    dateModified: guideDateIso(guide.checkedAt),
    author: PUBLISHER,
    publisher: PUBLISHER,
    isAccessibleForFree: true,
    keywords: [guide.targetQuery, ...guide.keywords].join(", "),
    abstract: guide.summary.map(plainText).join(" "),
    citation: guide.sources.map((s) => ({
      "@type": "CreativeWork",
      name: s.title,
      url: s.url,
      publisher: { "@type": "Organization", name: s.org },
    })),
  };
}

export function guideFaqJsonLd(guide: Guide) {
  if (guide.faq.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: plainText(f.a) },
    })),
  };
}

export function guideBreadcrumbJsonLd(guide?: Pick<Guide, "slug" | "title">) {
  const items = [
    { name: "엄빠레이더", url: `${GUIDE_SITE_URL}/` },
    { name: "시기별 가이드", url: `${GUIDE_SITE_URL}/guide` },
  ];
  if (guide) {
    items.push({ name: guide.title, url: `${GUIDE_SITE_URL}/guide/${guide.slug}` });
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function guideListJsonLd(guides: GuideLink[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "엄빠레이더 시기별 가이드",
    itemListElement: guides.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.title,
      url: `${GUIDE_SITE_URL}/guide/${g.slug}`,
    })),
  };
}
