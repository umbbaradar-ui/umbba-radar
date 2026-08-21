// ============================================
// 관리자 — 회원 목록 조회
// auth.users(service_role) + user_profiles + children + push_subscriptions 조합
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import { fetchAllRows } from "@/shared/db/fetch-all-rows";
import { kstDayKey } from "@/shared/utils/dday";

export type ParentRole = "mother" | "father" | "other";

/** 활동 조회 창(일). 이 창 밖의 유저는 last_seen_at = null (= "N일+ 미방문") */
const SEEN_WINDOW_DAYS = 90;

/** "최근 N일 활동일수" 집계 구간 */
const ACTIVE_DAYS_WINDOW = 30;

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
  /**
   * ⚠️ **마지막 "인증" 시점이지 마지막 방문이 아니다.**
   * Supabase는 refresh token으로 세션이 이어질 때 이 값을 갱신하지 않는다.
   * → 6월에 카카오 로그인하고 세션 유지된 채 매일 쓰는 유저도 이 값은 6월에 멈춰 있음.
   * 리텐션·휴면 판정에 쓰지 말 것. 그 용도는 `last_seen_at`.
   * (2026-08-20 실측: 활동중인 유저 6명 전원이 인증-활동 괴리 49~56일)
   */
  last_sign_in_at: string | null;
  /**
   * 마지막 **실제 방문(활동)** 시점 — `events` 기반. 리텐션·휴면 판정은 이 값으로.
   * null = 최근 {@link SEEN_WINDOW_DAYS}일간 활동 없음.
   * ※ 현재 events는 클릭·필터·검색만 기록 → "열고 아무것도 안 누른" 방문은 아직 안 잡힘
   *   (`app_open` 이벤트 추가 후 해소).
   */
  last_seen_at: string | null;
  /** 최근 {@link ACTIVE_DAYS_WINDOW}일간 활동한 날 수 (KST 달력 기준) */
  active_days_30d: number;
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

// ⚠️ 활성 회원 수(7일/30일 방문) 집계는 여기서 하지 않는다.
//    이 함수는 **현재 페이지(50명)** 만 로드하므로 여기서 세면 페이지마다 다른 값이 나온다.
//    전체 기준 집계는 `member-stats-service.ts`의 getMemberStats() 하나로 통일.

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

  const seenSince = new Date(
    Date.now() - SEEN_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // 2) user_profiles, children, push_subscriptions + 활동 이벤트 일괄 조회
  const [profilesRes, childrenRes, pushRes, eventRows] = await Promise.all([
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
    // 실제 방문(활동) 이력 — 1,000행 상한에 걸리면 최근 방문이 통째로 누락되므로 전량 루프
    fetchAllRows<{ user_id: string; created_at: string }>(
      "listAdminUsers.events",
      (from, to) =>
        supabaseServer
          .from("events")
          .select("user_id, created_at")
          .in("user_id", userIds)
          .gte("created_at", seenSince)
          .order("id", { ascending: true }) // 페이지 경계 순서 고정
          .range(from, to)
    ),
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

  // 활동 집계 — 마지막 방문 시각 + 최근 30일 활동일수(KST 달력 기준)
  const lastSeenMap = new Map<string, string>();
  const activeDaysMap = new Map<string, Set<string>>();
  const activeDaysSince =
    Date.now() - ACTIVE_DAYS_WINDOW * 24 * 60 * 60 * 1000;

  for (const ev of eventRows) {
    const prev = lastSeenMap.get(ev.user_id);
    if (!prev || prev < ev.created_at) lastSeenMap.set(ev.user_id, ev.created_at);

    const t = new Date(ev.created_at).getTime();
    if (t >= activeDaysSince) {
      const dayKey = kstDayKey(ev.created_at);
      const set = activeDaysMap.get(ev.user_id) ?? new Set<string>();
      set.add(dayKey);
      activeDaysMap.set(ev.user_id, set);
    }
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
      last_seen_at: lastSeenMap.get(u.id) ?? null,
      active_days_30d: activeDaysMap.get(u.id)?.size ?? 0,
      children: childrenMap.get(u.id) ?? [],
      push_subscription_count: pushCountMap.get(u.id) ?? 0,
      providers: (u.identities ?? []).map((i) => i.provider),
    };
  });

  return { users: rows, total, page, perPage };
}
