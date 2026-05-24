// ============================================
// PostCard — 카드 1개를 그리드에 그리는 컴포넌트
// 이미지 우선, 텍스트 정돈 — "앱 같은" 시각감
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
      className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)]"
    >
      <ViewTransition name={`post-thumb-${post.id}`}>
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100">
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

          {/* 하단 그라데이션 — 텍스트·배지 가독성 보강 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />

          {/* D-day 배지 */}
          {dday && (
            <span
              className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-white shadow-sm ${
                dday.urgent ? "bg-rose-500" : "bg-slate-900/70 backdrop-blur"
              }`}
            >
              {dday.label}
            </span>
          )}

          {/* 후기 배지 */}
          {isReview && (
            <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-amber-700 shadow-sm">
              후기
            </span>
          )}

          {/* 브랜드명·제목 오버레이 — 이미지 위에 직접 */}
          <div className="absolute inset-x-0 bottom-0 p-4">
            {post.brand_name && (
              <p className="text-[11px] font-semibold tracking-tight text-white/85 drop-shadow">
                {post.brand_name}
              </p>
            )}
            <h3 className="mt-0.5 line-clamp-2 text-[15px] font-extrabold leading-tight tracking-tight text-white drop-shadow">
              {post.title}
            </h3>
          </div>
        </div>
      </ViewTransition>

      {/* 본문: 한 줄 설명 + 태그 + 등록 상대시간 */}
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        {post.body && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
            {post.body}
          </p>
        )}
        <p className="text-[10px] text-slate-400">
          {formatRelativeTime(post.created_at)} 등록
        </p>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
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
      </div>
    </Link>
  );
}
