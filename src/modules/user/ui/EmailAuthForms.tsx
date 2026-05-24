"use client";

// ============================================
// 이메일·비밀번호 가입 / 로그인 폼
// Supabase Auth signUp / signInWithPassword 직접 호출
// ============================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/shared/db/supabase-browser";
import { track } from "@/modules/analytics/service";

interface SignUpProps {
  next?: string;
}

export function EmailSignUpForm({ next }: SignUpProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!email.includes("@") || !email.includes(".")) {
      return "올바른 이메일 형식이 아니에요.";
    }
    if (password.length < 8) {
      return "비밀번호는 8자 이상이어야 해요.";
    }
    if (password !== confirm) {
      return "비밀번호 확인이 일치하지 않아요.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    track("signup_attempt", { provider: "email" });

    const supabase = getBrowserSupabase();
    const redirectTo = `${window.location.origin}/auth/confirm${
      next ? `?next=${encodeURIComponent(next)}` : ""
    }`;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);
    if (signUpError) {
      track("signup_error", { provider: "email", message: signUpError.message });
      setError(translateError(signUpError.message));
      return;
    }

    // 이메일 확인 필수면 user.email_confirmed_at = null
    // 자동 로그인이면 session 받음
    if (data.user && data.session) {
      // 즉시 로그인됨 — 자녀 정보 입력으로
      router.push(`/signup/profile${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    } else {
      // 이메일 확인 필요
      router.push(
        `/signup/verify?email=${encodeURIComponent(email)}${
          next ? `&next=${encodeURIComponent(next)}` : ""
        }`
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-700">이메일</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-700">
          비밀번호{" "}
          <span className="text-[11px] font-normal text-slate-400">
            (8자 이상)
          </span>
        </span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-700">비밀번호 확인</span>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "가입 중…" : "이메일로 가입"}
      </button>
    </form>
  );
}

interface LoginProps {
  next?: string;
}

export function EmailLoginForm({ next }: LoginProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    track("login_attempt", { provider: "email" });

    const supabase = getBrowserSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      track("login_error", {
        provider: "email",
        message: signInError.message,
      });
      setError(translateError(signInError.message));
      return;
    }

    // 로그인 성공 — 자녀 정보 있으면 next, 없으면 onboarding
    router.refresh();
    router.push(next ?? "/");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-700">이메일</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-700">비밀번호</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}

function translateError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (lower.includes("already registered")) return "이미 가입된 이메일이에요. 로그인해주세요.";
  if (lower.includes("rate limit")) return "잠시 후 다시 시도해주세요.";
  if (lower.includes("email not confirmed")) return "이메일 인증이 완료되지 않았어요. 받은 메일을 확인해주세요.";
  if (lower.includes("user not found")) return "가입되지 않은 이메일이에요.";
  if (lower.includes("weak password")) return "비밀번호가 너무 약해요.";
  return message;
}
