// ============================================
// Discovery Service — 검색·필터·정렬 (읽기 전용 합성)
// 자체 데이터 없음. Content의 Post를 받아 필터링.
// ============================================

import type { Post, StageCategory, TypeTag } from "@/shared/types/post";

export interface PostFilters {
  stage?: string;
  type?: string;
}

/** URL 검색 파라미터로 들어온 값을 후처리해서 카드 목록을 필터 */
export function filterPosts(posts: Post[], filters: PostFilters): Post[] {
  const { stage, type } = filters;

  return posts.filter((p) => {
    if (stage && stage !== "all") {
      if (!p.stage_categories.includes(stage as StageCategory)) return false;
    }
    if (type && type !== "all") {
      if (!p.type_tags.includes(type as TypeTag)) return false;
    }
    return true;
  });
}
