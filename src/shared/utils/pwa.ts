// ============================================
// PWA 설치 감지 — 모든 진입점 공통 유틸
//
// 단순히 display-mode: standalone만 보면 데스크탑 Chrome PWA가 누락됨.
// (window-controls-overlay, minimal-ui 등으로 뜨는 경우 있음)
//
// 3중 안전망:
//   1. display-mode 매치 (가장 정확)
//   2. iOS Safari navigator.standalone (홈 화면 추가)
//   3. localStorage 플래그 (appinstalled 이벤트 받은 적 있음 — 폴백)
// ============================================

const INSTALLED_KEY = "umbba-pwa-installed";

const PWA_DISPLAY_MODES = [
  "standalone",
  "fullscreen",
  "minimal-ui",
  "window-controls-overlay",
] as const;

/** PWA로 실행 중인지 종합 감지 */
export function isPWAInstalled(): boolean {
  if (typeof window === "undefined") return false;

  // 1. display-mode 매치
  for (const mode of PWA_DISPLAY_MODES) {
    try {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) return true;
    } catch {
      // matchMedia 미지원 환경 (구형 브라우저) — 무시하고 다음 체크로
    }
  }

  // 2. iOS Safari (홈 화면 추가된 상태)
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;

  // 3. 로컬 플래그 — 이전에 설치 완료 신호 받은 적 있음
  // 같은 도메인 localStorage는 PWA·브라우저 컨텍스트 공유 → 안전망 작동
  try {
    if (localStorage.getItem(INSTALLED_KEY) === "1") return true;
  } catch {
    // private mode 등 localStorage 미지원 — 무시
  }

  return false;
}

/** appinstalled 이벤트에서 호출 — 다음 방문에서도 PWA로 인식되도록 */
export function markPWAInstalled(): void {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // 무시 (private mode 등)
  }
}
