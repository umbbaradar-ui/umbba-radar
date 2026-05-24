// ============================================
// 자녀 월령 → 시기 카테고리 매칭 유틸
// 인접 시기 간 버퍼로 경계 부드럽게 (5개월 = 출산직후 + 영아 둘 다 매칭)
// ============================================

import type { StageCategory } from "@/shared/types/post";

interface StageRange {
  stage: StageCategory;
  minMonths: number; // inclusive
  maxMonths: number; // exclusive
}

/**
 * 시기별 월령 범위 (버퍼 포함).
 * 음수 = 출산 전 (예정일 기준).
 * 인접 시기와 겹치는 부분 = 자연스러운 전환 영역.
 *
 * 6종 통합 후 코어 범위 + 버퍼:
 *   - 임신중: 출산 전
 *   - 신생아: 0~3개월 + ±3개월
 *   - 영아: 3~12개월 + ±3개월
 *   - 유아: 1~7세 (preschool 흡수) + ±6개월
 *   - 초등생: 7~13세 (저+고학년 통합) + ±12개월
 *   - 전연령: 별도 (월령 매칭 X)
 */
export const STAGE_RANGES: StageRange[] = [
  { stage: "pregnancy", minMonths: -10, maxMonths: 0 }, // 임신 ~ 출산 당일
  { stage: "newborn", minMonths: -3, maxMonths: 6 }, // 출산 3개월 전 ~ 6개월
  { stage: "infant", minMonths: 3, maxMonths: 15 }, // 3개월 ~ 1년 3개월
  { stage: "toddler", minMonths: 12, maxMonths: 90 }, // 1세 ~ 7세 6개월 (preschool 흡수)
  { stage: "elementary", minMonths: 72, maxMonths: 168 }, // 6세 ~ 14세 (저+고학년 통합)
];

/**
 * 출생일 → 현재 월령 (개월 수, 출산 전이면 음수).
 * 일 단위 정밀도는 무시 (월 단위 매칭이면 충분).
 */
export function calcMonthsOld(birthDate: string): number {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  return months;
}

/**
 * 한 자녀의 월령이 속하는 모든 시기 (버퍼 포함, 복수 매칭 가능).
 */
export function getStagesForChild(birthDate: string): StageCategory[] {
  const months = calcMonthsOld(birthDate);
  return STAGE_RANGES.filter(
    (r) => months >= r.minMonths && months < r.maxMonths
  ).map((r) => r.stage);
}

/**
 * 다둥이 지원 — 모든 자녀의 시기 합집합.
 * 자녀 0명이면 빈 배열 반환 → 호출 측에서 "내 아이" 필터 비활성 처리.
 */
export function getStagesForChildren(
  births: { birth_date: string }[]
): StageCategory[] {
  const all = new Set<StageCategory>();
  for (const child of births) {
    for (const s of getStagesForChild(child.birth_date)) {
      all.add(s);
    }
  }
  return [...all];
}
