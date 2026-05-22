// ============================================
// Analytics Service — 클라이언트에서 호출하는 트래킹 API
// /api/track 으로 fetch 전송 (서버에서 service_role로 events 테이블에 삽입)
// ============================================

const ANON_ID_KEY = "umbba-radar:anon-id";

function isBrowser(): boolean {
  return typeof window !== "undefined";
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
    properties: restProps,
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
