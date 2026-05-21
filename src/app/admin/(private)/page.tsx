// ============================================
// 관리자 대시보드 — /admin
// 모든 카드 리스트, 상태별 정렬, 빠른 액션
// ============================================

import Link from "next/link";
import { listAllPosts } from "@/modules/curation/service";
import { deletePostAction } from "@/modules/curation/actions";
import { STAGE_LABELS, TYPE_LABELS } from "@/shared/types/post";
import type { PostStatus } from "@/shared/types/post";

interface PageProps {
  searchParams: Promise<{ ok?: string }>;
}

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

export const dynamic = "force-dynamic";

export default async function AdminDashboard({ searchParams }: PageProps) {
  const { ok } = await searchParams;
  const posts = await listAllPosts();

  const counts = posts.reduce<Record<PostStatus, number>>(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    { draft: 0, pending: 0, published: 0, expired: 0 }
  );

  const okMessage =
    ok === "created"
      ? "카드가 새로 등록됐어요."
      : ok === "updated"
        ? "수정이 반영됐어요."
        : ok === "deleted"
          ? "카드가 삭제됐어요."
          : null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      {okMessage && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {okMessage}
        </div>
      )}

      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            카드 관리
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            전체 {posts.length}건 · 발행 {counts.published} · 초안 {counts.draft}{" "}
            · 승인대기 {counts.pending} · 마감 {counts.expired}
          </p>
        </div>
        <Link
          href="/admin/new"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          + 새 카드
        </Link>
      </header>

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
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  등록된 카드가 없어요.
                </td>
              </tr>
            ) : (
              posts.map((p) => (
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
                    {p.type_tags.map((t) => TYPE_LABELS[t] ?? t).join(", ") ||
                      "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {p.deadline
                      ? new Date(p.deadline).toLocaleDateString("ko-KR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/${p.id}/edit`}
                        className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        수정
                      </Link>
                      <form action={deletePostAction.bind(null, p.id)}>
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
    </main>
  );
}
