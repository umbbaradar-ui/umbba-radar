"use client";

// ============================================
// 헤더 우측 알림 벨 — 미읽음 카운트 배지 + /notifications 링크
//
// 미읽음 = localStorage `umbba-notif-last-seen` 이후 created된 매칭 카드 수
// 서버에서 받은 latestEventAt(가장 최근 알림 시간)과 비교해 배지 노출 결정.
//
// 동작:
//   - latestEventAt > lastSeen → 빨간 점(또는 카운트) 노출
//   - 클릭 → /notifications 페이지 이동 → 페이지가 lastSeen 갱신
// ============================================

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "umbba-notif-last-seen";

interface Props {
  /** 가장 최근 알림 발생 시간 (ISO). 없으면 배지 안 보임 */
  latestEventAt: string | null;
  /** 데스크탑 = 큰 벨, 모바일 = 작은 벨 */
  variant?: "desktop" | "mobile";
}

export function NotificationBell({ latestEventAt, variant = "desktop" }: Props) {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!latestEventAt) {
      setHasUnread(false);
      return;
    }
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (!lastSeen) {
        setHasUnread(true);
        return;
      }
      setHasUnread(new Date(latestEventAt).getTime() > new Date(lastSeen).getTime());
    } catch {
      setHasUnread(false);
    }
  }, [latestEventAt]);

  const sizeClass =
    variant === "desktop"
      ? "h-9 w-9"
      : "h-8 w-8";
  const iconSize = variant === "desktop" ? 18 : 16;

  return (
    <Link
      href="/notifications"
      aria-label="알림 모아보기"
      className={`relative flex ${sizeClass} items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-rose-600`}
    >
      <BellIcon size={iconSize} />
      {hasUnread && (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"
        />
      )}
    </Link>
  );
}

function BellIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
