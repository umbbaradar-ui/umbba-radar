"use client";

// ============================================
// 알림 페이지 진입 시 lastSeen 갱신
// → NotificationBell의 빨간 점 사라짐
// ============================================

import { useEffect } from "react";

const STORAGE_KEY = "umbba-notif-last-seen";

interface Props {
  latestEventAt: string;
}

export function NotificationSeenMarker({ latestEventAt }: Props) {
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, latestEventAt);
    } catch {
      // private mode 등 무시
    }
  }, [latestEventAt]);

  return null;
}
