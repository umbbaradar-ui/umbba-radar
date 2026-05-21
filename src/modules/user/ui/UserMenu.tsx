// ============================================
// 네비 우측에 표시될 사용자 메뉴 (서버 컴포넌트)
// ============================================

import Link from "next/link";
import type { SimpleUser } from "../service";
import { signOutAction } from "../actions";

export function UserMenu({ user }: { user: SimpleUser | null }) {
  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-slate-900 px-3.5 py-1.5 text-sm font-bold text-white hover:bg-slate-800"
      >
        로그인
      </Link>
    );
  }

  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right text-xs sm:block">
        <p className="font-bold text-slate-900">{user.name ?? "사용자"}</p>
        <p className="text-slate-500">{user.email ?? ""}</p>
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">
        {initial}
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
