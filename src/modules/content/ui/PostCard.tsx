// ============================================
// PostCard — 카드 1개를 그리드에 그리는 컴포넌트
// 이미지 영역과 텍스트 영역 분리 — 업체 이미지 위에 덮어쓰지 않음
// ============================================

import Link from "next/link";
import { ViewTransition } from "react";
import type { Post } from "@/shared/types/post";
import { STAGE_LABELS, TYPE_LABELS } from "@/shared/types/post";
import { calcDDay } from "@/shared/utils/dday";
import { formatRelativeTime } from "@/shared/utils/relative-time";

interface Props {
  post: Post;
}

export function PostCard({ post }: Props) {
  const dday = calcDDay(post.deadline);
  const isReview = post.kind === "review";

  return (
    <Link
      href={`/post/${post.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)]"
    >
      {/* 이미지 영역 — 깔끔하게 이미지만 (배지만 오버레이) */}
      <ViewTransition name={`post-thumb-${post.id}`}>
        <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
          {post.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.thumbnail_url}
              alt={post.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-100 to-amber-100 text-3xl">
              📡
            </div>
          )}

          {/* D-day 배지 (좌측 상단) */}
          {dday && (
            <span
              className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-white shadow-sm ${
                dday.urgent ? "bg-rose-500" : "bg-slate-900/70 backdrop-blur"
              }`}
            >
              {dday.label}
            </span>
          )}

          {/* 후기 배지 (우측 상단) */}
          {isReview && (
            <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-amber-900 shadow-sm">
              후기
            </span>
          )}
        </div>
      </ViewTransition>

      {/* 텍스트 영역 — 이미지와 분리, 자체 텍스트 영역 */}
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
        {post.brand_name && (
          <p className="text-[11px] font-semibold tracking-tight text-rose-600">
            {post.brand_name}
          </p>
        )}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-slate-900">
          {post.title}
        </h3>
        {post.body && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
            {post.body}
          </p>
        )}

        {/* 태그 */}
        <div className="mt-1 flex flex-wrap gap-1">
          {post.stage_categories.slice(0, 2).map((s) => (
            <span
              key={s}
              className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700"
            >
              {STAGE_LABELS[s] ?? s}
            </span>
          ))}
          {post.type_tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
            >
              {TYPE_LABELS[t] ?? t}
            </span>
          ))}
        </div>

        {/* 등록 시간 */}
        <p className="mt-auto pt-1.5 text-[10px] text-slate-400">
          {formatRelativeTime(post.created_at)} 등록
        </p>
      </div>
    </Link>
  );
}
