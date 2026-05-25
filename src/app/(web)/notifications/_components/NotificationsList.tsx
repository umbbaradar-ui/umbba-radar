"use client";

// ============================================
// 알림 리스트 — 본/안 본 항목 구분 + lastSeen 갱신
//
// 동작:
//   1) mount 시 기존 lastSeen 캡처 → 그보다 새로운 eventAt 항목은 "안 본 것"
//   2) 직후 lastSeen을 latestEventAt으로 갱신 → 다음 진입 시 모두 "본 것"
//   3) NotificationBell의 빨간 점도 자연스럽게 사라짐 (벨이 같은 lastSeen 비교)
//
// 본 항목: opacity-60 으로 페이드. 강조 색은 추가하지 않음 (시각 노이즈 최소).
// ============================================

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Post } from "@/shared/types/post";
import { STAGE_LABELS } from "@/shared/types/post";
import { getStageVisual } from "@/shared/utils/stage-visuals";
import { formatRelativeTime } from "@/shared/utils/relative-time";
import { calcDDay } from "@/shared/utils/dday";

const STORAGE_KEY = "umbba-notif-last-seen";

export interface NotificationData {
  kind: "new_match" | "deadline_soon";
  post: Post;
  eventAt: string;
  reason?: string;
}

interface Props {
  notifications: NotificationData[];
  /** 가장 최근 알림 시간 — 새 lastSeen 으로 저장됨 */
  latestEventAt: string | null;
}

export function NotificationsList({ notifications, latestEventAt }: Props) {
  // SSR/hydration 단계엔 빈 set → 모든 항목이 "본 것" 으로 잠깐 보였다가
  // useEffect 돌면 unread 강조됨. 깜빡임은 매우 짧음.
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let lastSeenMs = 0;
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v) lastSeenMs = new Date(v).getTime();
    } catch {
      // private mode 등 무시
    }

    const next = new Set<string>();
    for (const n of notifications) {
      const evMs = new Date(n.eventAt).getTime();
      if (lastSeenMs === 0 || evMs > lastSeenMs) {
        next.add(makeId(n));
      }
    }
    setUnreadIds(next);

    if (latestEventAt) {
      try {
        localStorage.setItem(STORAGE_KEY, latestEventAt);
      } catch {
        // 무시
      }
    }
  }, [notifications, latestEventAt]);

  return (
    <ul className="space-y-2">
      {notifications.map((n, idx) => {
        const id = makeId(n);
        return (
          <NotificationItem
            key={`${id}-${idx}`}
            item={n}
            isUnread={unreadIds.has(id)}
          />
        );
      })}
    </ul>
  );
}

function makeId(n: NotificationData): string {
  return `${n.kind}-${n.post.id}`;
}

function NotificationItem({
  item,
  isUnread,
}: {
  item: NotificationData;
  isUnread: boolean;
}) {
  const visual = getStageVisual(item.post.stage_categories);
  const isUrgent = item.kind === "deadline_soon";
  const dday = calcDDay(item.post.deadline);
  const primaryStageLabel =
    item.post.stage_categories
      .filter((s) => s !== "all_ages")
      .map((s) => STAGE_LABELS[s])[0] ?? "전연령";

  return (
    <li className={isUnread ? "" : "opacity-60"}>
      <Link
        href={`/post/${item.post.id}`}
        className={`flex items-start gap-3 rounded-2xl border bg-white p-3.5 transition hover:bg-slate-50 ${
          isUrgent ? "border-rose-200" : "border-slate-100"
        }`}
      >
        {/* 좌측: 시기 이모지 */}
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${visual.bgClass} text-xl`}
        >
          <span aria-hidden="true">{visual.emoji}</span>
        </div>

        {/* 우측: 정보 */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {item.post.brand_name && (
                <p className="truncate text-[11px] font-semibold text-rose-600">
                  {item.post.brand_name}
                </p>
              )}
              <p className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
                {item.post.title}
              </p>
            </div>
            {dday && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  dday.urgent
                    ? "bg-rose-500 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {dday.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {isUrgent ? (
              <span className="font-semibold text-rose-600">
                ⚠️ {item.reason}
              </span>
            ) : (
              <span className={visual.accentClass}>
                {primaryStageLabel} 시기 신규
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTime(item.eventAt)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}
