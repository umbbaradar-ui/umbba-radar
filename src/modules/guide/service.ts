// ============================================
// Guide Service — 공개 창구 (서버 전용)
// 본문까지 담긴 content/index.ts 를 import 하므로 클라이언트 컴포넌트에서 부르지 말 것.
// 클라이언트에서 링크만 필요하면 ui/GuideStageLinks (content/catalog.ts) 를 쓴다.
// ============================================

import type { StageCategory } from "@/shared/types/post";
import { GUIDE_CATEGORY_ORDER } from "./constants";
import { GUIDE_CATALOG } from "./content/catalog";
import { GUIDES } from "./content";
import type { Guide, GuideLink } from "./types";

const BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));

/** 전체 가이드 — 분류 순서 → 목차 순서 */
export function listGuides(): Guide[] {
  return [...GUIDES].sort(
    (a, b) =>
      GUIDE_CATEGORY_ORDER.indexOf(a.category) -
      GUIDE_CATEGORY_ORDER.indexOf(b.category)
  );
}

/** 사이트맵·정적 파라미터용 가벼운 목록 */
export function listGuideLinks(): GuideLink[] {
  return GUIDE_CATALOG;
}

export function getGuide(slug: string): Guide | null {
  return BY_SLUG.get(slug) ?? null;
}

/** 해당 시기 가이드 */
export function listGuidesForStage(stage: StageCategory): Guide[] {
  return listGuides().filter((g) => g.stages.includes(stage));
}

/**
 * 함께 볼 가이드 — 시기가 많이 겹칠수록, 같은 분류면 조금 더 앞으로.
 * 본문에서 이미 링크한 편은 뺀다(같은 링크 반복 방지).
 */
export function getRelatedGuides(guide: Guide, limit = 3): Guide[] {
  const linked = new Set(
    JSON.stringify(guide.body)
      .match(/\]\(\/guide\/([a-z0-9-]+)\)/g)
      ?.map((m) => m.slice(9, -1)) ?? []
  );
  return GUIDES.filter((g) => g.slug !== guide.slug && !linked.has(g.slug))
    .map((g) => ({
      g,
      score:
        g.stages.filter((s) => guide.stages.includes(s)).length * 2 +
        (g.category === guide.category ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.g);
}
