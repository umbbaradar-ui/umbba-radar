// ============================================
// 튜토리얼 "봤음" 영속 — localStorage (브라우저 전용)
// personalization/service.ts 의 isBrowser + try/catch 가드 패턴을 복제.
// MVP는 기기 단위(localStorage)만. 로그인 사용자별 서버 플래그(Supabase)는
// 배포 시 후속(마이그레이션 필요).
// ============================================

import { TUTORIAL_VERSION } from "./config/steps";

const SEEN_KEY = "umbba-radar:tutorial-seen";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** 이번(또는 그 이상) 버전 튜토리얼을 이미 본 적 있으면 true */
export function hasSeenTutorial(): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (raw == null) return false;
    const seenVersion = Number(raw);
    return Number.isFinite(seenVersion) && seenVersion >= TUTORIAL_VERSION;
  } catch {
    // private mode·quota 등 → 그냥 "안 봤음" 취급(한 번 더 보여주는 게 안전)
    return false;
  }
}

/** 튜토리얼 완료/건너뛰기 시 호출 */
export function markTutorialSeen(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(SEEN_KEY, String(TUTORIAL_VERSION));
  } catch {
    // 무시
  }
}
