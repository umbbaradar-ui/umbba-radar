// ============================================
// 관리자 로그인 페이지 — /admin/login
// ADMIN_PASSWORD env 한 개로 보호. Phase 2에 Google OAuth로 교체 예정.
// ============================================

import { loginAction } from "@/modules/curation/actions";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  const errorMessage =
    error === "invalid"
      ? "아이디 또는 비밀번호가 맞지 않아요."
      : error === "notconfigured"
        ? "ADMIN_ID·ADMIN_PASSWORD 환경변수가 설정되지 않았어요. .env.local과 Vercel에 추가하세요."
        : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50/40 px-5">
      <form
        action={loginAction}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm"
      >
        <header className="space-y-1 text-center">
          <p className="text-2xl">📡</p>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
            엄빠레이더 관리자
          </h1>
          <p className="text-xs text-slate-500">아이디와 비밀번호를 입력하세요</p>
        </header>

        <input
          type="text"
          name="id"
          required
          autoFocus
          autoComplete="username"
          placeholder="아이디"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-400"
        />

        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="비밀번호"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-rose-400"
        />

        {errorMessage && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          로그인
        </button>

        <p className="text-center text-[11px] text-slate-400">
          ← <a href="/" className="underline">메인으로</a>
        </p>
      </form>
    </main>
  );
}
