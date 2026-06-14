// ============================================
// 카드 상세 페이지 — /post/[id]
// 메인의 썸네일이 hero 이미지로 모핑되는 ViewTransition
// ============================================

import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { notFound } from "next/navigation";
import { getPost } from "@/modules/content/service";
import { StatusButtons } from "@/modules/personalization/ui/StatusButtons";
import { getUserStatusForPost } from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { getUserProfile } from "@/modules/user/service-server";
import { CardClickTracker } from "@/modules/analytics/ui/CardClickTracker";
import { ExternalLinkButton } from "@/modules/analytics/ui/ExternalLinkButton";
import { ShareButton } from "@/modules/content/ui/ShareButton";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";
import { ViewGate } from "@/modules/user/ui/ViewGate";
import { STAGE_LABELS, TYPE_LABELS } from "@/shared/types/post";
import { calcDDay } from "@/shared/utils/dday";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

// SEO — 카드별 고유 메타데이터 (검색결과·SNS 공유 카드 풍부화)
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    return {
      title: "카드를 찾을 수 없어요",
      robots: { index: false, follow: false },
    };
  }

  const dday = calcDDay(post.deadline);
  const stageStr = post.stage_categories
    .map((s) => STAGE_LABELS[s] ?? s)
    .join(", ");
  const typeStr = post.type_tags.map((t) => TYPE_LABELS[t] ?? t).join(", ");

  const titleBase = post.brand_name
    ? `[${post.brand_name}] ${post.title}`
    : post.title;
  const titleSuffix = dday ? ` · ${dday.label}` : "";
  const title = `${titleBase}${titleSuffix} · 엄빠레이더`.slice(0, 100);

  const description = [
    typeStr && `${typeStr}`,
    stageStr,
    post.body?.replace(/\s+/g, " ").slice(0, 100),
    "엄빠레이더에서 모은 임신·출산·육아 협찬 정보",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 160);

  const url = `/post/${post.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "엄빠레이더",
      locale: "ko_KR",
      type: "article",
      // 카드별 동적 OG 이미지는 같은 폴더의 opengraph-image.tsx가 자동 제공
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [post, user, profile] = await Promise.all([
    getPost(id),
    getCurrentUser(),
    getUserProfile(), // 비로그인이면 null → 공유 버튼 중립 카피
  ]);

  if (!post) {
    notFound();
  }

  const initialStatus = user ? await getUserStatusForPost(post.id) : null;

  const dday = calcDDay(post.deadline);
  const isReview = post.kind === "review";

  // JSON-LD 구조화 데이터 (Google rich snippet)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    image: post.thumbnail_url ? [post.thumbnail_url] : undefined,
    datePublished: post.created_at,
    dateModified: post.updated_at,
    author: {
      "@type": "Organization",
      name: post.brand_name ?? "엄빠레이더",
    },
    publisher: {
      "@type": "Organization",
      name: "엄빠레이더",
      logo: {
        "@type": "ImageObject",
        url: "https://umbba-radar.com/icons/icon-512.png",
      },
    },
    description: post.body?.slice(0, 200),
    url: `https://umbba-radar.com/post/${post.id}`,
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      {/* JSON-LD — Google rich snippet 후보 (이미지·날짜·이벤트 표시) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CardClickTracker postId={post.id} />
      <ViewGate postId={post.id} loggedIn={Boolean(user)} />
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
      >
        ← 목록으로
      </Link>

      <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <ViewTransition name={`post-thumb-${post.id}`}>
          {/* 1:1 프레임 + 블러 백드롭 — 어떤 비율 이미지도 잘리지 않게 */}
          <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
            {post.thumbnail_url && (
              <>
                {/* 블러 백드롭 */}
                <div
                  className="absolute inset-0 scale-110 bg-cover bg-center opacity-80 blur-2xl"
                  style={{ backgroundImage: `url(${post.thumbnail_url})` }}
                  aria-hidden="true"
                />
                {/* 전경 이미지 (잘림 없이 contain) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.thumbnail_url}
                  alt={post.title}
                  className="relative h-full w-full object-contain"
                />
              </>
            )}
            {/* 마감 미정은 "상시"(중립), 실제 마감일만 D-day(긴급=빨강). 본문 아래 안내박스에서 상세 설명 */}
            {post.deadline_unknown ? (
              <span className="absolute left-4 top-4 rounded-full bg-slate-700/80 px-4 py-1.5 text-sm font-bold text-white">
                상시
              </span>
            ) : (
              dday && (
                <span
                  className={`absolute left-4 top-4 rounded-full px-4 py-1.5 text-sm font-bold text-white ${
                    dday.urgent ? "bg-rose-500" : "bg-slate-700/80"
                  }`}
                >
                  {dday.label}
                </span>
              )
            )}
            {isReview && (
              <span className="absolute right-4 top-4 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold text-slate-900">
                후기
              </span>
            )}
          </div>
        </ViewTransition>

        <div className="space-y-5 p-6">
          {post.brand_name && (
            <p className="text-sm font-medium text-slate-500">
              {post.brand_name}
            </p>
          )}
          <h1 className="text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl">
            {post.title}
          </h1>

          <div className="flex flex-wrap gap-1.5">
            {post.stage_categories.map((s) => (
              <span
                key={s}
                className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700"
              >
                {STAGE_LABELS[s] ?? s}
              </span>
            ))}
            {post.type_tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {TYPE_LABELS[t] ?? t}
              </span>
            ))}
          </div>

          {post.body && (
            <div className="rounded-xl bg-amber-50/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                {isReview ? "후기 요약" : "신청 방법"}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {post.body}
              </p>
            </div>
          )}

          {post.deadline &&
            (post.deadline_unknown ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-amber-800">
                <p className="font-semibold">⚠️ 마감일 미정</p>
                <p className="mt-1">
                  정확한 마감일이 안내되지 않은 카드예요. 등록일 기준{" "}
                  <strong>
                    {new Date(post.deadline).toLocaleDateString("ko-KR", {
                      month: "long",
                      day: "numeric",
                      timeZone: "Asia/Seoul",
                    })}
                  </strong>{" "}
                  까지 자동 노출돼요. 본문과 원문에서 정확한 마감을 꼭
                  확인해주세요.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                마감:{" "}
                {new Date(post.deadline).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Seoul", // Vercel 서버는 UTC라 KST 명시 안 하면 9시간 밀림
                })}
              </p>
            ))}

          <StatusButtons
            postId={post.id}
            loggedIn={Boolean(user)}
            initialStatus={initialStatus}
          />

          <ExternalLinkButton
            postId={post.id}
            sourceUrl={post.source_url}
            className="block w-full rounded-xl bg-slate-900 px-4 py-4 text-center text-sm font-bold text-white transition hover:bg-slate-800"
          >
            원문 보러 가기 →
          </ExternalLinkButton>

          {/* 공유 — 바이럴 핵심. 배우자·지인에게 카드 전달 (앱 내 신청 X, 발견·공유만) */}
          <ShareButton
            postId={post.id}
            title={post.title}
            brandName={post.brand_name}
            role={profile?.parent_role ?? null}
          />

          <p className="text-center text-[11px] text-slate-400">
            * 신청·체험은 외부 인스타·블로그 페이지에서 진행됩니다
          </p>
        </div>
      </article>

      {/* 광고: 상세 페이지 하단 (Phase 3 활성) */}
      <div className="mt-6">
        <AdSlot id="detail_bottom" context={{ post_id: post.id }} />
      </div>
    </main>
  );
}
