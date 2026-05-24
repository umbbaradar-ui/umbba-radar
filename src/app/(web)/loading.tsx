// ============================================
// 메인 페이지 로딩 스켈레톤
// Next.js loading.tsx 컨벤션 — 같은 폴더의 page.tsx가 로딩 중일 때 자동 표시
// ============================================

import { PostCardSkeletonGrid } from "@/modules/content/ui/PostCardSkeleton";

export default function HomeLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <div className="skeleton h-5 w-40 rounded" />
        <div className="skeleton mt-2 h-3 w-56 rounded" />
      </header>

      <div className="mb-6 space-y-3">
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-7 w-16 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-7 w-14 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      <PostCardSkeletonGrid count={8} />
    </main>
  );
}
