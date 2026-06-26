"use client";

// ============================================
// 관리자 카드 목록 — 필터/정렬 클라이언트 즉시 처리
// 서버는 전체 카드만 내려주고, 탭·상태·시기·유형·정렬은 여기서 메모리 필터.
// → 필터 클릭 시 서버 왕복 0회 (즉시 반응).
// ============================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { deletePostAction } from "@/modules/curation/actions";
import {
  STAGE_LABELS,
  TYPE_LABELS,
  type StageCategory,
  type TypeTag,
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

function applyFilters(
  posts: Post[],
  tab: AdminTab,
  status: string,
  stage: string,
  type: string
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

interface Props {
  posts: Post[];
  initialTab: AdminTab;
  initialStatus: string;
  initialStage: string;
  initialType: string;
  initialSort: string;
}

export function AdminPostsView({
  posts,
  initialTab,
  initialStatus,
  initialStage,
  initialType,
  initialSort,
}: Props) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [status, setStatus] = useState(initialStatus);
  const [stage, setStage] = useState(initialStage);
  const [type, setType] = useState(initialType);
  const [sort, setSort] = useState(initialSort);

  const activeCount = useMemo(
    () => posts.filter((p) => ACTIVE_STATUSES.includes(p.status)).length,
    [posts]
  );
  const expiredCount = useMemo(
    () => posts.filter((p) => p.status === "expired").length,
    [posts]
  );

  const filtered = useMemo(
    () => applySort(applyFilters(posts, tab, status, stage, type), sort),
    [posts, tab, status, stage, type, sort]
  );

  function handleChange(key: string, value: string | null) {
    if (key === "tab") setTab(value === "expired" ? "expired" : "active");
    else if (key === "status") setStatus(value ?? "all");
    else if (key === "stage") setStage(value ?? "all");
    else if (key === "type") setType(value ?? "all");
    else if (key === "sort") setSort(value ?? "deadline_asc");
  }

  return (
    <>
      <div className="mb-5">
        <AdminFilterBar
          tab={tab}
          status={status}
          stage={stage}
          type={type}
          sort={sort}
          counts={{ active: activeCount, expired: expiredCount }}
          onChange={handleChange}
        />
      </div>

      <p className="mb-2 text-xs text-slate-500">
        결과: <strong>{filtered.length}건</strong>
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
                  조건에 맞는 카드가 없어요.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
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
    </>
  );
}
