"use client";

// ============================================
// ExploreView — 탐색 화면 (/explore)
// 2026-07 홈 개편: 전체 그리드·검색·필터가 홈에서 여기로 분리됨.
//
// - 필터 pill 4행 → sticky 컨트롤바 1행(필터 버튼 + 활성 칩 + 정렬)
// - 필터 바텀시트: 시기·유형 다중선택 + 주제 + "N건 보기" 실시간 건수 CTA
// - 전 필터 상태 URL 동기화(history.replaceState) → 상세 복귀·새로고침·공유 보존
// - 그리드 24장 청크 렌더 + 무한스크롤(IntersectionObserver, '더 보기' 폴백)
// - 0건 빈 상태: 어떤 필터를 풀지 원탭 제안
// - 검색·필터 전부 인메모리(현 규모 ≤300건) — 발행 1,000건 도달 시 서버 keyset 전환
// ============================================

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Post, StageCategory } from "@/shared/types/post";
import {
  STAGE_LABELS,
  TYPE_LABELS,
  TOPIC_LABELS,
  ACTIVE_STAGE_CATEGORIES,
  ACTIVE_TYPE_TAGS,
  ACTIVE_TOPIC_CATEGORIES,
} from "@/shared/types/post";
import { PostCard } from "@/modules/content/ui/PostCard";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";
import { sortPosts } from "@/modules/discovery/service";
import type { SortMode } from "@/modules/content/service";
import { track } from "@/modules/analytics/service";
import {
  listUserPostStatuses,
  subscribe,
  type UserPostStatusValue,
} from "@/modules/personalization/service";

interface Props {
  posts: Post[];
  loggedIn: boolean;
  hasChildren: boolean;
  myChildStages: StageCategory[];
  statusMap: Record<string, UserPostStatusValue>;
  todayStartIso: string;
  initialQ: string;
  initialStages: string[];
  initialTypes: string[];
  initialTopic: string;
  initialSort: SortMode;
  initialToday: boolean;
  autoFocusSearch?: boolean;
}

interface FilterState {
  q: string;
  stages: string[]; // StageCategory 또는 'my_child'(단독)
  types: string[];
  topic: string; // 'all' | TopicCategory
  today: boolean;
}

const CHUNK = 24;

function normText(s: string): string {
  return s.toLowerCase().normalize("NFKC");
}

export function ExploreView({
  posts,
  loggedIn,
  hasChildren,
  myChildStages,
  statusMap: serverStatusMap,
  todayStartIso,
  initialQ,
  initialStages,
  initialTypes,
  initialTopic,
  initialSort,
  initialToday,
  autoFocusSearch,
}: Props) {
  const [filters, setFilters] = useState<FilterState>({
    q: initialQ,
    stages: initialStages,
    types: initialTypes,
    topic: initialTopic,
    today: initialToday,
  });
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CHUNK);
  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 체크 상태 — 로그인: 서버 맵, 비로그인: localStorage
  const [statusMap, setStatusMap] = useState(serverStatusMap);
  const [statusHydrated, setStatusHydrated] = useState(loggedIn);
  useEffect(() => {
    if (loggedIn) {
      setStatusHydrated(true);
      return;
    }
    setStatusMap(listUserPostStatuses());
    setStatusHydrated(true);
    const unsub = subscribe(() => setStatusMap(listUserPostStatuses()));
    return unsub;
  }, [loggedIn]);

  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus();
  }, [autoFocusSearch]);

  // URL 동기화 — 서버 왕복 없이 주소만 갱신 (뒤로가기·공유·새로고침 보존)
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.q.trim()) p.set("q", filters.q.trim());
    if (filters.stages.length) p.set("stage", filters.stages.join(","));
    if (filters.types.length) p.set("type", filters.types.join(","));
    if (filters.topic !== "all") p.set("topic", filters.topic);
    if (sort !== "deadline_asc") p.set("sort", sort);
    if (filters.today) p.set("today", "1");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }, [filters, sort]);

  // 필터 적용 (다중선택 지원 — 기존 filterPosts는 단일선택이라 여기서 확장)
  function applyFilters(list: Post[], f: FilterState): Post[] {
    let out = list;
    const q = normText(f.q.trim());
    if (q) {
      out = out.filter((p) =>
        [p.title, p.brand_name ?? "", p.body ?? "", p.search_keywords ?? ""]
          .some((field) => normText(field).includes(q))
      );
    }
    if (f.stages.includes("my_child")) {
      out = out.filter(
        (p) =>
          p.stage_categories.some((s) => myChildStages.includes(s)) ||
          p.stage_categories.includes("all_ages")
      );
    } else if (f.stages.length > 0) {
      // 특정 시기 선택 시 전연령 카드 포함 (기존 단일선택 규칙 유지)
      out = out.filter(
        (p) =>
          p.stage_categories.some((s) => f.stages.includes(s)) ||
          p.stage_categories.includes("all_ages")
      );
    }
    if (f.types.length > 0) {
      out = out.filter((p) => p.type_tags.some((t) => f.types.includes(t)));
    }
    if (f.topic !== "all") {
      out = out.filter((p) => p.topic === f.topic);
    }
    if (f.today) {
      out = out.filter((p) => p.created_at >= todayStartIso);
    }
    return out;
  }

  const shown = useMemo(
    () =>
      sortPosts(
        applyFilters(posts, filters),
        filters.today ? "created_desc" : sort
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, filters, sort, myChildStages, todayStartIso]
  );

  // 신청함 카드는 맨 뒤로 (기존 홈과 동일 규칙)
  const ordered = useMemo(() => {
    if (!statusHydrated) return shown;
    const rest: Post[] = [];
    const applied: Post[] = [];
    for (const p of shown) {
      (statusMap[p.id] === "applied" ? applied : rest).push(p);
    }
    return rest.concat(applied);
  }, [shown, statusMap, statusHydrated]);

  // 필터 변경 시 청크 리셋
  useEffect(() => {
    setVisibleCount(CHUNK);
  }, [filters, sort]);

  // 무한스크롤 — 센티널 관찰, 실패 시 '더 보기' 버튼 폴백
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((n) => Math.min(n + CHUNK, ordered.length));
        }
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ordered.length]);

  const activeFilterCount =
    (filters.stages.length > 0 ? 1 : 0) +
    (filters.types.length > 0 ? 1 : 0) +
    (filters.topic !== "all" ? 1 : 0) +
    (filters.today ? 1 : 0);

  function removeStage(v: string) {
    setFilters((f) => ({ ...f, stages: f.stages.filter((s) => s !== v) }));
  }
  function removeType(v: string) {
    setFilters((f) => ({ ...f, types: f.types.filter((t) => t !== v) }));
  }
  function resetFilters() {
    setFilters((f) => ({ ...f, stages: [], types: [], topic: "all", today: false }));
  }

  const cardStatus = (id: string) =>
    statusHydrated ? statusMap[id] ?? null : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-4">
      {/* 상단: 뒤로 + 검색 */}
      <div className="mb-3 flex items-center gap-2">
        <Link
          href="/"
          aria-label="홈으로"
          className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
        >
          ←
        </Link>
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            track("search", { q: filters.q.trim(), surface: "test_explore" });
            searchRef.current?.blur();
          }}
        >
          <input
            ref={searchRef}
            type="search"
            value={filters.q}
            onChange={(e) =>
              setFilters((f) => ({ ...f, q: e.target.value }))
            }
            placeholder="브랜드·키워드 검색"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-sm outline-none focus:border-rose-400"
          />
          <button
            type="submit"
            aria-label="검색"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400"
          >
            🔍
          </button>
          {filters.q && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => setFilters((f) => ({ ...f, q: "" }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
            >
              ✕
            </button>
          )}
        </form>
      </div>

      {/* sticky 컨트롤바 — 스크롤 어디서든 필터·정렬 접근 */}
      {/* 모바일 미니헤더 실측 57px + 노치 안전영역(pt-safe) 아래에 붙임 */}
      <div className="sticky top-[calc(57px+env(safe-area-inset-top))] z-30 -mx-4 mb-4 border-b border-slate-100 bg-white/90 px-4 py-2 backdrop-blur md:top-[61px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              activeFilterCount > 0
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            ⚙ 필터
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* 활성 필터 칩 (개별 해제) */}
          <div className="flex flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.stages.map((s) => (
              <FilterChip
                key={s}
                label={s === "my_child" ? "💛 내 아이" : STAGE_LABELS[s as StageCategory] ?? s}
                onRemove={() => removeStage(s)}
              />
            ))}
            {filters.types.map((t) => (
              <FilterChip
                key={t}
                label={TYPE_LABELS[t as keyof typeof TYPE_LABELS] ?? t}
                onRemove={() => removeType(t)}
              />
            ))}
            {filters.topic !== "all" && (
              <FilterChip
                label={TOPIC_LABELS[filters.topic as keyof typeof TOPIC_LABELS] ?? filters.topic}
                onRemove={() => setFilters((f) => ({ ...f, topic: "all" }))}
              />
            )}
            {filters.today && (
              <FilterChip
                label="오늘 등록"
                onRemove={() => setFilters((f) => ({ ...f, today: false }))}
              />
            )}
          </div>

          {/* 정렬 토글 (마감 임박순 ↔ 최신 등록순) */}
          {!filters.today && (
            <button
              type="button"
              onClick={() => {
                const next: SortMode =
                  sort === "deadline_asc" ? "created_desc" : "deadline_asc";
                setSort(next);
                track("filter_change", {
                  key: "sort",
                  value: next,
                  surface: "test_explore",
                });
              }}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
            >
              {sort === "deadline_asc" ? "마감 임박순" : "최신 등록순"} ⇅
            </button>
          )}
        </div>
      </div>

      {/* 결과 헤더 */}
      <p className="mb-3 text-xs text-slate-500">
        {filters.q ? `"${filters.q}" 검색 결과 · ` : ""}
        {shown.length}건
        {filters.today && " · 오늘 등록"}
      </p>

      {/* 필터 적용 시 광고 슬롯 (기존 홈의 category_top 자리 승계, Phase 1 = null) */}
      {activeFilterCount > 0 && (
        <AdSlot
          id="category_top"
          context={{ stage: filters.stages[0], type: filters.types[0] }}
        />
      )}

      {/* 그리드 */}
      {ordered.length === 0 ? (
        <EmptyState filters={filters} onRemoveStage={removeStage} onRemoveType={removeType} onReset={resetFilters} onClearQ={() => setFilters((f) => ({ ...f, q: "" }))} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {ordered.slice(0, visibleCount).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                status={cardStatus(post.id)}
              />
            ))}
          </div>
          {visibleCount < ordered.length && (
            <div className="py-6 text-center">
              <div ref={sentinelRef} aria-hidden />
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((n) => Math.min(n + CHUNK, ordered.length))
                }
                className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
              >
                더 보기 ({ordered.length - visibleCount}건 남음)
              </button>
            </div>
          )}
        </>
      )}

      {/* 필터 바텀시트 */}
      {sheetOpen && (
        <FilterSheet
          posts={posts}
          filters={filters}
          hasChildren={hasChildren}
          applyFiltersFn={applyFilters}
          onApply={(next) => {
            setFilters(next);
            setSheetOpen(false);
            track("filter_change", {
              key: "sheet_apply",
              value: JSON.stringify({
                stages: next.stages,
                types: next.types,
                topic: next.topic,
                today: next.today,
              }),
              surface: "test_explore",
            });
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </main>
  );
}

// ── 부품 ─────────────────────────────────────

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200"
    >
      {label} <span aria-hidden className="text-rose-400">✕</span>
    </button>
  );
}

function EmptyState({
  filters,
  onRemoveStage,
  onRemoveType,
  onReset,
  onClearQ,
}: {
  filters: FilterState;
  onRemoveStage: (v: string) => void;
  onRemoveType: (v: string) => void;
  onReset: () => void;
  onClearQ: () => void;
}) {
  // 마지막에 푸는 걸 제안할 필터들 — 유형 → 시기 → 검색어 순으로 완화 제안
  const suggestions: Array<{ label: string; action: () => void }> = [];
  for (const t of filters.types) {
    suggestions.push({
      label: `'${TYPE_LABELS[t as keyof typeof TYPE_LABELS] ?? t}' 빼고 보기`,
      action: () => onRemoveType(t),
    });
  }
  for (const s of filters.stages) {
    if (s === "my_child") continue;
    suggestions.push({
      label: `'${STAGE_LABELS[s as StageCategory] ?? s}' 빼고 보기`,
      action: () => onRemoveStage(s),
    });
  }
  if (filters.q.trim()) {
    suggestions.push({ label: "검색어 지우고 보기", action: onClearQ });
  }

  return (
    <div className="py-16 text-center">
      <p className="text-sm text-slate-400">이 조합은 0건이에요 🐻</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {suggestions.slice(0, 3).map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.action}
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onReset}
          className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white"
        >
          필터 초기화
        </button>
      </div>
    </div>
  );
}

/** 필터 바텀시트 — 다중선택 + 실시간 "N건 보기" CTA */
function FilterSheet({
  posts,
  filters,
  hasChildren,
  applyFiltersFn,
  onApply,
  onClose,
}: {
  posts: Post[];
  filters: FilterState;
  hasChildren: boolean;
  applyFiltersFn: (list: Post[], f: FilterState) => Post[];
  onApply: (next: FilterState) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterState>(filters);

  // 시트 열려있는 동안 배경 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const count = useMemo(
    () => applyFiltersFn(posts, draft).length,
    [posts, draft, applyFiltersFn]
  );

  function toggleStage(v: string) {
    setDraft((d) => {
      if (v === "my_child") {
        // 💛 내 아이는 단독 선택 (자녀 시기 합집합이라 다른 시기와 조합 불필요)
        return { ...d, stages: d.stages.includes("my_child") ? [] : ["my_child"] };
      }
      const without = d.stages.filter((s) => s !== "my_child");
      return {
        ...d,
        stages: without.includes(v)
          ? without.filter((s) => s !== v)
          : [...without, v],
      };
    });
  }
  function toggleType(v: string) {
    setDraft((d) => ({
      ...d,
      types: d.types.includes(v)
        ? d.types.filter((t) => t !== v)
        : [...d.types, v],
    }));
  }

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label="필터"
    >
      {/* 딤 배경 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      {/* 시트 */}
      <div className="absolute inset-x-0 bottom-0 flex max-h-[78vh] flex-col rounded-t-3xl bg-white">
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden />
        <div className="flex-1 overflow-y-auto px-5 pb-3 pt-3">
          {/* 시기 — 다중선택 */}
          <SheetSection label="시기" hint="여러 개 선택할 수 있어요">
            {hasChildren && (
              <SheetChip
                active={draft.stages.includes("my_child")}
                onClick={() => toggleStage("my_child")}
              >
                💛 내 아이
              </SheetChip>
            )}
            {ACTIVE_STAGE_CATEGORIES.map((s) => (
              <SheetChip
                key={s}
                active={draft.stages.includes(s)}
                onClick={() => toggleStage(s)}
              >
                {STAGE_LABELS[s]}
              </SheetChip>
            ))}
          </SheetSection>

          {/* 유형 — 다중선택 */}
          <SheetSection label="유형" hint="여러 개 선택할 수 있어요">
            {ACTIVE_TYPE_TAGS.map((t) => (
              <SheetChip
                key={t}
                active={draft.types.includes(t)}
                onClick={() => toggleType(t)}
              >
                {TYPE_LABELS[t]}
              </SheetChip>
            ))}
          </SheetSection>

          {/* 주제 — 단일 */}
          <SheetSection label="주제">
            <SheetChip
              active={draft.topic === "all"}
              onClick={() => setDraft((d) => ({ ...d, topic: "all" }))}
            >
              전체
            </SheetChip>
            {ACTIVE_TOPIC_CATEGORIES.map((t) => (
              <SheetChip
                key={t}
                active={draft.topic === t}
                onClick={() => setDraft((d) => ({ ...d, topic: t }))}
              >
                {TOPIC_LABELS[t]}
              </SheetChip>
            ))}
          </SheetSection>

          {/* 오늘 등록 */}
          <SheetSection label="기간">
            <SheetChip
              active={draft.today}
              onClick={() => setDraft((d) => ({ ...d, today: !d.today }))}
            >
              오늘 등록만
            </SheetChip>
          </SheetSection>
        </div>

        {/* 하단 고정 CTA */}
        <div className="flex shrink-0 items-center gap-3 border-t border-slate-100 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                stages: [],
                types: [],
                topic: "all",
                today: false,
              }))
            }
            className="shrink-0 px-2 py-2 text-xs font-bold text-slate-400"
          >
            초기화
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => onApply(draft)}
            className={`flex-1 rounded-2xl py-3.5 text-sm font-bold text-white transition ${
              count === 0 ? "bg-slate-300" : "bg-rose-500 hover:bg-rose-600"
            }`}
          >
            {count === 0 ? "조건을 하나 풀어보세요" : `${count}건 보기`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SheetSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 flex items-baseline gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {hint && <span className="text-[10px] text-slate-300">{hint}</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function SheetChip({
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
      className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
