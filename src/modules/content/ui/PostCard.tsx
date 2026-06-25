// ============================================
// PostCard — 카드 1개를 그리드에 그리는 컴포넌트
// 이미지 영역과 텍스트 영역 분리
// 본문/등록시간 제거, 3일내 신규는 NEW 배지로
// ============================================

import Link from "next/link";
import { ViewTransition } from "react";
import type { Post } from "@/shared/types/post";
import { STAGE_LABELS, TYPE_LABELS } from "@/shared/types/post";
import { calcDDay } from "@/shared/utils/dday";

interface Props {
  post: Post;
  /** 사용자 체크 상태 — 메인 그리드에서 신청/관심 구분 표시용 (옵션) */
  status?: "applied" | "interested" | null;
}

const NEW_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

export function PostCard({ post, status }: Props) {
  const dday = calcDDay(post.deadline);
  const isReview = post.kind === "review";
  const isNew =
    Date.now() - new Date(post.created_at).getTime() < NEW_THRESHOLD_MS;

  return (
    <Link
      href={`/post/${post.id}`}
      data-tutorial="post-card"
      className={`group flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] ${
        status === "applied"
          ? "opacity-65 hover:opacity-100"
          : ""
      }`}
    >
      {/* 이미지 영역 — 1:1 프레임 + 블러 백드롭으로 잘림 방지
          포트레이트(4:5)·정사각(1:1)·랜드스케이프 모두 잘리지 않고 표시.
          비는 공간은 같은 이미지를 강하게 블러한 색감으로 자연스럽게 채움. */}
      <ViewTransition name={`post-thumb-${post.id}`}>
        <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
          {post.thumbnail_url ? (
            <>
              {/* 블러 백드롭 (같은 이미지) */}
              <div
                className="absolute inset-0 scale-110 bg-cover bg-center opacity-80 blur-2xl"
                style={{ backgroundImage: `url(${post.thumbnail_url})` }}
                aria-hidden="true"
              />
              {/* 전경 이미지 — 잘림 없이 contain */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.thumbnail_url}
                alt={post.title}
                loading="lazy"
                className="relative h-full w-full object-contain transition duration-500 group-hover:scale-[1.03]"
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-100 to-amber-100 text-3xl">
              📡
            </div>
          )}

          {/* 좌측 상단 배지 그룹 — D-day + NEW
              마감 미정(deadline_unknown) 카드는 자동마감일이 D-day로 보이면 "오늘 마감!"
              같은 가짜 긴급감을 줘서, D-day 대신 "상시" 중립 배지로 표시.
              실제 마감일 있는 카드만 D-day(긴급=빨강) 노출. */}
          {(dday || isNew) && (
            <div className="absolute left-3 top-3 flex gap-1">
              {post.deadline_unknown ? (
                <span
                  className="rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-white shadow-sm backdrop-blur"
                  title="마감일 미정 — 원문에서 마감을 확인하세요"
                >
                  상시
                </span>
              ) : (
                dday && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-white shadow-sm ${
                      dday.urgent ? "bg-rose-500" : "bg-slate-900/70 backdrop-blur"
                    }`}
                  >
                    {dday.label}
                  </span>
                )
              )}
              {isNew && (
                <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-white shadow-sm">
                  NEW
                </span>
              )}
            </div>
          )}

          {/* 후기 배지 (우측 상단) */}
          {isReview && (
            <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-amber-900 shadow-sm">
              후기
            </span>
          )}

          {/* 체크 상태 배지 (우측 하단) — 신청함은 강조(빨강), 관심은 보조(노랑).
              신청함 카드는 카드 전체가 반투명(opacity) 처리되어 "완료" 느낌. */}
          {status && (
            <span
              className={`absolute bottom-2.5 right-2.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-tight shadow-sm ${
                status === "applied"
                  ? "bg-rose-500 text-white"
                  : "bg-amber-400 text-amber-900"
              }`}
            >
              {status === "applied" ? "✓ 신청함" : "★ 관심"}
            </span>
          )}
        </div>
      </ViewTransition>

      {/* 텍스트 영역 — 이미지와 분리 */}
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
        {post.brand_name && (
          <p className="text-[11px] font-semibold tracking-tight text-rose-600">
            {post.brand_name}
          </p>
        )}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-slate-900">
          {post.title}
        </h3>

        {/* 태그 — 카드 하단 고정 */}
        <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
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
