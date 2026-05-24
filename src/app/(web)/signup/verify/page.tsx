// ============================================
// 이메일 인증 안내 페이지 — /signup/verify
// 가입 직후, 사용자가 받은 메일의 링크를 클릭해야 인증 완료
// ============================================

import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ email?: string; next?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { email, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-12 text-center">
      <div className="text-5xl">📧</div>
      <h1 className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">
        이메일을 확인해주세요
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {email && (
          <>
            <strong className="text-slate-900">{email}</strong> 으로
            <br />
          </>
        )}
        인증 메일을 보냈어요.
        <br />
        받은 메일의 링크를 클릭하면 가입이 완료됩니다.
      </p>

      <div className="mt-6 rounded-xl bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900">
        ⏳ 메일이 안 보이면 <strong>스팸함</strong>을 확인해주세요.
        <br />
        그래도 없으면 5~10분 기다린 후 다시 시도하시거나, 가입을 다시 진행해주세요.
      </div>

      <div className="mt-6 flex gap-2">
        <Link
          href="/"
          className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
        >
          홈으로
        </Link>
        <Link
          href={`/signup/email${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
        >
          다른 이메일로
        </Link>
      </div>
    </main>
  );
}
