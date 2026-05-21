// ============================================
// PostCard — 카드 1개를 그리드에 그리는 컴포넌트
// 클릭 시 외부 링크가 아닌 내부 상세 페이지로 이동
// ============================================

import Link from "next/link";
import type { Post } from "@/shared/types/post";
import { STAGE_LABELS, TYPE_LABELS } from "@/shared/types/post";

interface Props {
  post: Post;
}

function calcDDay(
  deadline: string | null
): { label: string; urgent: boolean } | null {
  if (!deadline) return null;
  const diffMs = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "마감", urgent: false };
  if (days === 0) return { label: "D-Day", urgent: true };
  return { label: `D-${days}`, urgent: days <= 3 };
}

export function PostCard({ post }: Props) {
  const dday = calcDDay(post.deadline);
  const isReview = post.kind === "review";

  return (
    <Link
      href={`/post/${post.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        {post.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail_url}
            alt={post.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        )}
        {dday && (
          <span
            className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white ${
              dday.urgent ? "bg-rose-500" : "bg-slate-700/80"
            }`}
          >
            {dday.label}
          </span>
        )}
        {isReview && (
          <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
            후기
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {post.brand_name && (
          <p className="text-xs font-medium text-slate-500">{post.brand_name}</p>
        )}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
          {post.title}
        </h3>
        {post.body && (
          <p className="line-clamp-2 text-xs text-slate-600">{post.body}</p>
        )}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {post.stage_categories.map((s) => (
            <span
              key={s}
              className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700"
            >
              {STAGE_LABELS[s] ?? s}
            </span>
          ))}
          {post.type_tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
            >
              {TYPE_LABELS[t] ?? t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
