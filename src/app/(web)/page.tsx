// ============================================
// 메인 페이지 — 카드 그리드 + 검색·필터·정렬
// URL: /  (route group (web)는 URL에 안 나옴)
//
// 로그인 + 자녀 등록된 사용자 → 디폴트 시기 필터 = "내 아이"
// 그 외 → 디폴트 = "전체"
// ============================================

import { listPosts } from "@/modules/content/service";
import type { SortMode } from "@/modules/content/service";
import { filterPosts } from "@/modules/discovery/service";
import { FilterBar } from "@/modules/discovery/ui/FilterBar";
import { PostCard } from "@/modules/content/ui/PostCard";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";
import { getUserChildrenBirths } from "@/modules/personalization/service-server";
import { getStagesForChildren } from "@/shared/utils/stages";

export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{
    stage?: string;
    type?: string;
    sort?: string;
    q?: string;
  }>;
}

function parseSort(s?: string): SortMode {
  if (s === "created_desc" || s === "deadline_desc") return s;
  return "deadline_asc";
}

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const type = sp.type ?? "all";
  const sort = parseSort(sp.sort);
  const q = (sp.q ?? "").trim();

  // 자녀 시기 계산 (로그인 + 자녀 등록 사용자만 non-empty)
  const childrenBirths = await getUserChildrenBirths();
  const hasChildren = childrenBirths.length > 0;
  const myChildStages = hasChildren ? getStagesForChildren(childrenBirths) : [];

  // 디폴트 stage: 자녀 있으면 "my_child", 없으면 "all"
  const stage = sp.stage ?? (hasChildren ? "my_child" : "all");

  // 서버에서 검색·정렬 처리, 카테고리 필터는 클라이언트(메모리) 처리
  const fetched = await listPosts({ q, sort });
  const posts = filterPosts(fetched, { stage, type, myChildStages });

  const filterActive = stage !== "all" || type !== "all";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          놓치는 혜택은 없게
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          오늘의 협찬·체험단·후기를 한눈에 · {posts.length}건
          {q && ` · "${q}" 검색 결과`}
          {stage === "my_child" && hasChildren && " · 내 아이 맞춤"}
        </p>
      </header>

      <AdSlot id="top_banner" />

      <div className="mb-6">
        <FilterBar
          stage={stage}
          type={type}
          sort={sort}
          q={q}
          hasChildren={hasChildren}
        />
      </div>

      {filterActive && (
        <AdSlot id="category_top" context={{ stage, type }} />
      )}

      {posts.length === 0 ? (
        <p className="py-20 text-center text-sm text-slate-400">
          {q
            ? `"${q}" 검색 결과가 없어요. 다른 키워드로 시도해보세요.`
            : stage === "my_child"
              ? "내 아이 시기에 맞는 카드가 아직 없어요. 다른 필터를 시도해보세요."
              : "조건에 맞는 카드가 없어요. 필터를 바꿔보세요."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
