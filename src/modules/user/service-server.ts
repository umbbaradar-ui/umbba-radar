// ============================================
// User Service (Server) — children 테이블 조회
// ============================================

import "server-only";
import { getServerSupabase } from "@/shared/db/supabase-ssr";

export type Gender = "M" | "F" | "X";

export interface Child {
  id: string;
  user_id: string;
  gender: Gender;
  birth_date: string; // YYYY-MM-DD
  nickname: string | null;
  created_at: string;
  updated_at: string;
}

/** 현재 사용자의 자녀 목록 (생년월일 오름차순) */
export async function getUserChildren(): Promise<Child[]> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("user_id", user.id)
      .order("birth_date", { ascending: true });

    if (error || !data) return [];
    return data as Child[];
  } catch {
    return [];
  }
}

export async function hasChildren(): Promise<boolean> {
  const children = await getUserChildren();
  return children.length > 0;
}

export type ParentRole = "mother" | "father" | "other";

export interface UserProfile {
  user_id: string;
  parent_role: ParentRole;
  display_name: string | null;
}

/** 현재 사용자의 프로필 (부모 역할 등) */
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    return (data as UserProfile | null) ?? null;
  } catch {
    return null;
  }
}

/** 생년월일 → 시기 카테고리 매핑 */
export function getStageFromBirthDate(birthDate: string): string {
  const now = new Date();
  const birth = new Date(birthDate);
  const monthsDiff =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());

  if (monthsDiff < 0) return "pregnancy"; // 출산 예정 (미래)
  if (monthsDiff < 3) return "newborn";
  if (monthsDiff < 24) return "infant";
  if (monthsDiff < 48) return "toddler";
  if (monthsDiff < 84) return "preschool";
  if (monthsDiff < 120) return "elementary_lower";
  return "elementary_upper";
}
