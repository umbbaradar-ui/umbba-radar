// ============================================
// PostCard 스켈레톤 — 새 카드 디자인(이미지 도미넌트 4:5)에 맞춤
// ============================================

export function PostCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
      <div className="skeleton aspect-square w-full" />
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="mt-1 flex gap-1">
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
