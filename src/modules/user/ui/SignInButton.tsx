"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/shared/db/supabase-browser";
import { track } from "@/modules/analytics/service";

export function GoogleSignInButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    track("login_attempt", { provider: "google" });
    setLoading(true);
    const supabase = getBrowserSupabase();
    const redirectTo = `${window.location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ""
    }`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setLoading(false);
      track("login_error", { provider: "google", message: error.message });
      alert(`로그인에 실패했어요: ${error.message}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
    >
      <span aria-hidden="true">🔵</span>
      <span>{loading ? "이동 중…" : "구글로 계속하기"}</span>
    </button>
  );
}
