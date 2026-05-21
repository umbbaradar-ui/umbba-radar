// ============================================
// OAuth 콜백 — /auth/callback
// Supabase Google OAuth에서 돌아온 code를 세션으로 교환하고 메인으로 보냄
// ============================================

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/shared/db/supabase-ssr";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
