"use client";

// ============================================
// 메인 페이지 필터 + 검색 + 정렬
// ============================================

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  STAGE_LABELS,
  ACTIVE_STAGE_CATEGORIES,
  TYPE_LABELS,
  ACTIVE_TYPE_TAGS,
  TOPIC_LABELS,
  ACTIVE_TOPIC_CATEGORIES,
} from "@/shared/types/post";
import { track } from "@/modules/analytics/service";

interface Props {
  stage: string;
  type: string;
  topic: string;
  sort: string;
  q: string;
  /** 자녀 등록된 사용자만 true → "내 아이" pill 노출 */
  hasChildren?: boolean;
  /** "오늘 등록"만 보기 활성 여부 (정렬행 pill active 표시용) */
  todayOnly?: boolean;
  /** 있으면 시기·유형·주제·정렬을 URL 이동 없이 즉시(클라이언트 상태) 변경.
   *  없으면 기존처럼 URL 이동(서버 재요청). 검색(q)은 항상 URL 이동. */
  onFilterChange?: (
    key: "stage" | "type" | "topic" | "sort",
    value: string
  ) => void;
}

export function FilterBar({
  stage,
  type,
  topic,
  sort,
  q,
  hasChildren,
  todayOnly,
  onFilterChange,
}: Props) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(q);

  function buildUrl(overrides: Partial<Record<string, string>>) {
    const current = { stage, type, topic, sort, q, ...overrides };
    const params = new URLSearchParams();
    // stage: 자녀 있는 사용자는 "all" 도 URL 에 명시해야 디폴트(my_child) fallback 무력화됨
    // 자녀 없는 사용자는 "all" 이 진짜 디폴트라 URL 에서 생략
    if (
      current.stage &&
      (current.stage !== "all" || hasChildren)
    ) {
      params.set("stage", current.stage);
    }
    if (current.type && current.type !== "all") params.set("type", current.type);
    if (current.topic && current.topic !== "all") params.set("topic", current.topic);
    if (current.sort && current.sort !== "deadline_asc") params.set("sort", current.sort);
    if (current.q && current.q.trim()) params.set("q", current.q.trim());
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  function update(
    key: "stage" | "type" | "topic" | "sort",
    value: string
  ) {
    track("filter_change", { key, value, stage, type, topic, sort, q });
    if (onFilterChange) {
      // 클라이언트 즉시 필터 — URL 이동·서버 재요청 없음
      onFilterChange(key, value);
    } else {
      router.push(buildUrl({ [key]: value }));
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchInput.trim();
    track("search", { q: trimmed });
    router.push(buildUrl({ q: trimmed }));
  }

  function clearSearch() {
    setSearchInput("");
    router.push(buildUrl({ q: "" }));
  }

  return (
    <div className="space-y-3">
      {/* 검색바 */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div data-tutorial="search" className="relative flex-1">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="브랜드·키워드 검색"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-sm outline-none focus:border-rose-400"
          />
          <button
            type="submit"
            aria-label="검색"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-500"
          >
            <SearchIcon />
          </button>
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
              aria-label="검색어 지우기"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {/* 정렬 (+ "오늘 등록"은 오늘 등록분만 보기 토글) */}
      <PillRow label="정렬">
        <Pill
          active={!todayOnly && (sort === "deadline_asc" || !sort)}
          onClick={() => update("sort", "deadline_asc")}
        >
          마감 임박순
        </Pill>
        <Pill
          active={!todayOnly && sort === "created_desc"}
          onClick={() => update("sort", "created_desc")}
        >
          최신 등록순
        </Pill>
        <Pill
          active={Boolean(todayOnly)}
          onClick={() => update("sort", "today")}
        >
          오늘 등록
        </Pill>
      </PillRow>

      {/* 시기 */}
      <PillRow label="시기" anchor="filter-pills">
        <Pill active={stage === "all"} onClick={() => update("stage", "all")}>
          전체
        </Pill>
        {hasChildren && (
          <Pill
            active={stage === "my_child"}
            onClick={() => update("stage", "my_child")}
          >
            💛 내 아이
          </Pill>
        )}
        {ACTIVE_STAGE_CATEGORIES.map((k) => (
          <Pill key={k} active={stage === k} onClick={() => update("stage", k)}>
            {STAGE_LABELS[k]}
          </Pill>
        ))}
      </PillRow>

      {/* 주제 */}
      <PillRow label="주제">
        <Pill active={topic === "all"} onClick={() => update("topic", "all")}>
          전체
        </Pill>
        {ACTIVE_TOPIC_CATEGORIES.map((k) => (
          <Pill
            key={k}
            active={topic === k}
            onClick={() => update("topic", k)}
          >
            {TOPIC_LABELS[k]}
          </Pill>
        ))}
      </PillRow>

      {/* 유형 */}
      <PillRow label="유형">
        <Pill active={type === "all"} onClick={() => update("type", "all")}>
          전체
        </Pill>
        {ACTIVE_TYPE_TAGS.map((k) => (
          <Pill key={k} active={type === k} onClick={() => update("type", k)}>
            {TYPE_LABELS[k]}
          </Pill>
        ))}
      </PillRow>
    </div>
  );
}

function PillRow({
  label,
  anchor,
  children,
}: {
  label: string;
  /** 온보딩 튜토리얼 앵커(data-tutorial) — 없으면 미설정 */
  anchor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <div
        data-tutorial={anchor}
        className="flex flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
