"use client";

// ============================================
// Service Worker 등록 — 첫 마운트 시 한 번
// Chrome의 PWA 설치 프롬프트(beforeinstallprompt) 조건 충족용.
// dev 환경에선 HMR 충돌 가능성 있어 production에서만 등록.
// ============================================

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // dev에선 SW가 HMR과 충돌해서 페이지가 stale해질 수 있음. production만.
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (process.env.NEXT_PUBLIC_SW_DEBUG === "1") {
          console.log("[SW] registered:", reg.scope);
        }
      })
      .catch((err) => {
        console.warn("[SW] registration failed:", err);
      });
  }, []);

  return null;
}
