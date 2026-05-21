// ============================================
// (web) 채널 레이아웃 — 상단 네비 + 로그인 상태
// 토스 미니앱 채널은 별도의 (toss) 레이아웃을 가짐
// ============================================

import Link from "next/link";
import { getCurrentUser } from "@/modules/user/service";
import { UserMenu } from "@/modules/user/ui/UserMenu";

export default async function WebLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <>
      <nav className="sticky top-0 z-20 border-b border-amber-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900"
          >
            <span aria-hidden="true">📡</span>
            <span>엄빠레이더</span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <Link
              href="/"
              className="rounded-full px-3 py-1.5 font-medium text-slate-600 transition hover:bg-amber-100/60 hover:text-slate-900"
            >
              홈
            </Link>
            <Link
              href="/my"
              className="rounded-full px-3 py-1.5 font-medium text-slate-600 transition hover:bg-amber-100/60 hover:text-slate-900"
            >
              내 카드
            </Link>
            <div className="ml-2">
              <UserMenu user={user} />
            </div>
          </div>
        </div>
      </nav>
      {children}
      <footer className="mx-auto max-w-5xl px-5 py-10 text-center text-xs text-slate-400">
        엄빠레이더 · 부모님 대신 스캔 중
      </footer>
    </>
  );
}
