// ============================================
// 카드 상세 페이지 — /post/[id]
// 메인의 썸네일이 hero 이미지로 모핑되는 ViewTransition
// ============================================

import Link from "next/link";
import { ViewTransition } from "react";
import { notFound } from "next/navigation";
import { getPost } from "@/modules/content/service";
import { StatusButtons } from "@/modules/personalization/ui/StatusButtons";
import { getUserStatusForPost } from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { CardClickTracker } from "@/modules/analytics/ui/CardClickTracker";
import { ExternalLinkButton } from "@/modules/analytics/ui/ExternalLinkButton";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";
import { ViewGate } from "@/modules/user/ui/ViewGate";
import { STAGE_LABELS, TYPE_LABELS } from "@/shared/types/post";
import { calcDDay } from "@/shared/utils/dday";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [post, user] = await Promise.all([getPost(id), getCurrentUser()]);

  if (!post) {
    notFound();
  }

  const initialStatus = user ? await getUserStatusForPost(post.id) : null;

  const dday = calcDDay(post.deadline);
  const isReview = post.kind === "review";

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
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
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-gray-100">
            {post.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.thumbnail_url}
                alt={post.title}
                className="h-full w-full object-cover"
              />
            )}
            {dday && (
              <span
                className={`absolute left-4 top-4 rounded-full px-4 py-1.5 text-sm font-bold text-white ${
                  dday.urgent ? "bg-rose-500" : "bg-slate-700/80"
                }`}
              >
                {dday.label}
              </span>
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

          {post.deadline && (
            <p className="text-xs text-slate-500">
              마감: {new Date(post.deadline).toLocaleString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Seoul", // Vercel 서버는 UTC라 KST 명시 안 하면 9시간 밀림
              })}
            </p>
          )}

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
