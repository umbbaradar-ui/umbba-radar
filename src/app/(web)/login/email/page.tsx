// ============================================
// 이메일·비밀번호 로그인 — /login/email
// ============================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/shared/ui/Logo";
import { EmailLoginForm } from "@/modules/user/ui/EmailAuthForms";
import { getCurrentUser } from "@/modules/user/service";
import { safeNext } from "@/shared/utils/safe-next";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function EmailLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeNext(next));

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <header className="mb-6 text-center">
          <div className="flex justify-center">
            <Logo size={40} className="text-rose-500" />
          </div>
          <h1 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900">
            이메일 로그인
          </h1>
        </header>

        <EmailLoginForm next={next} />

        <div className="mt-5 border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
          처음이세요?
          <Link
            href={`/signup/email${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="ml-1 font-medium text-slate-600 underline"
          >
            이메일로 가입
          </Link>
        </div>

        <div className="mt-2 text-center">
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-[11px] text-slate-400 underline"
          >
            ← 다른 로그인 방법
          </Link>
        </div>
      </div>
    </main>
  );
}
