// ============================================
// 관리자 대시보드 — /admin
// 카드 목록 + 필터 (탭/상태/시기/유형) + 정렬 (마감일/등록일)
// URL searchParams 기반 → 새로고침·즐겨찾기 안전
// ============================================

import Link from "next/link";
import { listAllPosts, getCounts, getPipelineStats } from "@/modules/curation/service";
import { deletePostAction } from "@/modules/curation/actions";
import { PipelineDashboard } from "./_components/PipelineDashboard";
import {
  STAGE_LABELS,
  TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  type StageCategory,
  type TypeTag,
  type PostStatus,
  type Post,
} from "@/shared/types/post";
import { AdminFilterBar, type AdminTab } from "./_components/AdminFilterBar";

interface PageProps {
  searchParams: Promise<{
    ok?: string;
    tab?: string;
    status?: string;
    stage?: string;
    type?: string;
    sort?: string;
  }>;
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

const ACTIVE_STATUSES: PostStatus[] = ["draft", "pending", "published"];

function normalizeTab(raw: string | undefined): AdminTab {
  return raw === "expired" ? "expired" : "active";
}

function normalizeStatus(raw: string | undefined): string {
  if (raw && ["published", "pending", "draft"].includes(raw)) return raw;
  return "all";
}

function normalizeStage(raw: string | undefined): string {
  const valid: StageCategory[] = [
    "pregnancy",
    "newborn",
    "infant",
    "toddler",
    "elementary",
    "all_ages",
  ];
  if (raw && (valid as string[]).includes(raw)) return raw;
  return "all";
}

function normalizeType(raw: string | undefined): string {
  const valid: TypeTag[] = [
    "regram",
    "experience",
    "kids_model",
    "supporters",
    "form",
  ];
  if (raw && (valid as string[]).includes(raw)) return raw;
  return "all";
}

function normalizeSort(raw: string | undefined): string {
  const valid = [
    "deadline_asc",
    "deadline_desc",
    "updated_desc",
    "created_desc",
    "created_asc",
  ];
  if (raw && valid.includes(raw)) return raw;
  return "deadline_asc";
}

function applyFilters(
  posts: Post[],
  tab: AdminTab,
  status: string,
  stage: string,
  type: string
): Post[] {
  return posts.filter((p) => {
    // 탭 분리
    if (tab === "expired") {
      if (p.status !== "expired") return false;
    } else {
      if (!ACTIVE_STATUSES.includes(p.status)) return false;
    }
    // 상태 필터 (활성 탭에서만 의미)
    if (tab === "active" && status !== "all" && p.status !== status) return false;
    // 시기
    if (stage !== "all" && !p.stage_categories.includes(stage as StageCategory))
      return false;
    // 유형
    if (type !== "all" && !p.type_tags.includes(type as TypeTag)) return false;
    return true;
  });
}

function applySort(posts: Post[], sort: string): Post[] {
  const arr = [...posts];
  switch (sort) {
    case "deadline_asc":
      // 마감 임박순: null (deadline 없음) 은 맨 뒤로
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

export default async function AdminDashboard({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tab = normalizeTab(sp.tab);
  const status = normalizeStatus(sp.status);
  const stage = normalizeStage(sp.stage);
  const type = normalizeType(sp.type);
  const sort = normalizeSort(sp.sort);

  const [posts, counts, pipeline] = await Promise.all([
    listAllPosts(),
    getCounts(),
    getPipelineStats(),
  ]);

  // 탭 카운트 (필터 적용 전, 탭만)
  const activeCount = posts.filter((p) => ACTIVE_STATUSES.includes(p.status)).length;
  const expiredCount = posts.filter((p) => p.status === "expired").length;

  const filtered = applySort(applyFilters(posts, tab, status, stage, type), sort);

  const okMessage =
    sp.ok === "created"
      ? "카드가 새로 등록됐어요."
      : sp.ok === "updated"
        ? "수정이 반영됐어요."
        : sp.ok === "deleted"
          ? "카드가 삭제됐어요."
          : null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      {okMessage && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {okMessage}
        </div>
      )}

      <PipelineDashboard stats={pipeline} />

      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            카드 관리
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            전체 {posts.length}건 · 발행 {counts.byStatus.published} · 초안{" "}
            {counts.byStatus.draft} · 승인대기 {counts.byStatus.pending} · 마감{" "}
            {counts.byStatus.expired}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            채널별: {SOURCE_TYPE_LABELS.admin} {counts.bySource.admin} ·{" "}
            {SOURCE_TYPE_LABELS.ingestion} {counts.bySource.ingestion} ·{" "}
            {SOURCE_TYPE_LABELS.submission} {counts.bySource.submission}
          </p>
        </div>
        <div className="flex gap-2">
          {counts.byStatus.pending > 0 && (
            <Link
              href="/admin/queue"
              className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-200"
            >
              승인 대기 {counts.byStatus.pending} →
            </Link>
          )}
          <Link
            href="/admin/bulk-ingest"
            className="rounded-xl bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-200"
          >
            ⚡ URL 일괄 등록
          </Link>
          <Link
            href="/admin/new"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            + 새 카드
          </Link>
        </div>
      </header>

      <div className="mb-5">
        <AdminFilterBar
          tab={tab}
          status={status}
          stage={stage}
          type={type}
          sort={sort}
          counts={{ active: activeCount, expired: expiredCount }}
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
                    {p.type_tags.map((t) => TYPE_LABELS[t] ?? t).join(", ") ||
                      "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {p.deadline ? (
                      <span
                        className={
                          new Date(p.deadline) < new Date()
                            ? "text-rose-600"
                            : ""
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
