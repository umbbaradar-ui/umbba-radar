// ============================================
// 로그인 페이지 — /login
// 소셜 로그인(카카오/구글)은 각 provider env 토글로 노출 제어.
// Supabase Dashboard에서 Provider 활성화 + 토글 ON 필요.
// ============================================

import Link from "next/link";
import {
  GoogleSignInButton,
  KakaoSignInButton,
} from "@/modules/user/ui/SignInButton";
import { Logo } from "@/shared/ui/Logo";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const kakaoEnabled = process.env.NEXT_PUBLIC_KAKAO_OAUTH_ENABLED === "true";
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <header className="mb-6 space-y-1 text-center">
          <div className="flex justify-center">
            <Logo size={36} className="text-rose-500" />
          </div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
            엄빠레이더에 로그인
          </h1>
          <p className="text-xs text-slate-500">
            로그인하면 신청함·관심 카드가 모든 기기에서 동기화돼요
          </p>
        </header>

        {/* 소셜 로그인 — provider별 env 토글로 on/off (콘솔 설정 완료 후 켜기)
            카카오: NEXT_PUBLIC_KAKAO_OAUTH_ENABLED / 구글: NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED */}
        {(kakaoEnabled || googleEnabled) && (
          <>
            <div className="space-y-3">
              {kakaoEnabled && <KakaoSignInButton next={next} />}
              {googleEnabled && <GoogleSignInButton next={next} />}
            </div>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] text-slate-400">또는</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}

        <Link
          href={`/login/email${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          <span aria-hidden="true">📧</span>
          <span>이메일로 로그인</span>
        </Link>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          비로그인 시 카드 4건까지만 자유롭게 열어볼 수 있어요.
        </p>

        <div className="mt-5 border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
          처음이세요?
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="ml-1 font-medium text-slate-600 underline"
          >
            가입 안내 보기
          </Link>
        </div>

        <div className="mt-2 text-center">
          <Link href="/" className="text-[11px] text-slate-400 underline">
            ← 둘러보기로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
