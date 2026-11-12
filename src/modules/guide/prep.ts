// ============================================
// 막달 준비 구간 — 출산 예정일로 등록한 자녀가 임신 32주 0일 ~ 출산 예정일 전날이면 true
//
// 엄빠레이더에는 '출산 예정일 기준 할 일' 결과 화면이 따로 없다. 예정일을 아는 곳은
// 자녀 정보(children.birth_date, 출산 전이면 예정일)뿐이라 홈 마이레이더에서 이 구간에만
// 출산 준비물 체크리스트 한 줄을 띄운다(C219). 순수 함수 — 서버·클라이언트 어디서나 쓴다.
//
// 임신 주수: 예정일 = 40주 0일. 32주 0일 = 예정일 56일 전.
//   남은 날(D) = 예정일 − 오늘(KST 달력).  1 ≤ D ≤ 56  →  32주 0일 ~ 39주 6일.
//   (32~36주 할 일 구간을 포함하고, 그 뒤 막달까지 이어서 보인다. 예정일 당일부터는 숨긴다.)
// ============================================

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const PREP_WINDOW_DAYS = 56;

/** "YYYY-MM-DD"(또는 ISO) → KST 달력 날짜의 UTC 자정 ms */
function kstDay(value: string | Date): number | null {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00+09:00` : value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
}

/** 예정일까지 남은 날(KST 달력 기준). 날짜가 이상하면 null */
export function daysUntilDue(dueDate: string, now: Date = new Date()): number | null {
  const due = kstDay(dueDate);
  const today = kstDay(now);
  if (due === null || today === null) return null;
  return Math.round((due - today) / DAY_MS);
}

/** 자녀 중 하나라도 막달 준비 구간(임신 32주 0일 ~ 예정일 전날)이면 true */
export function isInBirthPrepWindow(
  births: { birth_date: string }[],
  now: Date = new Date()
): boolean {
  return births.some((c) => {
    const d = daysUntilDue(c.birth_date, now);
    return d !== null && d >= 1 && d <= PREP_WINDOW_DAYS;
  });
}
