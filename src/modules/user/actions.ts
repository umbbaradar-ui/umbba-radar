"use server";

// ============================================
// User Server Actions — 로그아웃, 자녀 정보 저장
// ============================================

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/shared/db/supabase-ssr";

export async function signOutAction(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
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
