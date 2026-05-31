"use client";

// ============================================
// DiscoveryView — 메인 카드 그리드 (클라이언트 즉시 필터)
// 서버는 발행 카드 전부 + 검색(q) 결과만 내려주고,
// 시기·유형·주제·정렬은 여기서 메모리 필터 → 클릭 시 서버 왕복 0회 (즉시 반응).
// ============================================

import { useMemo, useState } from "react";
import type { Post, StageCategory } from "@/shared/types/post";
import type { SortMode } from "@/modules/content/service";
import { filterPosts, sortPosts } from "@/modules/discovery/service";
import { FilterBar } from "./FilterBar";
import { PostCard } from "@/modules/content/ui/PostCard";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";

interface Props {
  posts: Post[];
  q: string;
  initialStage: string;
  initialType: string;
  initialTopic: string;
  initialSort: SortMode;
  myChildStages: StageCategory[];
  hasChildren: boolean;
}

export function DiscoveryView({
  posts,
  q,
  initialStage,
  initialType,
  initialTopic,
  initialSort,
  myChildStages,
  hasChildren,
}: Props) {
  const [stage, setStage] = useState(initialStage);
  const [type, setType] = useState(initialType);
  const [topic, setTopic] = useState(initialTopic);
  const [sort, setSort] = useState<SortMode>(initialSort);

  const shown = useMemo(
    () =>
      sortPosts(
        filterPosts(posts, { stage, type, topic, myChildStages }),
        sort
      ),
    [posts, stage, type, topic, sort, myChildStages]
  );

  const filterActive = stage !== "all" || type !== "all" || topic !== "all";

  function handleFilterChange(
    key: "stage" | "type" | "topic" | "sort",
    value: string
  ) {
    if (key === "stage") setStage(value);
    else if (key === "type") setType(value);
    else if (key === "topic") setTopic(value);
    else if (key === "sort") setSort(value as SortMode);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          놓치는 혜택은 없게
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          오늘의 협찬·체험단·후기를 한눈에 · {shown.length}건
          {q && ` · "${q}" 검색 결과`}
          {stage === "my_child" && hasChildren && " · 내 아이 맞춤"}
        </p>
      </header>

      <AdSlot id="top_banner" />

      <div className="mb-6">
        <FilterBar
          stage={stage}
          type={type}
          topic={topic}
          sort={sort}
          q={q}
          hasChildren={hasChildren}
          onFilterChange={handleFilterChange}
        />
      </div>

      {filterActive && <AdSlot id="category_top" context={{ stage, type }} />}

      {shown.length === 0 ? (
        <p className="py-20 text-center text-sm text-slate-400">
          {q
            ? `"${q}" 검색 결과가 없어요. 다른 키워드로 시도해보세요.`
            : stage === "my_child"
              ? "내 아이 시기에 맞는 카드가 아직 없어요. 다른 필터를 시도해보세요."
              : "조건에 맞는 카드가 없어요. 필터를 바꿔보세요."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
