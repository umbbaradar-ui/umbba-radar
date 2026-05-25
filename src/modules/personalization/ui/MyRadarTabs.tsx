"use client";

// ============================================
// 내 레이더 — 3탭 UI (관심 / 신청함 / 과거)
//
// - 관심: published 카드 중 사용자가 관심 표시
// - 신청함: published 카드 중 사용자가 신청 표시 (격려 카피)
// - 과거: expired 카드 중 사용자가 관심/신청 표시했던 것 (월별 그룹핑)
//
// 로그인: 서버에서 받은 statusMap 사용
// 비로그인: localStorage statusMap (subscribe로 실시간 동기화)
// ============================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Post } from "@/shared/types/post";
import { PostCard } from "@/modules/content/ui/PostCard";
import {
  listUserPostStatuses,
  subscribe,
  type UserPostStatusValue,
} from "../service";

type Tab = "interested" | "applied" | "past";

interface Props {
  /** 발행 중인 카드 — 관심·신청 탭 대상 */
  activePosts: Post[];
  /** 마감된 카드 — 과거 탭 대상 */
  expiredPosts: Post[];
  loggedIn?: boolean;
  initialStatusMap?: Record<string, UserPostStatusValue>;
}

export function MyRadarTabs({
  activePosts,
  expiredPosts,
  loggedIn,
  initialStatusMap,
}: Props) {
  const [tab, setTab] = useState<Tab>("interested");
  const [statusMap, setStatusMap] = useState<
    Record<string, UserPostStatusValue>
  >(initialStatusMap ?? {});
  const [hydrated, setHydrated] = useState(Boolean(loggedIn));

  useEffect(() => {
    if (loggedIn) {
      setHydrated(true);
      return;
    }
    setStatusMap(listUserPostStatuses());
    setHydrated(true);
    const unsub = subscribe(() => setStatusMap(listUserPostStatuses()));
    return unsub;
  }, [loggedIn]);

  // 탭별 카운트
  const interestedCount = useMemo(
    () => activePosts.filter((p) => statusMap[p.id] === "interested").length,
    [activePosts, statusMap]
  );
  const appliedCount = useMemo(
    () => activePosts.filter((p) => statusMap[p.id] === "applied").length,
    [activePosts, statusMap]
  );
  const pastCount = useMemo(
    () =>
      expiredPosts.filter(
        (p) => statusMap[p.id] === "interested" || statusMap[p.id] === "applied"
      ).length,
    [expiredPosts, statusMap]
  );

  // 탭별 표시 카드
  const interestedPosts = useMemo(
    () => activePosts.filter((p) => statusMap[p.id] === "interested"),
    [activePosts, statusMap]
  );
  const appliedPosts = useMemo(
    () => activePosts.filter((p) => statusMap[p.id] === "applied"),
    [activePosts, statusMap]
  );

  // 과거 — 월별 그룹핑
  const pastByMonth = useMemo(() => {
    const filtered = expiredPosts.filter(
      (p) => statusMap[p.id] === "interested" || statusMap[p.id] === "applied"
    );
    const groups = new Map<string, Post[]>();
    for (const p of filtered) {
      // 마감일 기준 월 (없으면 created_at)
      const ref = p.deadline ?? p.created_at;
      const d = new Date(ref);
      const key = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return Array.from(groups.entries()).sort((a, b) =>
      b[0].localeCompare(a[0])
    );
  }, [expiredPosts, statusMap]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          🐻 내 레이더
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {loggedIn
            ? "계정에 저장돼요 · 다른 기기에서도 동일하게 보입니다."
            : "이 기기에만 저장돼요 · 로그인하면 모든 기기에서 동기화됩니다."}
        </p>
      </header>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabButton
          active={tab === "interested"}
          onClick={() => setTab("interested")}
          label="관심"
          count={hydrated ? interestedCount : null}
        />
        <TabButton
          active={tab === "applied"}
          onClick={() => setTab("applied")}
          label="신청함"
          count={hydrated ? appliedCount : null}
        />
        <TabButton
          active={tab === "past"}
          onClick={() => setTab("past")}
          label="과거 레이더"
          count={hydrated ? pastCount : null}
        />
      </div>

      {!hydrated ? (
        <p className="py-20 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : tab === "interested" ? (
        <InterestedView posts={interestedPosts} />
      ) : tab === "applied" ? (
        <AppliedView posts={appliedPosts} />
      ) : (
        <PastView byMonth={pastByMonth} statusMap={statusMap} />
      )}
    </main>
  );
}

// ============================================
// 관심 탭
// ============================================
function InterestedView({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <EmptyState
        emoji="⭐"
        title="찜한 카드가 아직 없어요"
        description="마음에 드는 카드에 '관심'을 누르면 마감 임박 시 알림으로 알려드려요."
      />
    );
  }
  return (
    <>
      <NoticeBar
        tone="amber"
        text="찜한 카드 · 마감 임박 시 알림으로 알려드려요 🔔"
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </>
  );
}

// ============================================
// 신청함 탭
// ============================================
function AppliedView({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <EmptyState
        emoji="📝"
        title="신청한 카드가 아직 없어요"
        description="신청 완료한 카드를 '신청함'으로 표시하면 여기서 모아볼 수 있어요."
      />
    );
  }
  return (
    <>
      <NoticeBar tone="rose" text="신청 완료! 좋은 결과를 바라요 ♥" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </>
  );
}

// ============================================
// 과거 레이더 탭 — 월별 그룹핑
// ============================================
function PastView({
  byMonth,
  statusMap,
}: {
  byMonth: Array<[string, Post[]]>;
  statusMap: Record<string, UserPostStatusValue>;
}) {
  if (byMonth.length === 0) {
    return (
      <EmptyState
        emoji="📅"
        title="과거 신청·관심 이력이 없어요"
        description="마감된 카드 중 관심·신청 표시했던 것이 월별로 정리됩니다."
      />
    );
  }
  return (
    <div className="space-y-6">
      {byMonth.map(([month, posts]) => (
        <section key={month}>
          <h2 className="mb-2 text-sm font-bold text-slate-700">
            {month}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {posts.length}건
            </span>
          </h2>
          <ul className="space-y-1.5">
            {posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/post/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 transition hover:bg-slate-50"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      statusMap[p.id] === "applied"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {statusMap[p.id] === "applied" ? "신청" : "관심"}
                  </span>
                  <div className="min-w-0 flex-1">
                    {p.brand_name && (
                      <p className="truncate text-[10px] text-rose-600">
                        {p.brand_name}
                      </p>
                    )}
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {p.title}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ============================================
// 공통 컴포넌트
// ============================================
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
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
      {count !== null && count > 0 && (
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

function NoticeBar({
  tone,
  text,
}: {
  tone: "amber" | "rose";
  text: string;
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-800"
      : "bg-rose-50 text-rose-800";
  return (
    <div
      className={`mb-4 rounded-xl px-3.5 py-2.5 text-xs font-medium ${toneClass}`}
    >
      {text}
    </div>
  );
}

function EmptyState({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-2xl">
        {emoji}
      </div>
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
