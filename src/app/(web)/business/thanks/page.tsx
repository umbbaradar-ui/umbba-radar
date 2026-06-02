// ============================================
// 업체 문의 완료 — /business/thanks
// ============================================

import Link from "next/link";

export default function BusinessThanksPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-12 text-center">
      <div className="text-5xl">🤝</div>
      <h1 className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">
        문의 감사합니다
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        담당자가 확인 후 남겨주신 이메일로 회신드릴게요.
        <br />
        보통 영업일 기준 2~3일 안에 연락드려요.
      </p>

      <div className="mt-6 flex gap-2">
        <Link
          href="/"
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
