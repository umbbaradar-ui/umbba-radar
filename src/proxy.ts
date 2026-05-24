// ============================================
// Next.js 16 proxy (이전 middleware)
// 로그인 사용자가 자녀 정보 없으면 /signup/profile 로 자동 리다이렉트
// 이메일 가입·OAuth 둘 다 커버하는 안전망
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 온보딩 체크에서 제외할 경로 prefix
const EXEMPT_PREFIXES = [
  "/signup", // 가입 진행 페이지·온보딩 자체
  "/login", // 로그인 페이지
  "/auth", // OAuth·이메일 인증 콜백
  "/admin", // 관리자 별도 인증
  "/terms",
  "/privacy",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 제외 경로면 통과
  if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // env 미설정 시 그냥 통과 (개발 환경 등)
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach((c) =>
          response.cookies.set(c.name, c.value, c.options)
        );
      },
    },
  });

  // 로그인 여부 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // 로그아웃 상태는 그대로 (ViewGate 같은 별도 게이트가 처리)
    return response;
  }

  // 로그인 상태 — 자녀 정보 있나 확인
  const { data: children } = await supabase
    .from("children")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (!children || children.length === 0) {
    // 자녀 정보 없음 → 강제 온보딩
    const url = request.nextUrl.clone();
    url.pathname = "/signup/profile";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

// 정적 파일·이미지·API는 제외
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|api/|.*\\..*).*)",
  ],
};
