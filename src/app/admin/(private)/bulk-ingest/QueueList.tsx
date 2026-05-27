"use client";

// ============================================
// 큐 항목 리스트 — 상태별 표시 + 삭제/재시도 액션
// ============================================

import Link from "next/link";
import { useState, useTransition } from "react";
import type { IngestQueueItem } from "@/modules/ingestion/queue/types";
import {
  deleteQueueItemAction,
  requeueAction,
} from "@/modules/ingestion/queue/actions";

const STATUS_LABEL: Record<
  IngestQueueItem["status"],
  { label: string; cls: string }
> = {
  todo: {
    label: "대기",
    cls: "bg-slate-100 text-slate-700",
  },
  processing: {
    label: "처리중",
    cls: "bg-amber-100 text-amber-800",
  },
  done: {
    label: "완료",
    cls: "bg-emerald-100 text-emerald-800",
  },
  duplicate: {
    label: "중복",
    cls: "bg-zinc-100 text-zinc-600",
  },
  failed: {
    label: "실패",
    cls: "bg-rose-100 text-rose-800",
  },
};

export function QueueList({ items }: { items: IngestQueueItem[] }) {
  const [filter, setFilter] = useState<IngestQueueItem["status"] | "all">(
    "all"
  );

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
        큐가 비어있어요. 위 폼에서 URL을 등록하면 여기에 표시됩니다.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 필터 */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "todo", "processing", "done", "duplicate", "failed"] as const).map(
          (f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                filter === f
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f === "all" ? "전체" : STATUS_LABEL[f].label}
              <span className="ml-1 opacity-70">
                ({f === "all" ? items.length : items.filter((i) => i.status === f).length})
              </span>
            </button>
          )
        )}
      </div>

      {/* 리스트 */}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {filtered.map((item) => (
          <QueueRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function QueueRow({ item }: { item: IngestQueueItem }) {
  const [pending, startTransition] = useTransition();
  const status = STATUS_LABEL[item.status];
  const createdAt = new Date(item.created_at).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleDelete() {
    if (!confirm("이 큐 항목을 삭제할까요? (이미 카드로 생성된 건 카드는 유지됨)")) return;
    startTransition(async () => {
      await deleteQueueItemAction(item.id);
    });
  }

  function handleRequeue() {
    startTransition(async () => {
      await requeueAction(item.id);
    });
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3 text-xs">
      <span
        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}
      >
        {status.label}
      </span>

      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-slate-800 hover:text-rose-600"
          title={item.url}
        >
          {item.url}
        </a>
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
          <span>등록 {createdAt}</span>
          {item.attempts > 0 && <span>시도 {item.attempts}회</span>}
          {item.post_id && (
            <Link
              href={`/admin/${item.post_id}/edit`}
              className="text-rose-600 hover:underline"
            >
              생성된 카드 →
            </Link>
          )}
        </div>
        {item.error && (
          <p className="mt-1 line-clamp-2 text-[11px] text-rose-700">
            ⚠ {item.error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-1">
        {(item.status === "failed" || item.status === "done" || item.status === "duplicate") && (
          <button
            type="button"
            onClick={handleRequeue}
            disabled={pending}
            className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            title="다시 대기 큐로"
          >
            ↻ 재시도
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          title="큐에서 삭제"
        >
          삭제
        </button>
      </div>
    </li>
  );
}
