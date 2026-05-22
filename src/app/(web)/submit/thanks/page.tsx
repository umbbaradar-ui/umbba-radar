// ============================================
// 제보 완료 — /submit/thanks
// ============================================

import Link from "next/link";

export default function SubmitThanksPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-12 text-center">
      <div className="text-5xl">🛰️</div>
      <h1 className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">
        제보 감사합니다
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        관리자 검토 후 공개됩니다.
        <br />
        검토 결과는 보통 1~2일 안에 반영돼요.
      </p>

      <div className="mt-6 flex gap-2">
        <Link
          href="/"
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
        >
          홈으로
        </Link>
        <Link
          href="/submit"
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          또 제보하기
        </Link>
      </div>
    </main>
  );
}
