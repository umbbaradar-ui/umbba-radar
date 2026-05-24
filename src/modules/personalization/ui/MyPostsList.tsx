"use client";

import { useEffect, useMemo, useState } from "react";
import type { Post } from "@/shared/types/post";
import { PostCard } from "@/modules/content/ui/PostCard";
import {
  listUserPostStatuses,
  subscribe,
  type UserPostStatusValue,
} from "../service";

interface Props {
  posts: Post[];
  /** 로그인 사용자면 서버에서 DB로 조회한 statusMap을 prop으로 전달 */
  loggedIn?: boolean;
  initialStatusMap?: Record<string, UserPostStatusValue>;
}

type Tab = UserPostStatusValue;

export function MyPostsList({ posts, loggedIn, initialStatusMap }: Props) {
  const [tab, setTab] = useState<Tab>("interested");
  const [statusMap, setStatusMap] = useState<
    Record<string, UserPostStatusValue>
  >(initialStatusMap ?? {});
  const [hydrated, setHydrated] = useState(Boolean(loggedIn));

  useEffect(() => {
    if (loggedIn) {
      // 서버에서 prop으로 받음
      setHydrated(true);
      return;
    }
    setStatusMap(listUserPostStatuses());
    setHydrated(true);
    const unsub = subscribe(() => setStatusMap(listUserPostStatuses()));
    return unsub;
  }, [loggedIn]);

  const filteredPosts = useMemo(
    () => posts.filter((p) => statusMap[p.id] === tab),
    [posts, statusMap, tab]
  );

  const interestedCount = Object.values(statusMap).filter(
    (s) => s === "interested"
  ).length;
  const appliedCount = Object.values(statusMap).filter(
    (s) => s === "applied"
  ).length;

  return (
    <main className="mx-auto max-w-5xl px-5 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          내가 챙긴 카드
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {loggedIn
            ? "계정에 저장돼요. 다른 기기에서도 동일하게 보입니다."
            : "이 기기에만 저장돼요. 로그인하면 모든 기기에서 동기화됩니다."}
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        <TabButton
          active={tab === "interested"}
          onClick={() => setTab("interested")}
          label="★ 관심"
          count={hydrated ? interestedCount : null}
        />
        <TabButton
          active={tab === "applied"}
          onClick={() => setTab("applied")}
          label="✓ 신청함"
          count={hydrated ? appliedCount : null}
        />
      </div>

      {!hydrated ? (
        <p className="py-20 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : filteredPosts.length === 0 ? (
        <p className="py-20 text-center text-sm text-slate-400">
          {tab === "interested"
            ? "관심으로 표시한 카드가 없어요."
            : "신청함으로 체크한 카드가 없어요."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
      {count !== null && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
