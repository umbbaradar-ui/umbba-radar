// ============================================
// Analytics Service — 클라이언트에서 호출하는 트래킹 API
// /api/track 으로 fetch 전송 (서버에서 service_role로 events 테이블에 삽입)
// ============================================

const ANON_ID_KEY = "umbba-radar:anon-id";
const SURFACE_KEY = "umbba-radar:surface";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * 유입 표면 감지 — 채널별 리텐션·전환 측정용 (2026-08 플레이 출시 대비).
 *   twa     : 구글 플레이 앱(TWA) — 최초 문서 referrer에 android-app:// 마커
 *   pwa     : 홈 화면 설치(안드로이드 PWA·iOS 홈화면 추가) — standalone 표시 모드
 *   browser : 일반 브라우저
 *
 * TWA 마커는 앱 실행 첫 내비게이션에만 찍히고 이후 풀 리로드(OAuth 복귀 등)에서
 * 사라지므로, 최초 감지값을 sessionStorage에 고정해 세션 내내 유지한다.
 */
function getSurface(): string {
  if (!isBrowser()) return "server";
  try {
    const stored = sessionStorage.getItem(SURFACE_KEY);
    if (stored) return stored;
    let surface = "browser";
    if (document.referrer.startsWith("android-app://com.umbba_radar.twa")) {
      surface = "twa";
    } else if (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as { standalone?: boolean }).standalone === true
    ) {
      surface = "pwa";
    }
    sessionStorage.setItem(SURFACE_KEY, surface);
    return surface;
  } catch {
    return "browser";
  }
}

function getAnonId(): string {
  if (!isBrowser()) return "";
  try {
    let id = window.localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export interface TrackProperties {
  post_id?: string;
  [key: string]: unknown;
}

/**
 * 이벤트 트래킹. 실패는 UX를 깨지 않게 조용히 무시.
 *
 * @example
 *   track('card_click', { post_id: 'abc-123' })
 *   track('source_link_click', { post_id: 'abc-123', source_url: 'https://...' })
 *   track('status_mark', { post_id: 'abc-123', status: 'applied' })
 *   track('filter_change', { stage: 'newborn', type: 'all' })
 *   track('login_attempt', { provider: 'google' })
 */
export function track(event_name: string, properties: TrackProperties = {}): void {
  if (!isBrowser()) return;

  const post_id = properties.post_id ?? null;
  const { post_id: _omit, ...restProps } = properties;
  void _omit;

  const payload = JSON.stringify({
    event_name,
    anon_id: getAnonId(),
    post_id,
    // surface는 모든 이벤트에 자동 첨부 (호출부가 명시하면 그 값이 우선)
    properties: { surface: getSurface(), ...restProps },
  });

  // sendBeacon이 가능하면 페이지 이동 직전에도 안전하게 전송
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/track", blob);
      if (ok) return;
    } catch {
      // fallthrough to fetch
    }
  }

  // fetch fallback
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // 무시
    });
  } catch {
    // 무시
  }
}
