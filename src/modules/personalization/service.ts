// ============================================
// Personalization Service — localStorage 기반 (Phase 1)
// Phase 2에서 Supabase auth.users + user_post_status 테이블로 이관 예정
// 브라우저 전용 — Server Component에서 직접 부르면 안 됨
// ============================================

export type UserPostStatusValue = "applied" | "interested";

const STORAGE_KEY = "umbba-radar:user-post-status";

type StatusMap = Record<string, UserPostStatusValue>;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readMap(): StatusMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as StatusMap;
  } catch {
    return {};
  }
}

function writeMap(map: StatusMap): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    // 같은 탭의 다른 컴포넌트에 변경 통보
    window.dispatchEvent(new CustomEvent("umbba-radar:status-change"));
  } catch {
    // quota 초과 등 무시
  }
}

/** 특정 카드의 현재 상태 (null = 미체크) */
export function getStatus(postId: string): UserPostStatusValue | null {
  const map = readMap();
  return map[postId] ?? null;
}

/** "신청함"으로 표시. 기존 상태가 있으면 덮어씀 */
export function markApplied(postId: string): void {
  const map = readMap();
  map[postId] = "applied";
  writeMap(map);
}

/** "관심"으로 표시 */
export function markInterested(postId: string): void {
  const map = readMap();
  map[postId] = "interested";
  writeMap(map);
}

/** 표시 제거 */
export function unmark(postId: string): void {
  const map = readMap();
  delete map[postId];
  writeMap(map);
}

/** 모든 사용자 체크 상태 (마이페이지용) */
export function listUserPostStatuses(): StatusMap {
  return readMap();
}

/** 상태 변경 구독 (같은 탭 내 동기화) */
export function subscribe(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  const storageListener = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  const customListener = () => listener();
  window.addEventListener("storage", storageListener);
  window.addEventListener("umbba-radar:status-change", customListener);
  return () => {
    window.removeEventListener("storage", storageListener);
    window.removeEventListener("umbba-radar:status-change", customListener);
  };
}
