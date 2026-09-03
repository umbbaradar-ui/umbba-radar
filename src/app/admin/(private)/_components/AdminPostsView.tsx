"use client";

// ============================================
// 관리자 카드 목록 — 필터/정렬 클라이언트 즉시 처리
// 서버는 "활성 카드"만 내려주고, 탭·상태·시기·유형·정렬은 여기서 메모리 필터.
// 마감 카드(수천 건)는 마감 탭 진입 시 100건씩 지연 로드 → 초기 로드 최소화.
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  deletePostAction,
  loadExpiredPostsAction,
} from "@/modules/curation/actions";
import {
  STAGE_LABELS,
  TYPE_LABELS,
  ITEM_CATEGORY_LABELS,
  type StageCategory,
  type TypeTag,
  type ItemCategory,
  type PostStatus,
  type Post,
} from "@/shared/types/post";
import { AdminFilterBar, type AdminTab } from "./AdminFilterBar";

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "초안",
  pending: "승인대기",
  published: "발행됨",
  expired: "마감",
};

const STATUS_COLOR: Record<PostStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  expired: "bg-rose-100 text-rose-700",
};

const ACTIVE_STATUSES: PostStatus[] = ["draft", "pending", "published"];

/** 처음 보여줄 행 수 / "더 보기" 1회 증가분 */
const DEFAULT_VISIBLE = 20;
const VISIBLE_STEP = 50;

/** 어드민 검색 정규화 — 운영자 도구라 유저 검색과 달리 본문(body)까지 뒤진다 */
function normSearch(s: string): string {
  return s.toLowerCase().normalize("NFKC");
}

function applyFilters(
  posts: Post[],
  tab: AdminTab,
  status: string,
  stage: string,
  type: string,
  item: string
): Post[] {
  return posts.filter((p) => {
    if (tab === "expired") {
      if (p.status !== "expired") return false;
    } else {
      if (!ACTIVE_STATUSES.includes(p.status)) return false;
    }
    if (tab === "active" && status !== "all" && p.status !== status) return false;
    if (stage !== "all" && !p.stage_categories.includes(stage as StageCategory))
      return false;
    if (type !== "all" && !p.type_tags.includes(type as TypeTag)) return false;
    // item_categories는 022 이전 데이터에서 undefined일 수 있음
    if (
      item !== "all" &&
      !(p.item_categories ?? []).includes(item as ItemCategory)
    )
      return false;
    return true;
  });
}

function applySort(posts: Post[], sort: string): Post[] {
  const arr = [...posts];
  switch (sort) {
    case "deadline_asc":
      arr.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
      break;
    case "deadline_desc":
      arr.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return b.deadline.localeCompare(a.deadline);
      });
      break;
    case "updated_desc":
      arr.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      break;
    case "created_desc":
      arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    case "created_asc":
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
      break;
  }
  return arr;
}

/** 마감 탭 1회 로드 단위 — 서버 액션이 200으로 상한 클램프 */
const EXPIRED_PAGE_SIZE = 100;

interface Props {
  /** 활성(초안·승인대기·발행) 카드 전량 — 마감 카드는 지연 로드 */
  posts: Post[];
  /** 마감 카드 전체 건수 (count=exact) */
  expiredTotal: number;
  initialTab: AdminTab;
  initialStatus: string;
  initialStage: string;
  initialType: string;
  initialItem: string;
  initialSort: string;
}

export function AdminPostsView({
  posts,
  expiredTotal,
  initialTab,
  initialStatus,
  initialStage,
  initialType,
  initialItem,
  initialSort,
}: Props) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [status, setStatus] = useState(initialStatus);
  const [stage, setStage] = useState(initialStage);
  const [type, setType] = useState(initialType);
  const [item, setItem] = useState(initialItem);
  const [sort, setSort] = useState(initialSort);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE);

  // 마감 카드 지연 로드 상태
  const [expiredPosts, setExpiredPosts] = useState<Post[]>([]);
  const [expiredLoading, setExpiredLoading] = useState(false);
  const [expiredDone, setExpiredDone] = useState(expiredTotal === 0);
  const expiredFetching = useRef(false); // StrictMode 이중 실행·연타 가드

  const loadMoreExpired = useCallback(async () => {
    if (expiredFetching.current) return;
    expiredFetching.current = true;
    setExpiredLoading(true);
    try {
      const page = await loadExpiredPostsAction(
        expiredPosts.length,
        EXPIRED_PAGE_SIZE
      );
      if (page.length < EXPIRED_PAGE_SIZE) setExpiredDone(true);
      setExpiredPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.filter((p) => !seen.has(p.id))];
      });
    } finally {
      expiredFetching.current = false;
      setExpiredLoading(false);
    }
  }, [expiredPosts.length]);

  // 마감 탭 첫 진입 시 1페이지 자동 로드 (URL로 바로 진입한 경우 포함)
  useEffect(() => {
    if (tab !== "expired" || expiredDone || expiredPosts.length > 0) return;
    void loadMoreExpired();
  }, [tab, expiredDone, expiredPosts.length, loadMoreExpired]);

  const visiblePosts = tab === "expired" ? expiredPosts : posts;

  const filtered = useMemo(() => {
    let arr = applySort(
      applyFilters(visiblePosts, tab, status, stage, type, item),
      sort
    );
    const q = normSearch(search.trim());
    if (q) {
      arr = arr.filter((p) =>
        [p.title, p.brand_name ?? "", p.search_keywords ?? "", p.body ?? ""].some(
          (f) => normSearch(f).includes(q)
        )
      );
    }
    return arr;
  }, [visiblePosts, tab, status, stage, type, item, sort, search]);

  // 필터·검색·탭이 바뀌면 표시 개수 리셋
  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE);
  }, [tab, status, stage, type, item, sort, search]);

  const shown = filtered.slice(0, visibleCount);

  function handleChange(key: string, value: string | null) {
    if (key === "tab") setTab(value === "expired" ? "expired" : "active");
    else if (key === "status") setStatus(value ?? "all");
    else if (key === "stage") setStage(value ?? "all");
    else if (key === "type") setType(value ?? "all");
    else if (key === "item") setItem(value ?? "all");
    else if (key === "sort") setSort(value ?? "deadline_asc");
  }

  return (
    <>
      <div className="mb-5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 카드 검색 — 제목·브랜드·키워드·본문"
          className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
        />
        <AdminFilterBar
          tab={tab}
          status={status}
          stage={stage}
          type={type}
          item={item}
          sort={sort}
          counts={{ active: posts.length, expired: expiredTotal }}
          onChange={handleChange}
        />
      </div>

      <p className="mb-2 text-xs text-slate-500">
        결과: <strong>{filtered.length}건</strong>
        {filtered.length > shown.length && (
          <span className="ml-1 text-slate-400">(우선 {shown.length}건 표시)</span>
        )}
        {tab === "expired" && !expiredDone && search.trim() !== "" && (
          <span className="ml-1 text-amber-600">· 검색은 로드된 마감 카드 범위만</span>
        )}
        {tab === "expired" && !expiredDone && (
          <span className="ml-1 text-slate-400">
            (마감 {expiredTotal.toLocaleString("ko-KR")}건 중{" "}
            {expiredPosts.length.toLocaleString("ko-KR")}건 로드됨)
          </span>
        )}
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">제목 / 브랜드</th>
              <th className="px-4 py-3 font-medium">시기</th>
              <th className="px-4 py-3 font-medium">유형</th>
              <th className="px-4 py-3 font-medium">마감</th>
              <th className="px-4 py-3 font-medium">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {tab === "expired" && expiredLoading
                    ? "마감 카드 불러오는 중…"
                    : "조건에 맞는 카드가 없어요."}
                </td>
              </tr>
            ) : (
              shown.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[p.status]}`}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="line-clamp-1 font-medium text-slate-900">
                      {p.title}
                    </div>
                    {p.brand_name && (
                      <div className="text-xs text-slate-500">{p.brand_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {p.stage_categories
                      .map((s) => STAGE_LABELS[s] ?? s)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {p.type_tags.map((t) => TYPE_LABELS[t] ?? t).join(", ") || "—"}
                    {(p.item_categories ?? []).length > 0 && (
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {(p.item_categories ?? [])
                          .map((c) => ITEM_CATEGORY_LABELS[c] ?? c)
                          .join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {p.deadline ? (
                      <span
                        className={
                          new Date(p.deadline) < new Date() ? "text-rose-600" : ""
                        }
                      >
                        {new Date(p.deadline).toLocaleDateString("ko-KR", {
                          timeZone: "Asia/Seoul",
                        })}
                        {p.deadline_unknown && (
                          <span className="ml-1 text-amber-600">(추정)</span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/${p.id}/edit`}
                        className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        수정
                      </Link>
                      <form action={deletePostAction.bind(null, p.id, "admin")}>
                        <button
                          type="submit"
                          className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                        >
                          삭제
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 목록은 20건부터 — 나머지는 더 보기 (렌더 부담·스크롤 피로 감소) */}
      {filtered.length > visibleCount && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + VISIBLE_STEP)}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
          >
            더 보기 ({(filtered.length - visibleCount).toLocaleString("ko-KR")}건
            남음)
          </button>
        </div>
      )}

      {/* 마감 탭 — 필요할 때만 100건씩 추가 로드 */}
      {tab === "expired" && expiredPosts.length > 0 && (
        <div className="mt-4 flex justify-center">
          {expiredDone ? (
            <p className="text-xs text-slate-400">
              마감 카드 {expiredPosts.length.toLocaleString("ko-KR")}건 모두
              불러왔어요.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void loadMoreExpired()}
              disabled={expiredLoading}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
            >
              {expiredLoading
                ? "불러오는 중…"
                : `더 불러오기 (${expiredPosts.length.toLocaleString("ko-KR")}/${expiredTotal.toLocaleString("ko-KR")})`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
