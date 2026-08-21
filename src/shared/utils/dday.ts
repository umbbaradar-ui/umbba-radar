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
  if (days === 0) return { label: "마감일!", urgent: true, days };
  return { label: `D-${days}`, urgent: days <= 3, days };
}

/**
 * deadline의 KST 캘린더 날짜가 오늘(KST)보다 "이전"이면 true.
 * = 화면에서 "마감"으로 보이는 상태(calcDDay days < 0)와 정확히 동일 기준.
 * 마감일 당일(D-Day)은 아직 마감 아님(false).
 * deadline 없으면(상시) false.
 */
export function isPastDeadline(deadline: string | null): boolean {
  const d = calcDDay(deadline);
  return d !== null && d.days < 0;
}

/**
 * 오늘(KST) 00:00에 해당하는 UTC 순간의 ISO 문자열.
 * DB 쿼리용 — `deadline >= 이 값`이면 "오늘 KST 또는 미래" = 아직 마감 안 됨.
 * `deadline < 이 값`이면 KST 날짜가 어제 이하 = 진짜 마감(피드 제외·expired 대상).
 * calcDDay의 캘린더-날짜 기준과 일치시켜 시각(instant) 비교의 1일 오차를 없앤다.
 */
export function kstTodayStartIso(): string {
  const nowKstShifted = new Date(Date.now() + KST_OFFSET_MS);
  const kstMidnightAsUtc = Date.UTC(
    nowKstShifted.getUTCFullYear(),
    nowKstShifted.getUTCMonth(),
    nowKstShifted.getUTCDate()
  );
  // kstMidnightAsUtc는 "KST 자정을 UTC인 척" 표현한 값 → 실제 UTC 순간으로 환산
  return new Date(kstMidnightAsUtc - KST_OFFSET_MS).toISOString();
}

/**
 * 해당 시각의 **KST 달력 날짜 키** (`YYYY-MM-DD`).
 * 일별 고유 방문자·활동일수 집계용 — UTC로 자르면 KST 09:00 이전 활동이
 * 전날로 밀려 DAU가 요일 경계에서 어긋난다.
 */
export function kstDayKey(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(t.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 해당 시각이 속한 **KST 주(월요일 시작)의 시작 날짜 키** (`YYYY-MM-DD`).
 * 코호트 리텐션 표에서 가입 주차를 묶는 용도.
 */
export function kstWeekKey(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso) : iso;
  const shifted = new Date(t.getTime() + KST_OFFSET_MS);
  // getUTCDay(): 0=일 … 6=토 → 월요일 시작으로 보정
  const backToMonday = (shifted.getUTCDay() + 6) % 7;
  shifted.setUTCDate(shifted.getUTCDate() - backToMonday);
  return shifted.toISOString().slice(0, 10);
}
