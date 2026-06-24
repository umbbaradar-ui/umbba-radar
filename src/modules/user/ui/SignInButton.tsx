"use client";

// ============================================
// 소셜 로그인 버튼 (카카오 / 구글)
// Supabase Auth signInWithOAuth — 콜백은 provider 무관(/auth/callback)
// 각 provider 노출은 login/signup 페이지에서 env 토글로 제어
//   카카오: NEXT_PUBLIC_KAKAO_OAUTH_ENABLED
//   구글:   NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED
// ============================================

import { useState } from "react";
import { getBrowserSupabase } from "@/shared/db/supabase-browser";
import { track } from "@/modules/analytics/service";

type OAuthProvider = "google" | "kakao";

async function startOAuth(
  provider: OAuthProvider,
  next: string | undefined,
  setLoading: (v: boolean) => void
) {
  track("login_attempt", { provider });
  setLoading(true);
  const supabase = getBrowserSupabase();
  const redirectTo = `${window.location.origin}/auth/callback${
    next ? `?next=${encodeURIComponent(next)}` : ""
  }`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) {
    setLoading(false);
    track("login_error", { provider, message: error.message });
    alert(`로그인에 실패했어요: ${error.message}`);
  }
}

export function GoogleSignInButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={() => startOAuth("google", next, setLoading)}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
    >
      <GoogleIcon />
      <span>{loading ? "이동 중…" : "구글로 계속하기"}</span>
    </button>
  );
}

export function KakaoSignInButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={() => startOAuth("kakao", next, setLoading)}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-4 py-3 text-sm font-bold text-[#191600] transition hover:brightness-95 disabled:opacity-60"
    >
      <KakaoIcon />
      <span>{loading ? "이동 중…" : "카카오로 시작하기"}</span>
    </button>
  );
}

// 카카오 심볼 (말풍선) — 노란 버튼 위 검정
function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#191600" aria-hidden="true">
      <path d="M12 3.5C6.75 3.5 2.5 6.86 2.5 11c0 2.66 1.78 5 4.46 6.33-.16.57-.86 3.02-.9 3.22 0 0-.02.16.08.22.1.06.22.01.22.01.28-.04 3.27-2.16 3.83-2.55.59.08 1.2.13 1.81.13 5.25 0 9.5-3.36 9.5-7.5S17.25 3.5 12 3.5z" />
    </svg>
  );
}

// 구글 G (공식 4색)
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
