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

/**
 * 가입 직후 온보딩 — 부모 역할 + 자녀 정보 한 번에 저장
 * (기존 자녀 정보 삭제 후 새로 입력하는 단순 모델)
 */
export async function saveProfileAndChildrenAction(
  parentRole: ParentRole,
  children: ChildInput[],
  next: string = "/"
): Promise<void> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Array.isArray(children) || children.length === 0) {
    redirect(`/signup/profile?error=required`);
  }
  for (const c of children) {
    if (!c.birth_date || !c.gender) {
      redirect(`/signup/profile?error=invalid`);
    }
  }
  if (!["mother", "father", "other"].includes(parentRole)) {
    redirect(`/signup/profile?error=invalid`);
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
    console.error("[saveProfile] failed:", profileError.message);
    redirect("/signup/profile?error=invalid");
  }

  // 2) 기존 자녀 삭제 + 새로 입력
  await supabase.from("children").delete().eq("user_id", user.id);

  const rows = children.map((c) => ({
    user_id: user.id,
    gender: c.gender,
    birth_date: c.birth_date,
    nickname: c.nickname?.trim() || null,
  }));

  const { error: childrenError } = await supabase.from("children").insert(rows);
  if (childrenError) {
    console.error("[saveChildren] failed:", childrenError.message);
    redirect("/signup/profile?error=invalid");
  }

  revalidatePath("/", "layout");
  redirect(next);
}

/** (구) 자녀만 저장 — 호환성 유지. parent_role 기본 'other' 로 처리 */
export async function saveChildrenAction(
  children: ChildInput[],
  next: string = "/"
): Promise<void> {
  return saveProfileAndChildrenAction("other", children, next);
}
