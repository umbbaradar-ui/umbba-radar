// ============================================
// Guide 상수 — 분류 라벨·정렬 순서·날짜 표기
// 클라이언트·서버 양쪽에서 import 가능 (본문 데이터 없음)
// ============================================

import type { StageCategory } from "@/shared/types/post";
import type { GuideCategory } from "./types";

export const GUIDE_SITE_URL = "https://umbba-radar.com";

export const GUIDE_CATEGORY_LABELS: Record<GuideCategory, string> = {
  money: "제도·지원금",
  todo: "준비·체크리스트",
  health: "접종·검진",
  safety: "생활·안전",
  sponsor: "체험단·협찬",
};

export const GUIDE_CATEGORY_ORDER: readonly GuideCategory[] = [
  "money",
  "todo",
  "health",
  "safety",
  "sponsor",
] as const;

/** 가이드 목록의 시기 탭 순서 (전연령 제외 — 가이드는 시기 질문에 답한다) */
export const GUIDE_STAGE_ORDER: readonly StageCategory[] = [
  "pregnancy",
  "newborn",
  "infant",
  "toddler",
  "elementary",
] as const;

/** "2026-10-08" → "2026년 10월 8일" */
export function formatGuideDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return ymd;
  return `${y}년 ${m}월 ${d}일`;
}

/** "2026-10-08" → KST 자정 ISO (JSON-LD·sitemap용) */
export function guideDateIso(ymd: string): string {
  return `${ymd}T00:00:00+09:00`;
}
