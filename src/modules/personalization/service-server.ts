// ============================================
// Personalization Service (Server) — DB 기반 조회
// 로그인 사용자의 user_post_status 테이블 조회
// ============================================

import "server-only";
import { getServerSupabase } from "@/shared/db/supabase-ssr";
import type { UserPostStatusValue } from "./service";

export type UserStatusMap = Record<string, UserPostStatusValue>;

/** 현재 로그인 사용자의 전체 체크 상태 맵 (없으면 빈 객체) */
export async function getUserStatusMap(): Promise<UserStatusMap> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from("user_post_status")
      .select("post_id, status")
      .eq("user_id", user.id);

    if (error || !data) return {};

    const map: UserStatusMap = {};
    for (const row of data as Array<{
      post_id: string;
      status: UserPostStatusValue;
    }>) {
      map[row.post_id] = row.status;
    }
    return map;
  } catch {
    return {};
  }
}

/** 단일 카드에 대한 현재 사용자의 체크 상태 */
export async function getUserStatusForPost(
  postId: string
): Promise<UserPostStatusValue | null> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("user_post_status")
      .select("status")
      .eq("user_id", user.id)
      .eq("post_id", postId)
      .maybeSingle();

    return ((data?.status as UserPostStatusValue) ?? null);
  } catch {
    return null;
  }
}
