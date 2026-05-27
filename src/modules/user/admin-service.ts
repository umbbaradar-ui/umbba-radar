// ============================================
// 관리자 — 회원 목록 조회
// auth.users(service_role) + user_profiles + children + push_subscriptions 조합
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";

export type ParentRole = "mother" | "father" | "other";

export interface AdminUserChild {
  id: string;
  gender: "M" | "F" | "X";
  birth_date: string;
  nickname: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  parent_role: ParentRole | null;
  display_name: string | null;
  children: AdminUserChild[];
  push_subscription_count: number;
  /** auth provider (google, email, etc.) — Supabase Auth identities 기반 */
  providers: string[];
}

export interface AdminUserListResult {
  users: AdminUserRow[];
  total: number;
  page: number;
  perPage: number;
}

/**
 * 회원 목록 조회 (관리자 전용)
 * @param page 1-based
 * @param perPage default 50
 */
export async function listAdminUsers(
  page = 1,
  perPage = 50
): Promise<AdminUserListResult> {
  // 1) auth.users 페이지네이션 조회 (service_role 권한)
  const { data: authData, error: authError } =
    await supabaseServer.auth.admin.listUsers({ page, perPage });
  if (authError) throw new Error(`listUsers: ${authError.message}`);

  const users = authData.users ?? [];
  const total = (authData as { total?: number }).total ?? users.length;

  if (users.length === 0) {
    return { users: [], total, page, perPage };
  }

  const userIds = users.map((u) => u.id);

  // 2) user_profiles, children, push_subscriptions 일괄 조회
  const [profilesRes, childrenRes, pushRes] = await Promise.all([
    supabaseServer
      .from("user_profiles")
      .select("user_id, parent_role, display_name")
      .in("user_id", userIds),
    supabaseServer
      .from("children")
      .select("id, user_id, gender, birth_date, nickname")
      .in("user_id", userIds)
      .order("birth_date", { ascending: false }),
    supabaseServer
      .from("push_subscriptions")
      .select("user_id")
      .in("user_id", userIds),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (childrenRes.error) throw new Error(childrenRes.error.message);
  if (pushRes.error) throw new Error(pushRes.error.message);

  const profileMap = new Map<
    string,
    { parent_role: ParentRole; display_name: string | null }
  >();
  for (const p of (profilesRes.data ?? []) as Array<{
    user_id: string;
    parent_role: ParentRole;
    display_name: string | null;
  }>) {
    profileMap.set(p.user_id, {
      parent_role: p.parent_role,
      display_name: p.display_name,
    });
  }

  const childrenMap = new Map<string, AdminUserChild[]>();
  for (const c of (childrenRes.data ?? []) as Array<
    AdminUserChild & { user_id: string }
  >) {
    const arr = childrenMap.get(c.user_id) ?? [];
    arr.push({
      id: c.id,
      gender: c.gender,
      birth_date: c.birth_date,
      nickname: c.nickname,
    });
    childrenMap.set(c.user_id, arr);
  }

  const pushCountMap = new Map<string, number>();
  for (const p of (pushRes.data ?? []) as Array<{ user_id: string }>) {
    pushCountMap.set(p.user_id, (pushCountMap.get(p.user_id) ?? 0) + 1);
  }

  // 3) 조합
  const rows: AdminUserRow[] = users.map((u) => {
    const profile = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      parent_role: profile?.parent_role ?? null,
      display_name: profile?.display_name ?? null,
      children: childrenMap.get(u.id) ?? [],
      push_subscription_count: pushCountMap.get(u.id) ?? 0,
      providers: (u.identities ?? []).map((i) => i.provider),
    };
  });

  return { users: rows, total, page, perPage };
}
