// ============================================
// 카드 상세 페이지 로딩 스켈레톤
// ============================================

export default function PostDetailLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      <div className="skeleton mb-4 h-4 w-20 rounded" />

      <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="skeleton aspect-[4/5] w-full" />
        <div className="space-y-5 p-6">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="space-y-2">
            <div className="skeleton h-6 w-full rounded" />
            <div className="skeleton h-6 w-3/4 rounded" />
          </div>
          <div className="flex gap-1.5">
            <div className="skeleton h-6 w-14 rounded-full" />
            <div className="skeleton h-6 w-14 rounded-full" />
            <div className="skeleton h-6 w-14 rounded-full" />
          </div>
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="flex gap-2">
            <div className="skeleton h-12 flex-1 rounded-xl" />
            <div className="skeleton h-12 flex-1 rounded-xl" />
          </div>
          <div className="skeleton h-14 w-full rounded-xl" />
        </div>
      </article>
    </main>
  );
}
