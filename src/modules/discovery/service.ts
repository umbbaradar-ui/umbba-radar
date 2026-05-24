// ============================================
// Discovery Service — 검색·필터·정렬 (읽기 전용 합성)
// stage·type 카테고리 필터링은 클라이언트 측에서 처리
// (Supabase 배열 컬럼 필터는 복잡 → 메모리 필터 충분히 빠름)
// ============================================

import type { Post, StageCategory, TypeTag } from "@/shared/types/post";
import type { SortMode } from "@/modules/content/service";

export interface PostFilters {
  stage?: string;
  type?: string;
}

export interface SearchAndSort {
  q?: string;
  sort?: SortMode;
}

/** 클라이언트 측 필터 — stage·type 카테고리 매칭 */
export function filterPosts(posts: Post[], filters: PostFilters): Post[] {
  const { stage, type } = filters;

  return posts.filter((p) => {
    if (stage && stage !== "all") {
      // 'all_ages' 시기 필터를 명시적으로 선택했으면 그 태그만, 아니면
      // 특정 시기 + all_ages 둘 다 포함 (전연령 제품은 모든 시기 필터에 등장)
      const tags = p.stage_categories;
      if (stage === "all_ages") {
        if (!tags.includes("all_ages" as StageCategory)) return false;
      } else {
        const hasStage = tags.includes(stage as StageCategory);
        const hasAllAges = tags.includes("all_ages" as StageCategory);
        if (!hasStage && !hasAllAges) return false;
      }
    }
    if (type && type !== "all") {
      if (!p.type_tags.includes(type as TypeTag)) return false;
    }
    return true;
  });
}
