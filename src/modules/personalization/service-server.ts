// ============================================
// Personalization Service (Server) — DB 기반 조회
// 로그인 사용자의 user_post_status 테이블 조회
// + 알림용 데이터 (자녀 시기 매칭 신규 카드 / 관심 카드 마감 임박)
// ============================================

import "server-only";
import { getServerSupabase } from "@/shared/db/supabase-ssr";
import { supabaseServer } from "@/shared/db/supabase-server";
import type { Post, StageCategory } from "@/shared/types/post";
import { getStagesForChildren } from "@/shared/utils/stages";
import type { UserPostStatusValue } from "./service";

/** 알림 항목 — 카드 + 알림 종류 + 시간 */
export interface NotificationItem {
  kind: "new_match" | "deadline_soon";
  post: Post;
  /** 정렬용 시간 (created_at 또는 deadline) */
  eventAt: string;
  /** "마감 N일 전" 같은 디스플레이용 */
  reason?: string;
}

const NEW_MATCH_DAYS = 14; // 자녀 시기 매칭 신규 카드 — 최근 14일
const DEADLINE_THRESHOLDS = [1, 3, 7]; // 관심 카드 마감 임박 일수

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

/**
 * 현재 로그인 사용자의 자녀 출생일 목록 ("내 아이" 필터용)
 * 비로그인·자녀 없음이면 빈 배열
 */
export async function getUserChildrenBirths(): Promise<{ birth_date: string }[]> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("children")
      .select("birth_date")
      .eq("user_id", user.id);

    if (error || !data) return [];
    return data as { birth_date: string }[];
  } catch {
    return [];
  }
}

/**
 * 자녀 시기 매칭 + 최근 N일 published 카드 (알림용)
 * 비로그인·자녀 없음이면 빈 배열
 */
export async function getRecentMatchingCards(
  limit = 20
): Promise<Post[]> {
  const births = await getUserChildrenBirths();
  if (births.length === 0) return [];

  const stages = getStagesForChildren(births);
  if (stages.length === 0) return [];

  const sinceIso = new Date(
    Date.now() - NEW_MATCH_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabaseServer
    .from("posts")
    .select("*")
    .eq("status", "published")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  // 자녀 시기와 정확히 일치하는 카드만 (all_ages 제외 — "내 아이 기준" 원칙)
  // 메인 페이지 필터는 all_ages 포함하지만, 알림은 진짜 맞춤만 보여줌.
  const matched = (data as Post[]).filter((p) =>
    p.stage_categories.some((s) => stages.includes(s))
  );

  return matched.slice(0, limit);
}

/**
 * 관심 등록한 카드 중 마감 임박 (7/3/1일 전, 미신청 상태)
 * 로그인 사용자만, DB user_post_status 기준
 */
export async function getInterestedDeadlineSoon(): Promise<
  Array<{ post: Post; daysLeft: number }>
> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. interested 상태 카드 ID들 조회
    const { data: statuses } = await supabase
      .from("user_post_status")
      .select("post_id")
      .eq("user_id", user.id)
      .eq("status", "interested");

    if (!statuses || statuses.length === 0) return [];
    const postIds = statuses.map((s) => s.post_id as string);

    // 2. 해당 카드들의 deadline 조회 (서비스 가능한 카드만)
    const { data: posts } = await supabaseServer
      .from("posts")
      .select("*")
      .in("id", postIds)
      .eq("status", "published")
      .not("deadline", "is", null);

    if (!posts) return [];

    const now = Date.now();
    const items: Array<{ post: Post; daysLeft: number }> = [];

    for (const post of posts as Post[]) {
      if (!post.deadline) continue;
      const deadlineMs = new Date(post.deadline).getTime();
      const daysLeft = Math.ceil((deadlineMs - now) / (24 * 60 * 60 * 1000));
      // 7일 이내(임박) + 양수(아직 마감 X)만
      if (daysLeft > 0 && daysLeft <= 7) {
        items.push({ post, daysLeft });
      }
    }

    // 마감 빠른 순
    items.sort((a, b) => a.daysLeft - b.daysLeft);
    return items;
  } catch {
    return [];
  }
}

/**
 * 알림 종합 — 신규 매칭 + 마감 임박 합쳐 정렬
 */
export async function getNotifications(): Promise<NotificationItem[]> {
  const [newMatches, deadlineSoon] = await Promise.all([
    getRecentMatchingCards(20),
    getInterestedDeadlineSoon(),
  ]);

  const items: NotificationItem[] = [];

  for (const post of newMatches) {
    items.push({
      kind: "new_match",
      post,
      eventAt: post.created_at,
    });
  }

  for (const { post, daysLeft } of deadlineSoon) {
    // 마감 임박은 더 위로 노출되게 미래 시점으로 설정
    items.push({
      kind: "deadline_soon",
      post,
      eventAt: new Date().toISOString(),
      reason: DEADLINE_THRESHOLDS.includes(daysLeft)
        ? `마감 ${daysLeft}일 전`
        : `마감 ${daysLeft}일 남음`,
    });
  }

  // 마감 임박 먼저, 그다음 신규 매칭 최신순
  items.sort((a, b) => {
    if (a.kind === "deadline_soon" && b.kind !== "deadline_soon") return -1;
    if (b.kind === "deadline_soon" && a.kind !== "deadline_soon") return 1;
    return b.eventAt.localeCompare(a.eventAt);
  });

  return items;
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
