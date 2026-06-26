"use client";

// ============================================
// DiscoveryView — 메인 카드 그리드 (클라이언트 즉시 필터)
// 서버는 발행 카드 전부 + 검색(q) 결과만 내려주고,
// 시기·유형·주제·정렬은 여기서 메모리 필터 → 클릭 시 서버 왕복 0회 (즉시 반응).
// ============================================

import { useEffect, useMemo, useState } from "react";
import type { Post, StageCategory } from "@/shared/types/post";
import type { SortMode } from "@/modules/content/service";
import { filterPosts, sortPosts } from "@/modules/discovery/service";
import { FilterBar } from "./FilterBar";
import { OnboardingHint } from "./OnboardingHint";
import { PostCard } from "@/modules/content/ui/PostCard";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";
import {
  listUserPostStatuses,
  subscribe,
  type UserPostStatusValue,
} from "@/modules/personalization/service";

/** "오늘의 스캔" 배너 요약 (서버에서 계산해 내려줌) */
export interface ScanSummary {
  newToday: number;
  matchingTotal: number;
  closingToday: number;
}

interface Props {
  posts: Post[];
  q: string;
  initialStage: string;
  initialType: string;
  initialTopic: string;
  initialSort: SortMode;
  myChildStages: StageCategory[];
  hasChildren: boolean;
  scan: ScanSummary;
  /** 로그인 사용자면 true (상태 소스: 서버 DB vs localStorage 결정) */
  loggedIn?: boolean;
  /** 로그인 사용자의 서버 체크 상태 맵 (비로그인은 클라이언트에서 localStorage로 채움) */
  initialStatusMap?: Record<string, UserPostStatusValue>;
}

export function DiscoveryView({
  posts,
  q,
  initialStage,
  initialType,
  initialTopic,
  initialSort,
  myChildStages,
  hasChildren,
  scan,
  loggedIn,
  initialStatusMap,
}: Props) {
  const [stage, setStage] = useState(initialStage);
  const [type, setType] = useState(initialType);
  const [topic, setTopic] = useState(initialTopic);
  const [sort, setSort] = useState<SortMode>(initialSort);

  // 사용자 체크 상태 (관심/신청) — 로그인: 서버 statusMap, 비로그인: localStorage
  const [statusMap, setStatusMap] = useState<
    Record<string, UserPostStatusValue>
  >(initialStatusMap ?? {});
  const [statusHydrated, setStatusHydrated] = useState(Boolean(loggedIn));

  useEffect(() => {
    if (loggedIn) {
      setStatusHydrated(true);
      return;
    }
    // 비로그인 — localStorage에서 읽고 변경 구독 (StatusButtons 토글 즉시 반영)
    setStatusMap(listUserPostStatuses());
    setStatusHydrated(true);
    const unsub = subscribe(() => setStatusMap(listUserPostStatuses()));
    return unsub;
  }, [loggedIn]);

  const shown = useMemo(
    () =>
      sortPosts(
        filterPosts(posts, { stage, type, topic, myChildStages }),
        sort
      ),
    [posts, stage, type, topic, sort, myChildStages]
  );

  // "신청함" 표시한 카드는 그리드 맨 뒤로 (기존 정렬은 유지, applied만 후순위로 분리).
  // 하이드레이션 전에는 원본 순서 유지 → 서버/클라 첫 렌더 일치(깜빡임·mismatch 방지).
  const ordered = useMemo(() => {
    if (!statusHydrated) return shown;
    const rest: Post[] = [];
    const applied: Post[] = [];
    for (const p of shown) {
      (statusMap[p.id] === "applied" ? applied : rest).push(p);
    }
    return rest.concat(applied);
  }, [shown, statusMap, statusHydrated]);

  const filterActive = stage !== "all" || type !== "all" || topic !== "all";

  function handleFilterChange(
    key: "stage" | "type" | "topic" | "sort",
    value: string
  ) {
    if (key === "stage") setStage(value);
    else if (key === "type") setType(value);
    else if (key === "topic") setTopic(value);
    else if (key === "sort") setSort(value as SortMode);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* "오늘의 스캔" 배너 — daily loop 시각화(곰 마스코트). 검색 중엔 숨김 */}
      {!q && <TodayScanBanner scan={scan} hasChildren={hasChildren} />}

      <header className="mb-5">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          놓치는 혜택은 없게
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          오늘의 협찬·체험단·후기를 한눈에 · {shown.length}건
          {q && ` · "${q}" 검색 결과`}
          {stage === "my_child" && hasChildren && " · 내 아이 맞춤"}
        </p>
      </header>

      {/* 자녀 미등록 사용자에게 맞춤 추천 가치 안내 (검색 중이 아닐 때만) */}
      {!hasChildren && !q && <OnboardingHint />}

      <AdSlot id="top_banner" />

      <div className="mb-6">
        <FilterBar
          stage={stage}
          type={type}
          topic={topic}
          sort={sort}
          q={q}
          hasChildren={hasChildren}
          onFilterChange={handleFilterChange}
        />
      </div>

      {filterActive && <AdSlot id="category_top" context={{ stage, type }} />}

      {shown.length === 0 ? (
        <p className="py-20 text-center text-sm text-slate-400">
          {q
            ? `"${q}" 검색 결과가 없어요. 다른 키워드로 시도해보세요.`
            : stage === "my_child"
              ? "내 아이 시기에 맞는 카드가 아직 없어요. 다른 필터를 시도해보세요."
              : "조건에 맞는 카드가 없어요. 필터를 바꿔보세요."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              status={statusHydrated ? statusMap[post.id] ?? null : null}
            />
          ))}
        </div>
      )}
    </main>
  );
}

/**
 * 홈 상단 "오늘의 스캔" 배너 — 곰이 매일 스캔한다는 daily loop 정체성.
 * 새로 들어온 건수(가변 보상) + 오늘 마감 건수(손실회피)를 한 줄로.
 */
function TodayScanBanner({
  scan,
  hasChildren,
}: {
  scan: ScanSummary;
  hasChildren: boolean;
}) {
  const headline =
    scan.newToday > 0
      ? hasChildren
        ? `오늘 우리 아이 맞춤 ${scan.newToday}건 새로 떴어요 🎉`
        : `오늘 새로 ${scan.newToday}건 스캔했어요`
      : "엄빠 대신 매일 혜택 스캔 중 ♥";

  const subline = hasChildren
    ? `우리 아이 맞춤 혜택 ${scan.matchingTotal}건을 챙기고 있어요`
    : "매일 새 혜택을 자동으로 모으고 있어요";

  return (
    <section
      data-tutorial="scan-banner"
      className="mb-5 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="shrink-0 text-2xl leading-none">
          🐻
        </span>
        <div className="min-w-0 flex-1">
          {/* truncate 금지 — 모바일 좁은 폭에서 헤드라인이 잘리지 않게 줄바꿈 허용 */}
          <p className="text-sm font-bold leading-snug text-rose-700">
            {headline}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{subline}</p>
        </div>
      </div>
      {/* 마감 칩은 별도 줄 — 헤드라인 가로폭을 뺏지 않도록(모바일 잘림 방지) */}
      {scan.closingToday > 0 && (
        <div className="mt-2">
          <span className="inline-block rounded-full bg-rose-500 px-2.5 py-1 text-xs font-bold text-white">
            ⏰ 오늘 마감 {scan.closingToday}건
          </span>
        </div>
      )}
    </section>
  );
}
