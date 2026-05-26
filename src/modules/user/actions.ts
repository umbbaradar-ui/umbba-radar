"use server";

// ============================================
// User Server Actions — 로그아웃, 자녀 정보 저장, 계정 삭제
// ============================================

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/shared/db/supabase-ssr";
import { supabaseServer } from "@/shared/db/supabase-server";

export async function signOutAction(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * 계정 영구 삭제 — auth.users 삭제 → FK ON DELETE CASCADE로 자동 삭제:
 *   - children (008)
 *   - user_profiles (009)
 *   - push_subscriptions (009)
 *   - user_post_status (소유 마이그레이션 추적)
 *   - 익명 events (user_id NULL로 변환됨, 통계는 익명화 유지)
 *
 * service_role 키로 admin.deleteUser 호출. 호출자 = 본인 user.id 확인 후 본인 계정만 삭제.
 * 삭제 성공 시 모든 세션 invalidate → client가 다음 페이지 로드 시 자동 로그아웃 상태.
 */
export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteAccountAction(): Promise<DeleteAccountResult> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요" };

  try {
    const { error } = await supabaseServer.auth.admin.deleteUser(user.id);
    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // 서버 측 세션 쿠키도 명시적으로 제거 (admin.deleteUser가 세션 invalidate해도
  // SSR 쿠키는 stale로 남아있을 수 있어 다음 요청에서 깜빡임 방지)
  try {
    await supabase.auth.signOut();
  } catch {
    // 이미 user 삭제됐으면 signOut 자체가 에러날 수 있음 — 무시
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

interface ChildInput {
  gender: "M" | "F" | "X";
  birth_date: string; // YYYY-MM-DD
  nickname?: string;
}

export type ParentRole = "mother" | "father" | "other";

export type SaveProfileResult =
  | { ok: true; next: string }
  | {
      ok: false;
      error: "required" | "invalid" | "auth_required" | "save_failed";
      /** save_failed일 때 Postgres/Supabase 에러 코드 (예: 42P01 = 테이블 없음) */
      code?: string;
      /** save_failed일 때 어느 단계에서 실패했는지 */
      stage?: "profile_upsert" | "children_delete" | "children_insert";
    };

/**
 * 가입 직후 온보딩 — 부모 역할 + 자녀 정보 한 번에 저장
 * (기존 자녀 정보 삭제 후 새로 입력하는 단순 모델)
 *
 * onSubmit에서 await 호출되므로, server action 내부에서 redirect()를 호출하면
 * NEXT_REDIRECT 에러가 client에서 처리되지 않아 navigation이 안 됨.
 * 결과를 return해서 client가 router.push로 이동하게 함.
 */
export async function saveProfileAndChildrenAction(
  parentRole: ParentRole,
  children: ChildInput[],
  next: string = "/"
): Promise<SaveProfileResult> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  if (!Array.isArray(children) || children.length === 0) {
    return { ok: false, error: "required" };
  }
  for (const c of children) {
    if (!c.birth_date || !c.gender) {
      return { ok: false, error: "invalid" };
    }
  }
  if (!["mother", "father", "other"].includes(parentRole)) {
    return { ok: false, error: "invalid" };
  }

  // 1) 부모 프로필 upsert
  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        parent_role: parentRole,
      },
      { onConflict: "user_id" }
    );
  if (profileError) {
    console.error("[saveProfile] failed:", {
      message: profileError.message,
      code: profileError.code,
      details: profileError.details,
      hint: profileError.hint,
      user_id: user.id,
    });
    return {
      ok: false,
      error: "save_failed",
      code: profileError.code,
      stage: "profile_upsert",
    };
  }

  // 2) 기존 자녀 삭제 + 새로 입력
  const { error: deleteError } = await supabase
    .from("children")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) {
    console.error("[saveChildren delete] failed:", {
      message: deleteError.message,
      code: deleteError.code,
      details: deleteError.details,
      hint: deleteError.hint,
      user_id: user.id,
    });
    return {
      ok: false,
      error: "save_failed",
      code: deleteError.code,
      stage: "children_delete",
    };
  }

  const rows = children.map((c) => ({
    user_id: user.id,
    gender: c.gender,
    birth_date: c.birth_date,
    nickname: c.nickname?.trim() || null,
  }));

  const { error: childrenError } = await supabase.from("children").insert(rows);
  if (childrenError) {
    console.error("[saveChildren insert] failed:", {
      message: childrenError.message,
      code: childrenError.code,
      details: childrenError.details,
      hint: childrenError.hint,
      user_id: user.id,
      rows_count: rows.length,
    });
    return {
      ok: false,
      error: "save_failed",
      code: childrenError.code,
      stage: "children_insert",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true, next };
}

/** (구) 자녀만 저장 — 호환성 유지. parent_role 기본 'other' 로 처리 */
export async function saveChildrenAction(
  children: ChildInput[],
  next: string = "/"
): Promise<SaveProfileResult> {
  return saveProfileAndChildrenAction("other", children, next);
}
