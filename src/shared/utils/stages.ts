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
 * 시기별 월령 범위 (코어 ± 버퍼).
 * 음수 = 출산 전 (예정일 기준).
 * 인접 시기와 겹치는 부분 = 자연스러운 전환 영역.
 *
 * 원칙: 시기 길이가 길수록 버퍼도 커짐 (경계 모호함 비례).
 *
 *   시기       | 코어 범위        | 버퍼   | 최종 (개월)
 *   -----------|-----------------|--------|------------
 *   임신중     | 출산 전 ~ 0     | —      | -10 ~ 0
 *   신생아     | 0~3개월         | -1~+3개월 | -1 ~ 6  ← 출산 1개월 전(막달)부터
 *   영아       | 3~12개월        | ±3개월 | 3 ~ 15
 *   유아       | 1~7세 (12~84)   | ±6개월 | 6 ~ 90
 *   초등생     | 7~13세 (84~156) | ±12개월| 72 ~ 168
 *   전연령     | (월령 매칭 X)   | —      | —
 *
 * 전환 영역 (겹침):
 *   임신중↔신생아: -1~0개월 (막달 — 임신중+신생아 둘 다 매칭)
 *   신생아↔영아: 3~6개월
 *   영아↔유아:   6~15개월 (1세 전후)
 *   유아↔초등생: 72~90개월 (6세~7세 6개월, 초등 입학 시기)
 *
 * 신생아 출산 전 버퍼 -1개월 (2026-06-22 변경):
 *   출산 임박(막달, D-30 이내) 부모는 신생아 용품을 미리 준비·신청하므로
 *   출산 1개월 전부터 신생아 카드 노출. 그 이전(-2개월~) 임신부는 pregnancy만.
 *   ※ "이미 태어난 아기 필수" 카드는 막달엔 신청 불가일 수 있으나, 미리 찜·준비
 *      가치가 더 커서 -1개월만 허용(그 이상 출산 전은 X).
 */
export const STAGE_RANGES: StageRange[] = [
  { stage: "pregnancy", minMonths: -10, maxMonths: 0 },
  { stage: "newborn", minMonths: -1, maxMonths: 6 }, // 출산 1개월 전(막달)부터 노출
  { stage: "infant", minMonths: 3, maxMonths: 15 },
  { stage: "toddler", minMonths: 6, maxMonths: 90 }, // 코어 1~7세 + ±6개월
  { stage: "elementary", minMonths: 72, maxMonths: 168 }, // 코어 7~13세 + ±12개월
];

/**
 * 출생일 → 현재 월령 (개월 수, 출산 전이면 음수).
 * 일 단위 정밀도는 무시 (월 단위 매칭이면 충분).
 */
export function calcMonthsOld(birthDate: string): number {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  // 일(day) 보정 — 아직 그 달의 'day'에 도달 못 했으면 1개월 덜 산 것.
  // (예: 오늘 6/14, 예정일 6/30 → 0이 아니라 -1 = 임신중. '임신부에게 신생아 카드' 오매칭 방지)
  if (now.getDate() < birth.getDate()) months -= 1;
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
