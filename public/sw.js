// ============================================
// Service Worker — Stage 1: PWA 설치 프롬프트 조건 충족용 최소 구현
// Chrome은 fetch 핸들러가 있는 SW가 등록되어야 beforeinstallprompt를 발화함.
// 오프라인 캐싱·푸시 알림 핸들러는 Stage 2에서 추가 예정.
// ============================================

self.addEventListener("install", () => {
  // 새 버전 즉시 활성화 (대기 안 함)
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 새 SW가 모든 열린 탭을 즉시 제어하도록
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Stage 1에서는 별도 캐싱·인터셉트 없음 (네트워크 그대로).
  // 이 빈 핸들러가 있어야 Chrome이 PWA로 인정해서 설치 프롬프트를 띄움.
});
