"use client";

// ============================================
// 회원 1행 — 삭제 액션 confirm 처리
// ============================================

import { useTransition } from "react";
import { adminDeleteUserAction } from "@/modules/user/admin-actions";
import type { AdminUserRow } from "@/modules/user/admin-service";

const ROLE_LABEL: Record<string, string> = {
  mother: "엄마",
  father: "아빠",
  other: "기타",
};

const GENDER_LABEL: Record<string, string> = {
  M: "남",
  F: "여",
  X: "임신중",
};

function relativeDays(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const days = Math.floor((now - t) / 86400000);
  if (days < 1) return "오늘";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

/** 최근 방문 기준 활성도 색상 — 7일 이내 초록 / 30일 이내 노랑 / 그 외 회색 */
function seenTone(iso: string | null): string {
  if (!iso) return "text-slate-300";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 7) return "text-emerald-700 font-bold";
  if (days <= 30) return "text-amber-700 font-medium";
  return "text-slate-500";
}

function ageLabel(birthDate: string, gender: string): string {
  if (gender === "X") return "예정";
  const birth = new Date(birthDate);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    now.getMonth() -
    birth.getMonth();
  if (months < 0) return "예정";
  if (months < 12) return `${months}개월`;
  const years = Math.floor(months / 12);
  return `${years}세`;
}

export function UserRow({ user }: { user: AdminUserRow }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const label = user.email ?? user.id.slice(0, 8);
    const confirmed = confirm(
      `정말 회원을 삭제할까요?\n\n${label}\n자녀 ${user.children.length}명, 푸시 ${user.push_subscription_count}개\n\n복구 불가능합니다.`
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await adminDeleteUserAction(user.id);
      if (!result.ok) {
        alert(`삭제 실패: ${result.error}`);
      }
    });
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 align-top">
        <div className="text-sm font-medium text-slate-900">
          {user.email ?? <span className="text-slate-400">(이메일 없음)</span>}
        </div>
        {user.display_name && (
          <div className="text-xs text-slate-500">{user.display_name}</div>
        )}
        <div className="mt-1 text-[10px] text-slate-400 font-mono">
          {user.id.slice(0, 8)}…
        </div>
      </td>

      <td className="px-4 py-3 align-top text-xs text-slate-600">
        {user.providers.length > 0
          ? user.providers.map((p) => (
              <span
                key={p}
                className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px]"
              >
                {p}
              </span>
            ))
          : "—"}
      </td>

      <td className="px-4 py-3 align-top text-xs text-slate-600">
        {user.parent_role ? ROLE_LABEL[user.parent_role] : "—"}
      </td>

      <td className="px-4 py-3 align-top text-xs text-slate-600">
        {user.children.length === 0 ? (
          "—"
        ) : (
          <div className="space-y-0.5">
            {user.children.map((c) => (
              <div key={c.id} className="whitespace-nowrap">
                {GENDER_LABEL[c.gender] ?? c.gender} ·{" "}
                {ageLabel(c.birth_date, c.gender)}
                {c.nickname && (
                  <span className="ml-1 text-slate-400">({c.nickname})</span>
                )}
              </div>
            ))}
          </div>
        )}
      </td>

      <td className="px-4 py-3 align-top text-xs text-slate-600 text-center">
        {user.push_subscription_count > 0 ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            {user.push_subscription_count}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      <td
        className="px-4 py-3 align-top text-xs text-slate-600"
        title={new Date(user.created_at).toLocaleString("ko-KR")}
      >
        {relativeDays(user.created_at)}
      </td>

      {/* 최근 인증 — 마지막 로그인(OAuth/비번) 시점. 세션 갱신은 반영 안 됨 → 리텐션 지표 아님 */}
      <td
        className="px-4 py-3 align-top text-xs text-slate-400"
        title={
          user.last_sign_in_at
            ? `${new Date(user.last_sign_in_at).toLocaleString("ko-KR")}\n※ 마지막 로그인 시점. 세션이 유지되면 갱신되지 않으므로 방문 여부와 무관합니다.`
            : ""
        }
      >
        {user.last_sign_in_at ? relativeDays(user.last_sign_in_at) : "—"}
      </td>

      {/* 최근 방문 — events 기반. 휴면 판정은 반드시 이 값으로 */}
      <td
        className="px-4 py-3 align-top text-xs"
        title={
          user.last_seen_at
            ? `${new Date(user.last_seen_at).toLocaleString("ko-KR")}\n최근 30일 활동 ${user.active_days_30d}일`
            : "최근 90일간 활동 없음"
        }
      >
        <span className={seenTone(user.last_seen_at)}>
          {user.last_seen_at ? relativeDays(user.last_seen_at) : "90일+"}
        </span>
        {user.active_days_30d > 0 && (
          <span className="ml-1 text-[10px] text-slate-400">
            ({user.active_days_30d}일/30)
          </span>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          {pending ? "삭제중…" : "삭제"}
        </button>
      </td>
    </tr>
  );
}
