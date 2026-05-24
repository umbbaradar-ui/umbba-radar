// ============================================
// 이메일 인증 콜백 — /auth/confirm
// Supabase가 보낸 인증 메일의 링크 (token_hash + type) 처리
// ============================================

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/shared/db/supabase-ssr";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "signup"
    | "recovery"
    | "email_change"
    | "email"
    | null;
  const next = searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=missing_verification_params`
    );
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // 인증 성공 — 자녀 정보 확인
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: children } = await supabase
        .from("children")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!children || children.length === 0) {
        return NextResponse.redirect(
          `${origin}/signup/profile?next=${encodeURIComponent(next)}`
        );
      }
    }
  } catch {
    // 무시
  }

  return NextResponse.redirect(`${origin}${next}`);
}
