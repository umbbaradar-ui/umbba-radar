// ============================================
// OAuth 콜백 — /auth/callback
// Supabase Google OAuth에서 돌아온 code를 세션으로 교환
// 자녀 정보 없는 신규 사용자는 /signup/profile 온보딩으로
// ============================================

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/shared/db/supabase-ssr";
import { safeNext } from "@/shared/utils/safe-next";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await getServerSupabase();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // 자녀 정보 확인 — 신규 사용자(0건)는 온보딩으로
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
        const nextEnc = encodeURIComponent(next);
        return NextResponse.redirect(
          `${origin}/signup/profile?next=${nextEnc}`
        );
      }
    }
  } catch {
    // 조회 실패는 무시하고 next로 보냄
  }

  return NextResponse.redirect(`${origin}${next}`);
}
