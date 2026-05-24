// ============================================
// D-day 계산 — KST(한국시간) 달력 날짜 기준
//
// ❌ 잘못된 방식: Math.ceil((deadline - now) / 86400000)
//    → "오늘 14:00 + 내일 23:00 마감" 같은 케이스가 1.4일 → D-2 로 오인됨
//
// ✅ 올바른 방식: KST 자정 기준 캘린더 날짜 차이
//    → 오늘이든 어제든 자정으로 정렬해서 빼면 진짜 "며칠 남았는지"
// ============================================

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 해당 시점의 KST 기준 자정 시각 (UTC 밀리초로 환산) */
function kstMidnight(date: Date): number {
  const kstShifted = new Date(date.getTime() + KST_OFFSET_MS);
  return Date.UTC(
    kstShifted.getUTCFullYear(),
    kstShifted.getUTCMonth(),
    kstShifted.getUTCDate()
  );
}

export interface DDay {
  label: string;
  urgent: boolean;
  days: number; // 음수: 마감, 0: D-Day, 양수: D-N
}

export function calcDDay(deadline: string | null): DDay | null {
  if (!deadline) return null;

  const todayKST = kstMidnight(new Date());
  const deadlineKST = kstMidnight(new Date(deadline));

  const days = Math.round((deadlineKST - todayKST) / DAY_MS);

  if (days < 0) return { label: "마감", urgent: false, days };
  if (days === 0) return { label: "D-Day", urgent: true, days };
  return { label: `D-${days}`, urgent: days <= 3, days };
}
