"use server";

// ============================================
// Personalization Server Actions
// 로그인 사용자의 신청함/관심을 DB에 기록·삭제
// 로그아웃 사용자는 클라이언트 service.ts (localStorage) 사용
// ============================================

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/shared/db/supabase-ssr";
import type { UserPostStatusValue } from "./service";

async function getUserId(): Promise<string | null> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function markStatusAction(
  postId: string,
  status: UserPostStatusValue
): Promise<{ ok: boolean }> {
  const userId = await getUserId();
  if (!userId) return { ok: false };

  const supabase = await getServerSupabase();
  const { error } = await supabase.from("user_post_status").upsert(
    {
      user_id: userId,
      post_id: postId,
      status,
    },
    { onConflict: "user_id,post_id" }
  );
  if (error) {
    console.error("[markStatus] failed:", error.message);
    return { ok: false };
  }
  revalidatePath("/my");
  return { ok: true };
}

export async function unmarkStatusAction(
  postId: string
): Promise<{ ok: boolean }> {
  const userId = await getUserId();
  if (!userId) return { ok: false };

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("user_post_status")
    .delete()
    .eq("user_id", userId)
    .eq("post_id", postId);
  if (error) {
    console.error("[unmarkStatus] failed:", error.message);
    return { ok: false };
  }
  revalidatePath("/my");
  return { ok: true };
}

/** 로그인 직후 1회 — localStorage 데이터를 DB로 이전 */
export async function migrateLocalStatusAction(
  data: Record<string, UserPostStatusValue>
): Promise<{ ok: boolean; migrated: number }> {
  const userId = await getUserId();
  if (!userId) return { ok: false, migrated: 0 };

  const rows = Object.entries(data).map(([post_id, status]) => ({
    user_id: userId,
    post_id,
    status,
  }));
  if (rows.length === 0) return { ok: true, migrated: 0 };

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("user_post_status")
    .upsert(rows, { onConflict: "user_id,post_id", ignoreDuplicates: true });

  if (error) {
    console.error("[migrate] failed:", error.message);
    return { ok: false, migrated: 0 };
  }
  revalidatePath("/my");
  return { ok: true, migrated: rows.length };
}
