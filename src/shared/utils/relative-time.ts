// ============================================
// 상대 시간 표시 — "3시간 전", "어제", "5월 20일" 등
// KST 기준
// ============================================

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - target;

  // 미래 시점 (이벤트 등록 시간이 시계와 일치 안 할 때)
  if (diff < 0) return "방금 전";

  if (diff < MINUTE_MS) return "방금 전";
  if (diff < HOUR_MS) {
    const m = Math.floor(diff / MINUTE_MS);
    return `${m}분 전`;
  }
  if (diff < DAY_MS) {
    const h = Math.floor(diff / HOUR_MS);
    return `${h}시간 전`;
  }
  if (diff < 7 * DAY_MS) {
    const d = Math.floor(diff / DAY_MS);
    return d === 1 ? "어제" : `${d}일 전`;
  }

  // 7일 이상 → 절대 날짜 (KST)
  const KST_OFFSET = 9 * HOUR_MS;
  const kst = new Date(target + KST_OFFSET);
  const m = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  // 올해면 월·일만, 작년 이전은 연도까지
  const kstNow = new Date(now + KST_OFFSET);
  if (kst.getUTCFullYear() !== kstNow.getUTCFullYear()) {
    return `${kst.getUTCFullYear()}.${m}.${d}`;
  }
  return `${m}월 ${d}일`;
}
