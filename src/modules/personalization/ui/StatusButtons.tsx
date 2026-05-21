"use client";

import { useEffect, useState } from "react";
import {
  getStatus,
  markApplied,
  markInterested,
  unmark,
  subscribe,
  type UserPostStatusValue,
} from "../service";

interface Props {
  postId: string;
}

export function StatusButtons({ postId }: Props) {
  const [status, setStatus] = useState<UserPostStatusValue | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStatus(getStatus(postId));
    setHydrated(true);
    const unsub = subscribe(() => setStatus(getStatus(postId)));
    return unsub;
  }, [postId]);

  function toggle(target: UserPostStatusValue) {
    if (status === target) {
      unmark(postId);
      setStatus(null);
    } else {
      if (target === "applied") markApplied(postId);
      else markInterested(postId);
      setStatus(target);
    }
  }

  // 하이드레이션 전엔 비활성 상태로 출력 (서버/클라 불일치 방지)
  const appliedActive = hydrated && status === "applied";
  const interestedActive = hydrated && status === "interested";

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => toggle("interested")}
        aria-pressed={interestedActive}
        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition ${
          interestedActive
            ? "border-amber-400 bg-amber-100 text-amber-900"
            : "border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50"
        }`}
      >
        {interestedActive ? "★ 관심" : "☆ 관심"}
      </button>
      <button
        type="button"
        onClick={() => toggle("applied")}
        aria-pressed={appliedActive}
        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition ${
          appliedActive
            ? "border-rose-400 bg-rose-100 text-rose-900"
            : "border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50"
        }`}
      >
        {appliedActive ? "✓ 신청함" : "신청함 체크"}
      </button>
    </div>
  );
}
