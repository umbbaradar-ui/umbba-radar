// ============================================
// PostCard 스켈레톤 — 데이터 로딩 중 표시
// ============================================

export function PostCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="skeleton aspect-square w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="mt-2 flex gap-1.5">
          <div className="skeleton h-4 w-10 rounded-full" />
          <div className="skeleton h-4 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function PostCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}
