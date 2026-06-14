// ============================================
// User Service — 현재 로그인 사용자 정보
// ============================================

import "server-only";
import { cache } from "react";
import { getServerSupabase } from "@/shared/db/supabase-ssr";

export interface SimpleUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

// React.cache — 한 요청 렌더 중 getCurrentUser가 여러 번 호출돼도 auth.getUser 왕복은 1회로 dedupe
// (레이아웃 + 페이지 + 자식 서버컴포넌트가 같은 요청에서 각자 호출하는 비용 제거)
export const getCurrentUser = cache(async function getCurrentUser(): Promise<SimpleUser | null> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const meta = user.user_metadata ?? {};
    return {
      id: user.id,
      email: user.email ?? null,
      name: (meta.full_name as string) ?? (meta.name as string) ?? null,
      avatar_url: (meta.avatar_url as string) ?? null,
    };
  } catch {
    // 미설정·네트워크 등 안전 fallback
    return null;
  }
});
