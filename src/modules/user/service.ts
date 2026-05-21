// ============================================
// User Service — 현재 로그인 사용자 정보
// ============================================

import "server-only";
import { getServerSupabase } from "@/shared/db/supabase-ssr";

export interface SimpleUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

export async function getCurrentUser(): Promise<SimpleUser | null> {
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
}
