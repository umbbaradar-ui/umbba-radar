// ============================================
// 이메일 인증 콜백 — /auth/confirm
// 두 가지 흐름 모두 지원:
//   1) PKCE: token_hash·type query → verifyOtp
//   2) Supabase가 이미 검증한 후 redirect_to 로 보낸 경우 → 그냥 인증 상태 확인
// 인증 OK면 자녀 정보 확인 → 없으면 /signup/profile
// ============================================

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/shared/db/supabase-ssr";
import { safeNext } from "@/shared/utils/safe-next";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "signup"
    | "recovery"
    | "email_change"
    | "email"
    | "magiclink"
    | null;

  const supabase = await getServerSupabase();

  // 1) PKCE 흐름 — token_hash 있으면 verifyOtp 시도
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  // 2) 인증 상태 확인 (Supabase가 처리했거나 verifyOtp가 성공한 경우)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      `${origin}/login?error=verification_failed`
    );
  }

  // 자녀 정보 확인 — 없으면 온보딩
  try {
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
  } catch {
    // 조회 실패는 무시
  }

  return NextResponse.redirect(`${origin}${next}`);
}
