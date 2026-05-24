// ============================================
// 지난 이벤트 페이지 — /archive
// expired 상태 카드만 모아 보여줌. 마감 최신순.
// ============================================

import { listExpiredPosts } from "@/modules/content/service";
import { PostCard } from "@/modules/content/ui/PostCard";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";

// 5분 캐시 — 지난 이벤트는 자주 안 바뀜
export const revalidate = 300;

export default async function ArchivePage() {
  const posts = await listExpiredPosts();

  return (
    <main className="mx-auto max-w-5xl px-5 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          지난 이벤트
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          마감된 협찬·체험단 모음 · {posts.length}건
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          참고용 아카이브예요. 신청은 끝났을 가능성이 높습니다.
        </p>
      </header>

      <AdSlot id="my_top" />

      {posts.length === 0 ? (
        <p className="py-20 text-center text-sm text-slate-400">
          아직 지난 이벤트가 없어요. 카드들이 마감되면 여기에 쌓입니다.
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
