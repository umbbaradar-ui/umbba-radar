// ============================================
// Service Worker — PWA 설치 + Web Push 핸들러
//
// 책임:
//   1. (PWA) install/activate/fetch 핸들러로 Chrome PWA 설치 프롬프트 자격 충족
//   2. (PUSH) push 이벤트 → showNotification, notificationclick → 카드 페이지 이동
//
// 발송 payload 형식 (서버 측 push-service.ts와 합의):
//   {
//     title: string,
//     body: string,
//     url?: string,        // 클릭 시 이동할 경로 (예: "/post/abc-123")
//     tag?: string,        // 같은 tag면 새 알림이 기존 알림 대체 (중복 방지)
//   }
// ============================================

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Stage 1: 별도 캐싱·인터셉트 없음. 이 빈 핸들러가 있어야 Chrome이 PWA로 인정.
});

// ============================================
// Push 이벤트 — 서버에서 web-push로 보낸 메시지 수신
// ============================================
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // 빈 push (구독 keepalive) 또는 malformed → 기본 알림 안 띄움
    return;
  }

  const title = payload.title || "엄빠레이더";
  const body = payload.body || "새 알림이 도착했어요";
  const url = payload.url || "/notifications";
  const tag = payload.tag || "umbba-radar-default";

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png", // Android 상태바 모노 아이콘
    tag, // 같은 tag면 기존 알림 대체 — 중복 방지
    renotify: false, // 같은 tag 갱신 시 진동·소리 재울림 X
    data: { url },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================
// 알림 클릭 — 이미 열린 탭이 있으면 focus + navigate, 없으면 새 탭
// ============================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 같은 origin 탭이 이미 있으면 focus + 해당 URL로 navigate
        for (const client of clientList) {
          if ("focus" in client) {
            try {
              client.navigate(targetUrl);
            } catch {
              // 일부 브라우저는 cross-origin navigate 차단 — focus만
            }
            return client.focus();
          }
        }
        // 열린 탭 없으면 새로 오픈
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
