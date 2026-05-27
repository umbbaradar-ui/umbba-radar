"use client";

// ============================================
// 등록된 인스타 계정 리스트 + 활성/비활성 토글 + 삭제
// ============================================

import { useTransition } from "react";
import {
  toggleAccountAction,
  deleteInstagramAccountAction,
} from "@/modules/ingestion/accounts/actions";
import type { InstagramAccount } from "@/modules/ingestion/accounts/types";

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function AccountList({ accounts }: { accounts: InstagramAccount[] }) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
        등록된 계정이 없어요. 위 폼에서 일괄 등록해주세요.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      {accounts.map((acc) => (
        <AccountRow key={acc.id} account={acc} />
      ))}
    </ul>
  );
}

function AccountRow({ account }: { account: InstagramAccount }) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleAccountAction(account.id, !account.active);
    });
  }
  function handleDelete() {
    if (!confirm(`@${account.username} 을 삭제할까요? (모니터링 중단)`)) return;
    startTransition(async () => {
      await deleteInstagramAccountAction(account.id);
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-xs">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        title={account.active ? "비활성화" : "활성화"}
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
          account.active
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-slate-200 text-slate-500 hover:bg-slate-300"
        } disabled:opacity-50`}
      >
        {account.active ? "활성" : "비활성"}
      </button>

      <a
        href={`https://www.instagram.com/${account.username}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 truncate font-mono text-slate-800 hover:text-rose-600"
      >
        @{account.username}
      </a>

      <span
        className="w-24 text-right text-[11px] text-slate-500"
        title={
          account.last_scanned_at
            ? new Date(account.last_scanned_at).toLocaleString("ko-KR")
            : ""
        }
      >
        {relativeTime(account.last_scanned_at)}
      </span>

      <span
        className="w-12 text-right text-[11px] text-slate-500"
        title="마지막 스캔 신규 발견 수"
      >
        +{account.last_new_count}
      </span>

      {account.last_error && (
        <span
          className="w-32 truncate text-[11px] text-rose-600"
          title={account.last_error}
        >
          ⚠ {account.last_error}
        </span>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="shrink-0 rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
      >
        삭제
      </button>
    </li>
  );
}
