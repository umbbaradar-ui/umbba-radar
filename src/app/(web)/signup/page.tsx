// ============================================
// 가입 안내 페이지 — /signup
// ViewGate 가 2건째 카드 클릭 시 이쪽으로 보냄
// 가치 제안 + OAuth 버튼
// ============================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/modules/user/ui/SignInButton";
import { Logo } from "@/shared/ui/Logo";
import { getCurrentUser } from "@/modules/user/service";

interface PageProps {
  searchParams: Promise<{ next?: string; reason?: string }>;
}

export default async function SignupPage({ searchParams }: PageProps) {
  const { next, reason } = await searchParams;
  const user = await getCurrentUser();

  // 이미 로그인 상태면 다음 페이지로
  if (user) {
    redirect(next ?? "/");
  }

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <header className="mb-6 text-center">
          <div className="flex justify-center">
            <Logo size={48} className="text-rose-500" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">
            {reason === "more" ? "더 보고 싶으시면" : "가입하고 시작하기"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            간단한 가입 한 번이면
            <br />
            끝까지 놓치지 않게 도와드려요.
          </p>
        </header>

        <ul className="mb-6 space-y-2 rounded-xl bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900">
          <li>✓ 자녀 시기에 맞는 혜택만 자동 큐레이션</li>
          <li>✓ 신청함·관심 기록 모든 기기 동기화</li>
          <li>✓ <strong>다둥이는 각각</strong> 추천받기</li>
          <li>✓ 마감 임박 알림 (출시 예정)</li>
        </ul>

        <GoogleSignInButton next={next} />

        <p className="mt-3 text-center text-[11px] text-slate-400">
          구글 1초 · 비밀번호 X
        </p>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] text-slate-400">또는</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <Link
          href={`/signup/email${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
        >
          <span aria-hidden="true">📧</span>
          <span>이메일로 가입</span>
        </Link>

        <div className="mt-5 border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
          이미 가입했어요?
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="ml-1 font-medium text-slate-600 underline"
          >
            로그인
          </Link>
        </div>

        <div className="mt-2 text-center">
          <Link href="/" className="text-[11px] text-slate-400 underline">
            나중에 할게요 (둘러보기)
          </Link>
        </div>
      </div>
    </main>
  );
}
