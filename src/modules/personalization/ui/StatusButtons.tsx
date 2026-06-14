"use client";

import { useEffect, useState } from "react";
import {
  getStatus as getLocalStatus,
  markApplied as markLocalApplied,
  markInterested as markLocalInterested,
  unmark as unmarkLocal,
  subscribe,
  type UserPostStatusValue,
} from "../service";
import { markStatusAction, unmarkStatusAction } from "../actions";
import { track } from "@/modules/analytics/service";

interface Props {
  postId: string;
  /** 로그인 사용자면 true. 서버 컴포넌트에서 결정해서 prop으로 전달 */
  loggedIn?: boolean;
  /** 로그인 사용자면 서버에서 DB 조회 후 초기값 */
  initialStatus?: UserPostStatusValue | null;
}

export function StatusButtons({ postId, loggedIn, initialStatus }: Props) {
  const [status, setStatus] = useState<UserPostStatusValue | null>(
    initialStatus ?? null
  );
  const [hydrated, setHydrated] = useState(Boolean(loggedIn));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loggedIn) {
      // 서버에서 prop으로 initialStatus 받음. 별도 hydration 불필요
      setHydrated(true);
      return;
    }
    // 로그아웃 모드 — localStorage
    setStatus(getLocalStatus(postId));
    setHydrated(true);
    const unsub = subscribe(() => setStatus(getLocalStatus(postId)));
    return unsub;
  }, [postId, loggedIn]);

  async function toggle(target: UserPostStatusValue) {
    const isUnmark = status === target;
    let succeeded = false;

    if (loggedIn) {
      setPending(true);
      try {
        const prev = status;
        // 낙관적 업데이트
        setStatus(isUnmark ? null : target);
        const result = isUnmark
          ? await unmarkStatusAction(postId)
          : await markStatusAction(postId, target);
        if (!result.ok) {
          // 롤백
          setStatus(prev);
        } else {
          succeeded = true;
        }
      } finally {
        setPending(false);
      }
    } else {
      if (isUnmark) {
        unmarkLocal(postId);
        setStatus(null);
      } else {
        if (target === "applied") markLocalApplied(postId);
        else markLocalInterested(postId);
        setStatus(target);
      }
      succeeded = true;
    }

    // 실제로 반영된 경우에만 이벤트 기록 (DB 실패·롤백 시 status_mark가 KPI를 부풀리는 것 방지)
    if (!succeeded) return;
    if (isUnmark) {
      track("status_unmark", { post_id: postId, previous: target });
    } else {
      track("status_mark", { post_id: postId, status: target });
    }
  }

  const appliedActive = hydrated && status === "applied";
  const interestedActive = hydrated && status === "interested";

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
      <button
        type="button"
        onClick={() => toggle("interested")}
        disabled={pending}
        aria-pressed={interestedActive}
        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-60 ${
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
        disabled={pending}
        aria-pressed={appliedActive}
        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-60 ${
          appliedActive
            ? "border-rose-400 bg-rose-100 text-rose-900"
            : "border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50"
        }`}
      >
        {appliedActive ? "✓ 신청함" : "신청함 체크"}
      </button>
      </div>
      {hydrated && !loggedIn && (
        <p className="text-center text-[11px] text-slate-400">
          이 기기에만 저장돼요 · 로그인하면 모든 기기에 동기화 ♥
        </p>
      )}
    </div>
  );
}
