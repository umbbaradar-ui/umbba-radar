// ============================================
// Discovery Service — 검색·필터·정렬 (읽기 전용 합성)
// stage·type 카테고리 필터링은 클라이언트 측에서 처리
// (Supabase 배열 컬럼 필터는 복잡 → 메모리 필터 충분히 빠름)
// ============================================

import type {
  Post,
  StageCategory,
  TypeTag,
  TopicCategory,
} from "@/shared/types/post";
import type { SortMode } from "@/modules/content/service";

export interface PostFilters {
  stage?: string;
  type?: string;
  topic?: string;
  /** "내 아이" 필터용 — 사용자 자녀들의 시기 합집합 */
  myChildStages?: StageCategory[];
}

export interface SearchAndSort {
  q?: string;
  sort?: SortMode;
}

/** 클라이언트 측 필터 — stage·type·topic 카테고리 매칭 */
export function filterPosts(posts: Post[], filters: PostFilters): Post[] {
  const { stage, type, topic, myChildStages } = filters;

  return posts.filter((p) => {
    if (topic && topic !== "all") {
      if (p.topic !== (topic as TopicCategory)) return false;
    }
    if (stage && stage !== "all") {
      const tags = p.stage_categories;

      if (stage === "my_child") {
        // 내 아이 필터: 자녀 시기 중 하나 OR 전연령 매칭
        // myChildStages 빈 배열이면 통과 못 함 (호출 측이 활성화 조건 처리)
        if (!myChildStages || myChildStages.length === 0) return false;
        const hasAnyChildStage = myChildStages.some((s) => tags.includes(s));
        const hasAllAges = tags.includes("all_ages" as StageCategory);
        if (!hasAnyChildStage && !hasAllAges) return false;
      } else if (stage === "all_ages") {
        // 전연령 필터를 명시적으로 선택 → all_ages 태그만
        if (!tags.includes("all_ages" as StageCategory)) return false;
      } else {
        // 일반 특정 시기 → 해당 시기 OR 전연령
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
