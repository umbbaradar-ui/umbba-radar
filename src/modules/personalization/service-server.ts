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
import { kstTodayStartIso, calcDDay } from "@/shared/utils/dday";
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

const NEW_MATCH_DAYS = 14; // 자녀 시기 매칭 신규 카드 — 최근 N일 이내 + 가입 이후만
const DEADLINE_NOTIFY_DAYS = 3; // 마감 임박 알림 노출 범위 (이전엔 7일이었음)
const DEADLINE_THRESHOLDS = [1, 3]; // "마감 N일 전" 강조 라벨용

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
 * 자녀 시기 매칭 + 최근 N일 + 가입 이후 published 카드 (알림용)
 * 비로그인·자녀 없음이면 빈 배열
 *
 * 노출 윈도우: max(가입일, now - NEW_MATCH_DAYS).
 * 가입 전 등록된 카드는 "신규 매칭" 아님 → 알림 안 띄움.
 */
export async function getRecentMatchingCards(
  limit = 20
): Promise<Post[]> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: childrenData } = await supabase
    .from("children")
    .select("birth_date")
    .eq("user_id", user.id);
  const births = (childrenData ?? []) as { birth_date: string }[];
  if (births.length === 0) return [];

  const stages = getStagesForChildren(births);
  if (stages.length === 0) return [];

  const windowStartMs = Date.now() - NEW_MATCH_DAYS * 24 * 60 * 60 * 1000;
  const signupMs = new Date(user.created_at).getTime();
  const sinceIso = new Date(Math.max(windowStartMs, signupMs)).toISOString();

  const { data, error } = await supabaseServer
    .from("posts")
    .select("*")
    .eq("status", "published")
    .gte("created_at", sinceIso)
    // 마감일(KST 날짜) 지난 카드는 신규 매칭 알림에서도 제외 (피드와 동일 기준)
    .or(`deadline.gte.${kstTodayStartIso()},deadline.is.null`)
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
 * 관심 등록한 카드 중 마감 임박 (DEADLINE_NOTIFY_DAYS일 이내, 미신청 상태)
 * 로그인 사용자만, DB user_post_status 기준
 *
 * 정렬: 마감 빠른 순. 같은 daysLeft 내에서는 내 아이 시기와 정확 매칭되는 카드 우선.
 */
export async function getInterestedDeadlineSoon(
  myChildStages: StageCategory[] = []
): Promise<Array<{ post: Post; daysLeft: number }>> {
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

    const items: Array<{ post: Post; daysLeft: number }> = [];

    for (const post of posts as Post[]) {
      if (!post.deadline) continue;
      // KST 자정 캘린더 기준(D-day 배지와 동일). Math.ceil(시각차) 패턴은 dday.ts가 금지 —
      // "오늘 마감"을 D-1로 오표기하거나 윈도우 경계를 1일 어긋나게 함.
      const dd = calcDDay(post.deadline);
      if (!dd) continue;
      const daysLeft = dd.days;
      if (daysLeft > 0 && daysLeft <= DEADLINE_NOTIFY_DAYS) {
        items.push({ post, daysLeft });
      }
    }

    // 같은 daysLeft 내에선 내 아이 시기 정확 매칭(all_ages 제외) 우선
    const stageSet = new Set(myChildStages);
    const isMyChildMatch = (p: Post) =>
      stageSet.size > 0 &&
      p.stage_categories.some((s) => s !== "all_ages" && stageSet.has(s));

    items.sort((a, b) => {
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
      const aMy = isMyChildMatch(a.post) ? 1 : 0;
      const bMy = isMyChildMatch(b.post) ? 1 : 0;
      return bMy - aMy;
    });
    return items;
  } catch {
    return [];
  }
}

/**
 * 알림 종합 — 신규 매칭 + 마감 임박 합쳐 정렬
 */
export async function getNotifications(): Promise<NotificationItem[]> {
  // 내 아이 시기 미리 계산 → 마감 임박끼리 정렬 키로 사용
  const births = await getUserChildrenBirths();
  const myChildStages = getStagesForChildren(births);

  const [newMatches, deadlineSoon] = await Promise.all([
    getRecentMatchingCards(20),
    getInterestedDeadlineSoon(myChildStages),
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
