// ============================================
// 내 레이더(/my) 로딩 스켈레톤
// Next.js loading.tsx 컨벤션 — my/page.tsx 로딩 중 자동 표시.
// 탭바(관심·신청함·과거) + 카드 그리드 모양을 미리 잡아 레이아웃 흔들림 방지.
// ============================================

import { PostCardSkeletonGrid } from "@/modules/content/ui/PostCardSkeleton";

export default function MyLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* 탭바 (관심 / 신청함 / 과거) */}
      <div className="mb-5 flex gap-2 border-b border-slate-200">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton mb-2 h-7 w-16 rounded-lg" />
        ))}
      </div>

      <PostCardSkeletonGrid count={8} />
    </div>
  );
}
