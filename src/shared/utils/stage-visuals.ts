// ============================================
// 시기별 이모지·색상 매핑
// NotificationCenter, MY 레이더 등에서 카드 시기 시각화에 공통 사용
// (썸네일 없이 빠르게 "내 아이 시기 카드"임을 파악)
// ============================================

import type { StageCategory } from "@/shared/types/post";

interface StageVisual {
  emoji: string;
  /** Tailwind 배경 클래스 (옅은 톤) */
  bgClass: string;
  /** Tailwind 텍스트/외곽선 클래스 */
  accentClass: string;
}

export const STAGE_VISUALS: Record<StageCategory, StageVisual> = {
  pregnancy: {
    emoji: "🤰",
    bgClass: "bg-pink-100",
    accentClass: "text-pink-700",
  },
  newborn: {
    emoji: "👶",
    bgClass: "bg-amber-100",
    accentClass: "text-amber-800",
  },
  infant: {
    emoji: "🍼",
    bgClass: "bg-sky-100",
    accentClass: "text-sky-700",
  },
  toddler: {
    emoji: "🧸",
    bgClass: "bg-orange-100",
    accentClass: "text-orange-700",
  },
  elementary: {
    emoji: "🎒",
    bgClass: "bg-emerald-100",
    accentClass: "text-emerald-700",
  },
  all_ages: {
    emoji: "🏠",
    bgClass: "bg-slate-100",
    accentClass: "text-slate-700",
  },
};

/**
 * 카드의 stage_categories 배열 → 대표 시기 1개 선택
 * 우선순위: 더 구체적인 시기 > 전연령
 * (썸네일 자리에 1개만 보여줄 때 사용)
 */
export function pickPrimaryStage(
  stages: StageCategory[]
): StageCategory {
  if (stages.length === 0) return "all_ages";

  // 전연령보다 구체적 시기 우선
  const specific = stages.find((s) => s !== "all_ages");
  return specific ?? stages[0];
}

/** 카드의 시기 배열 → 대표 시각화 정보 */
export function getStageVisual(stages: StageCategory[]): StageVisual {
  const primary = pickPrimaryStage(stages);
  return STAGE_VISUALS[primary];
}
