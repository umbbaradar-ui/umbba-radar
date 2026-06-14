"use client";

// ============================================
// 이메일·비밀번호 가입 / 로그인 폼
// Supabase Auth signUp / signInWithPassword 직접 호출
//
// 주의: 로그인 성공 후 router.push 대신 window.location.href 로 풀 리로드.
// router.refresh + push 조합은 Supabase 쿠키 propagation과 race condition을
// 일으켜 일부 폰·쿠키 상태에서 "로그인 → 다시 로그인 화면으로 롤백" 무한루프
// 발생함. 풀 리로드는 쿠키 100% 동행 보장.
// ============================================

import { useState } from "react";
import { getBrowserSupabase } from "@/shared/db/supabase-browser";
import { track } from "@/modules/analytics/service";
import { safeNext } from "@/shared/utils/safe-next";

interface SignUpProps {
  next?: string;
}

export function EmailSignUpForm({ next }: SignUpProps) {
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
    // 자동 로그인이면 session 받음 → 풀 리로드로 쿠키 동기화 보장
    if (data.user && data.session) {
      // 즉시 로그인됨 — 자녀 정보 입력으로
      window.location.href = `/signup/profile${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    } else {
      // 이메일 확인 필요 (세션 없음 → 쿠키 race 영향 없음, 그대로 navigation OK)
      window.location.href = `/signup/verify?email=${encodeURIComponent(email)}${
        next ? `&next=${encodeURIComponent(next)}` : ""
      }`;
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

      <PasswordField
        label="비밀번호"
        hint="8자 이상"
        minLength={8}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />

      <PasswordField
        label="비밀번호 확인"
        minLength={8}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

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

    // 로그인 성공 — 풀 리로드로 쿠키 동기화 100% 보장
    // (router.refresh + push 조합은 쿠키 race condition으로 메인 롤백 루프 유발)
    // proxy.ts가 새 쿠키 인식 후 자녀 정보 유무 따라 /signup/profile 또는 next로 분기
    window.location.href = safeNext(next);
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

      <PasswordField
        label="비밀번호"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

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

// 비밀번호 입력 + 표시/숨기기 토글 (가입·로그인 공통). OAuth 꺼진 동안 유일 가입경로라 UX 중요.
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-700">
        {label}
        {hint && (
          <span className="text-[11px] font-normal text-slate-400"> ({hint})</span>
        )}
      </span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm outline-none focus:border-rose-400"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "비밀번호 숨기기" : "비밀번호 표시"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
        >
          {show ? "숨기기" : "표시"}
        </button>
      </div>
    </label>
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
