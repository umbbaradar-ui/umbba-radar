// ============================================
// 관리자 영역 레이아웃 (보호됨)
// 모든 자식 페이지에 진입 시 인증 체크
// ============================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/modules/curation/actions";
import { Logo } from "@/shared/ui/Logo";

const ADMIN_COOKIE = "umbba-admin";

export default async function AdminPrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const expected = process.env.ADMIN_PASSWORD;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!expected || !token || token !== expected) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900"
            >
              <Logo size={20} className="text-rose-500" />
              <span>엄빠레이더 · 관리자</span>
            </Link>
            <Link
              href="/admin"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              카드 목록
            </Link>
            <Link
              href="/admin/queue"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              승인 대기함
            </Link>
            <Link
              href="/admin/new"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              새 카드
            </Link>
            <Link
              href="/"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100"
            >
              사이트 보기 ↗
            </Link>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              로그아웃
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
