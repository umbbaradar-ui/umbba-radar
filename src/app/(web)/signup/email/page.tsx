// ============================================
// 이메일·비밀번호 가입 — /signup/email
// ============================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/shared/ui/Logo";
import { EmailSignUpForm } from "@/modules/user/ui/EmailAuthForms";
import { getCurrentUser } from "@/modules/user/service";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function EmailSignupPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(next ?? "/");

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <header className="mb-6 text-center">
          <div className="flex justify-center">
            <Logo size={40} className="text-rose-500" />
          </div>
          <h1 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900">
            이메일로 가입
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            가입 후 이메일 인증 메일이 발송됩니다
          </p>
        </header>

        <EmailSignUpForm next={next} />

        <div className="mt-5 border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
          이미 가입했어요?
          <Link
            href={`/login/email${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="ml-1 font-medium text-slate-600 underline"
          >
            로그인
          </Link>
        </div>

        <div className="mt-2 text-center">
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-[11px] text-slate-400 underline"
          >
            ← 다른 가입 방법 보기
          </Link>
        </div>
      </div>
    </main>
  );
}
