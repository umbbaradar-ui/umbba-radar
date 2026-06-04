// ============================================
// 관리자 대시보드 — /admin
// 상단: 파이프라인 현황 + 요약/버튼 (서버)
// 카드 목록 + 필터(탭/상태/시기/유형/정렬)는 AdminPostsView(클라이언트)에서 즉시 처리
// → 필터 클릭 시 서버 재요청 없음. 초기값만 URL searchParams에서.
// ============================================

import Link from "next/link";
import {
  listAllPosts,
  getCounts,
  getPipelineStats,
} from "@/modules/curation/service";
import {
  SOURCE_TYPE_LABELS,
  type StageCategory,
  type TypeTag,
} from "@/shared/types/post";
import type { AdminTab } from "./_components/AdminFilterBar";
import { AdminPostsView } from "./_components/AdminPostsView";
import { PipelineDashboard } from "./_components/PipelineDashboard";

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

export const dynamic = "force-dynamic";

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
    "giveaway",
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

      <AdminPostsView
        posts={posts}
        initialTab={tab}
        initialStatus={status}
        initialStage={stage}
        initialType={type}
        initialSort={sort}
      />
    </main>
  );
}
