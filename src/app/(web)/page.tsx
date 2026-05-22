// ============================================
// 메인 페이지 — 카드 그리드 + 필터
// URL: /  (route group (web)는 URL에 안 나옴)
// ============================================

import { listPosts } from "@/modules/content/service";
import { filterPosts } from "@/modules/discovery/service";
import { FilterBar } from "@/modules/discovery/ui/FilterBar";
import { PostCard } from "@/modules/content/ui/PostCard";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";

// 60초마다 캐시 갱신 — 새 카드 발행 시 빠르게 반영
export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{ stage?: string; type?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const allPosts = await listPosts();
  const posts = filterPosts(allPosts, sp);

  const stage = sp.stage ?? "all";
  const type = sp.type ?? "all";

  const filterActive = stage !== "all" || type !== "all";

  return (
    <main className="mx-auto max-w-5xl px-5 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          놓치는 혜택은 없게
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          오늘의 협찬·체험단·후기를 한눈에 · {posts.length}건
        </p>
      </header>

      {/* 광고: 상단 배너 (Phase 3 활성) */}
      <AdSlot id="top_banner" />

      <div className="mb-6">
        <FilterBar stage={stage} type={type} />
      </div>

      {/* 광고: 필터 적용 시에만 카테고리 매칭 광고 (Phase 3 활성) */}
      {filterActive && (
        <AdSlot id="category_top" context={{ stage, type }} />
      )}

      {posts.length === 0 ? (
        <p className="py-20 text-center text-sm text-slate-400">
          조건에 맞는 카드가 없어요. 필터를 바꿔보세요.
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
