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

