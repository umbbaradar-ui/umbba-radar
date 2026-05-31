// ============================================
// 승인 대기함 — /admin/queue
// pending 상태 카드만 모아서 빠르게 처리
// ============================================

import Link from "next/link";
import { listPendingPosts } from "@/modules/curation/service";
import {
  approvePostAction,
  deletePostAction,
} from "@/modules/curation/actions";
import {
  STAGE_LABELS,
  TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  type SourceType,
} from "@/shared/types/post";
import { calcDDay, isPastDeadline } from "@/shared/utils/dday";

interface PageProps {
  searchParams: Promise<{ source?: string; ok?: string }>;
}

export const dynamic = "force-dynamic";

const SOURCE_BADGE_COLOR: Record<SourceType, string> = {
  admin: "bg-slate-100 text-slate-700",
  ingestion: "bg-sky-100 text-sky-700",
  submission: "bg-violet-100 text-violet-700",
};

export default async function AdminQueuePage({ searchParams }: PageProps) {
  const { source: sourceParam, ok } = await searchParams;
  const source =
    sourceParam === "ingestion" || sourceParam === "submission" || sourceParam === "admin"
      ? (sourceParam as SourceType)
      : undefined;

  const posts = await listPendingPosts(source);

  const isArchivedMsg = ok === "archived";
  const okMessage = isArchivedMsg
    ? "모집 마감 기간이 오늘 이전이라 발행하지 않고 마감(보관) 처리했어요."
    : ok === "approved"
      ? "발행됐어요."
      : ok === "deleted"
        ? "반려·삭제됐어요."
        : null;

  return (
    <main className="mx-auto max-w-4xl px-5 py-6">
      {okMessage && (
        <div
          className={`mb-4 rounded-xl px-4 py-2 text-sm ${
            isArchivedMsg
              ? "bg-amber-50 text-amber-800"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {okMessage}
        </div>
      )}

      <header className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          ③ 카드 승인 <span className="text-sm font-medium text-slate-400">(3단계: Claude 분석 후 검수)</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {posts.length}건 대기 중 · 오래된 것부터
        </p>
      </header>

      {/* 채널 필터 */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        <FilterPill href="/admin/queue" active={!source}>
          전체
        </FilterPill>
        <FilterPill href="/admin/queue?source=submission" active={source === "submission"}>
          제보만
        </FilterPill>
        <FilterPill href="/admin/queue?source=ingestion" active={source === "ingestion"}>
          자동수집만
        </FilterPill>
        <FilterPill href="/admin/queue?source=admin" active={source === "admin"}>
          관리자 초안
        </FilterPill>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <p className="text-sm text-slate-400">대기 중인 카드가 없어요.</p>
          <p className="mt-1 text-xs text-slate-400">
            깔끔합니다. 새 제보·자동수집을 기다리거나{" "}
            <Link href="/admin/new" className="underline">
              직접 입력
            </Link>
            하세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <article
              key={p.id}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <div className="flex flex-col sm:flex-row">
                {/* 썸네일 */}
                <div className="aspect-square w-full shrink-0 bg-slate-100 sm:w-40">
                  {p.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnail_url}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                {/* 본문 */}
                <div className="flex-1 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SOURCE_BADGE_COLOR[p.source_type]}`}
                    >
                      {SOURCE_TYPE_LABELS[p.source_type]}
                    </span>
                    {p.submitter_handle && (
                      <span className="text-[10px] text-violet-600">
                        @{p.submitter_handle}
                      </span>
                    )}
                    {p.brand_name && (
                      <span className="text-[10px] text-slate-500">
                        · {p.brand_name}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{p.title}</h3>

                  {p.deadline && (
                    <div className="mt-1.5">
                      <DeadlineBadge
                        deadline={p.deadline}
                        unknown={p.deadline_unknown}
                      />
                    </div>
                  )}

                  {isPastDeadline(p.deadline) && (
                    <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                      ⚠️ 모집 마감 기간이 오늘 이전입니다. 승인하면 발행되지 않고
                      마감(보관) 처리돼요.
                    </p>
                  )}

                  {p.body && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {p.body}
                    </p>
                  )}

                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block break-all text-[11px] text-sky-600 hover:underline"
                  >
                    원문: {p.source_url} ↗
                  </a>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.stage_categories.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700"
                      >
                        {STAGE_LABELS[s] ?? s}
                      </span>
                    ))}
                    {p.type_tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                      >
                        {TYPE_LABELS[t] ?? t}
                      </span>
                    ))}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="mt-3 flex gap-2">
                    <form action={approvePostAction.bind(null, p.id)}>
                      <button
                        type="submit"
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                          isPastDeadline(p.deadline)
                            ? "bg-amber-500 hover:bg-amber-600"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {isPastDeadline(p.deadline) ? "마감 처리" : "✓ 발행"}
                      </button>
                    </form>
                    <Link
                      href={`/admin/${p.id}/edit`}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      수정 후 발행
                    </Link>
                    <form action={deletePostAction.bind(null, p.id)}>
                      <button
                        type="submit"
                        className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        ✗ 반려
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

// (예상) 마감기한 배지 — 근접(D-3 이내)이면 빨강, 지나면 회색, 그 외 주황.
// deadline_unknown이면 "(예상)" 표시 (등록일+N일 자동값이라 정확치 않음).
function DeadlineBadge({
  deadline,
  unknown,
}: {
  deadline: string;
  unknown: boolean;
}) {
  const dd = calcDDay(deadline);
  if (!dd) return null;
  const dateStr = new Date(deadline).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  });
  const color =
    dd.days < 0
      ? "bg-slate-100 text-slate-400"
      : dd.urgent
        ? "bg-rose-100 text-rose-700"
        : "bg-amber-100 text-amber-800";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${color}`}
    >
      ⏰ {unknown ? "(예상) " : ""}
      {dd.label} · ~{dateStr}
    </span>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}
