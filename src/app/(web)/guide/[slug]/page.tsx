// ============================================
// /guide/[slug] — 시기별 가이드 상세
//
// 구성(GEO 순서): 질문형 H1 → 최종 확인일 → 3줄 답 → 본문 → 자주 묻는 질문
//                → 공식 출처·확인일 → 이 시기 진행 중인 혜택(카드 위젯) → 함께 볼 가이드
// 데이터: src/modules/guide/content (원고 md → guide_build.py 생성). DB 없음.
// generateStaticParams 로 slug 목록을 고정하고(dynamicParams=false) 모르는 slug 는 404.
// (web) 레이아웃이 로그인 쿠키를 읽어 실제 렌더는 요청 시점(ƒ)이다 — HTML 은 서버에서 완성돼 나간다.
// ============================================

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { STAGE_LABELS } from "@/shared/types/post";
import {
  GUIDE_CATEGORY_LABELS,
  formatGuideDate,
  guideDateIso,
} from "@/modules/guide/constants";
import { plainText } from "@/modules/guide/inline";
import {
  guideArticleJsonLd,
  guideBreadcrumbJsonLd,
  guideFaqJsonLd,
  serializeJsonLd,
} from "@/modules/guide/jsonld";
import {
  getGuide,
  getRelatedGuides,
  listGuideLinks,
} from "@/modules/guide/service";
import { GuideBody } from "@/modules/guide/ui/GuideBody";
import {
  GuideBenefits,
  GuideBenefitsSkeleton,
} from "@/modules/guide/ui/GuideBenefits";
import { Inline } from "@/modules/guide/ui/Inline";

export const dynamicParams = false;

export function generateStaticParams() {
  return listGuideLinks().map((g) => ({ slug: g.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    return { title: "가이드를 찾을 수 없어요", robots: { index: false, follow: false } };
  }
  const title = `${guide.title} · 엄빠레이더`;
  const url = `/guide/${guide.slug}`;
  return {
    title,
    description: guide.description,
    keywords: [guide.targetQuery, ...guide.keywords],
    alternates: { canonical: url },
    openGraph: {
      title,
      description: guide.description,
      url,
      siteName: "엄빠레이더",
      locale: "ko_KR",
      type: "article",
      publishedTime: guideDateIso(guide.publishedAt),
      modifiedTime: guideDateIso(guide.checkedAt),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: guide.description,
    },
  };
}

export default async function GuideDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const sections = guide.body.filter(
    (b): b is Extract<typeof b, { type: "h2" }> => b.type === "h2"
  );
  const related = getRelatedGuides(guide);
  const faqLd = guideFaqJsonLd(guide);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(guideArticleJsonLd(guide)) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(guideBreadcrumbJsonLd(guide)) }}
      />

      <nav aria-label="위치" className="mb-3 text-xs text-slate-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-slate-800">
              홈
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/guide" className="hover:text-slate-800">
              시기별 가이드
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link
              href={`/guide?category=${guide.category}`}
              className="hover:text-slate-800"
            >
              {GUIDE_CATEGORY_LABELS[guide.category]}
            </Link>
          </li>
        </ol>
      </nav>

      <article className="break-keep">
        <header className="mb-5">
          <div className="mb-2 flex flex-wrap gap-1">
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-white">
              {GUIDE_CATEGORY_LABELS[guide.category]}
            </span>
            {guide.stages.map((s) => (
              <Link
                key={s}
                href={`/guide?stage=${s}`}
                className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
              >
                {STAGE_LABELS[s]}
              </Link>
            ))}
          </div>
          <h1 className="text-[22px] font-extrabold leading-snug tracking-tight text-slate-900 md:text-[26px]">
            {guide.title}
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            최종 확인{" "}
            <time dateTime={guide.checkedAt}>{formatGuideDate(guide.checkedAt)}</time> · 공식
            출처 {guide.sources.length}곳
          </p>
        </header>

        <section
          aria-labelledby="guide-answer"
          className="mb-6 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] ring-1 ring-rose-100"
        >
          <h2 id="guide-answer" className="mb-2 text-sm font-extrabold text-rose-700">
            3줄 요약
          </h2>
          <ul className="space-y-1.5 text-[15px] leading-7 text-slate-800">
            {guide.summary.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400"
                />
                <span>
                  <Inline text={line} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        {sections.length >= 3 && (
          <nav aria-label="목차" className="mb-2 rounded-xl bg-white/70 px-4 py-3 ring-1 ring-slate-200">
            <p className="mb-1 text-xs font-bold text-slate-500">목차</p>
            <ol className="space-y-1 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-slate-700 hover:text-rose-700">
                    {i + 1}. {plainText(s.text)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <GuideBody blocks={guide.body} />

        {guide.faq.length > 0 && (
          <section aria-labelledby="guide-faq" className="mt-10">
            <h2
              id="guide-faq"
              className="mb-3 text-lg font-extrabold tracking-tight text-slate-900"
            >
              자주 묻는 질문
            </h2>
            <div className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
              {guide.faq.map((f, i) => (
                <div key={i} className="px-4 py-4">
                  <h3 className="flex gap-2 text-[15px] font-bold leading-snug text-slate-900">
                    <span aria-hidden className="text-rose-500">
                      Q
                    </span>
                    {f.q}
                  </h3>
                  <p className="mt-1.5 pl-5 text-sm leading-6 text-slate-700">
                    <Inline text={f.a} />
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="guide-sources" className="mt-10">
          <h2
            id="guide-sources"
            className="mb-3 text-lg font-extrabold tracking-tight text-slate-900"
          >
            공식 출처
          </h2>
          <ul className="space-y-2 text-sm">
            {guide.sources.map((s) => (
              <li key={s.url} className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
                <p className="text-xs font-bold text-slate-500">{s.org}</p>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600"
                >
                  {s.title}
                  <span className="sr-only"> (새 창)</span>
                </a>
                <p className="mt-0.5 text-xs text-slate-500">
                  확인일 <time dateTime={s.checkedAt}>{formatGuideDate(s.checkedAt)}</time>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            제도와 금액은 바뀔 수 있어요. 신청 전에 위 기관 안내를 한 번 더 확인하세요.
            엄빠레이더는 공식 자료를 정리해 전할 뿐, 신청을 대신하지 않아요.
          </p>
        </section>
      </article>

      <section aria-labelledby="guide-benefits" className="mt-10">
        <h2
          id="guide-benefits"
          className="mb-1 text-lg font-extrabold tracking-tight text-slate-900"
        >
          이 시기 진행 중인 혜택
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          엄빠레이더가 모은 {guide.stages.map((s) => STAGE_LABELS[s]).join("·")} 시기
          체험단·이벤트 카드예요. 마감이 가까운 순서예요.
        </p>
        <Suspense fallback={<GuideBenefitsSkeleton />}>
          <GuideBenefits slug={guide.slug} stages={guide.stages} cardTypes={guide.cardTypes} />
        </Suspense>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="guide-related" className="mt-10">
          <h2
            id="guide-related"
            className="mb-3 text-lg font-extrabold tracking-tight text-slate-900"
          >
            함께 보면 좋은 가이드
          </h2>
          <ul className="space-y-2">
            {related.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guide/${g.slug}`}
                  className="block break-keep rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/guide"
        className="mt-8 block rounded-2xl bg-slate-900 px-4 py-3.5 text-center text-sm font-bold text-white hover:bg-slate-800"
      >
        시기별 가이드 전체 보기
      </Link>
    </main>
  );
}
