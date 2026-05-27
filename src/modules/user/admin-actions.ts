"use server";

// ============================================
// 관리자 — 회원 삭제 액션
// ============================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/shared/db/supabase-server";

const ADMIN_COOKIE = "umbba-admin";

async function ensureAdmin() {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD env var is not configured");
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token !== expected) redirect("/admin/login");
}

/**
 * 관리자 권한으로 회원 영구 삭제
 * auth.users 삭제 → FK CASCADE 로 children, user_profiles, push_subscriptions 자동 정리
 *
 * 호출자는 이미 admin cookie 검증된 어드민 페이지에서만 호출됨.
 */
export async function adminDeleteUserAction(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureAdmin();

  if (!userId) return { ok: false, error: "userId 누락" };

  try {
    const { error } = await supabaseServer.auth.admin.deleteUser(userId);
    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}
