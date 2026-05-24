// ============================================
// Curation Repository — 관리자 전용 DB 접근층
// 모든 상태의 카드(draft/pending/published/expired)에 접근
// 외부 모듈은 service.ts·actions.ts만 사용
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import type { Post, PostStatus, SourceType } from "@/shared/types/post";

export async function selectAllPosts(): Promise<Post[]> {
  const { data, error } = await supabaseServer
    .from("posts")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`selectAllPosts: ${error.message}`);
  return (data ?? []) as Post[];
}

export async function selectPendingPosts(filter?: SourceType): Promise<Post[]> {
  let query = supabaseServer
    .from("posts")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true }); // 오래된 것부터

  if (filter) query = query.eq("source_type", filter);

  const { data, error } = await query;
  if (error) throw new Error(`selectPendingPosts: ${error.message}`);
  return (data ?? []) as Post[];
}

export async function selectPostByIdAdmin(id: string): Promise<Post | null> {
  const { data, error } = await supabaseServer
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`selectPostByIdAdmin: ${error.message}`);
  return (data as Post | null) ?? null;
}

export interface PostInsertInput {
  kind: string;
  title: string;
  brand_name?: string | null;
  thumbnail_url?: string | null;
  source_url: string;
  body?: string | null;
  deadline?: string | null;
  reviewer_handle?: string | null;
  stage_categories: string[];
  type_tags: string[];
  topic?: string; // 'parenting' | 'living' — 미지정 시 DB DEFAULT 'parenting'
  is_sponsored?: boolean;
  status: PostStatus;
  source_type?: SourceType;
  submitter_handle?: string | null;
  submitter_user_id?: string | null;
}

export async function approvePost(id: string): Promise<void> {
  const { error } = await supabaseServer
    .from("posts")
    .update({ status: "published" })
    .eq("id", id);
  if (error) throw new Error(`approvePost: ${error.message}`);
}

/** 마감일 지난 published 카드를 일괄 expired 처리 */
export async function expireOverduePosts(): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("posts")
    .update({ status: "expired" })
    .eq("status", "published")
    .lt("deadline", nowIso)
    .not("deadline", "is", null)
    .select("id");
  if (error) throw new Error(`expireOverduePosts: ${error.message}`);
  return data?.length ?? 0;
}

export interface AdminStats {
  totals: {
    posts: number;
    pending: number;
    published: number;
    expired: number;
    draft: number;
  };
  bySource: Record<SourceType, number>;
  byStage: Record<string, number>;
  byType: Record<string, number>;
  /** 기간 내 (최근 N일) 이벤트 카운트 */
  events: {
    card_click: number;
    source_link_click: number;
    status_mark: number;
    search: number;
    login_attempt: number;
    signup_attempt: number;
  };
  /** 원문 클릭률 = source_link_click / card_click (결정적 KPI) */
  ctr: number;
  /** 고유 사용자 수 (anon_id + user_id 합집합) */
  uniqueUsers: number;
  /** 카드별 클릭 통계 Top 10 */
  topCards: Array<{
    post_id: string;
    title: string;
    card_clicks: number;
    source_clicks: number;
    ctr: number;
  }>;
  /** 기간 (일) */
  periodDays: number;
}

export async function selectAdminStats(periodDays: number = 7): Promise<AdminStats> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  // 1. 카드 — 상태·소스·시기·유형
  const { data: posts } = await supabaseServer
    .from("posts")
    .select("id, title, status, source_type, stage_categories, type_tags");

  // 2. 이벤트 (최근 N일)
  const { data: events } = await supabaseServer
    .from("events")
    .select("event_name, post_id, anon_id, user_id, created_at")
    .gte("created_at", since);

  // 집계
  const totals = {
    posts: posts?.length ?? 0,
    pending: 0,
    published: 0,
    expired: 0,
    draft: 0,
  };
  const bySource: Record<SourceType, number> = { admin: 0, ingestion: 0, submission: 0 };
  const byStage: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const postTitleMap = new Map<string, string>();

  for (const p of (posts ?? []) as Array<{
    id: string;
    title: string;
    status: PostStatus;
    source_type: SourceType;
    stage_categories: string[];
    type_tags: string[];
  }>) {
    postTitleMap.set(p.id, p.title);
    if (p.status === "published") totals.published++;
    else if (p.status === "pending") totals.pending++;
    else if (p.status === "expired") totals.expired++;
    else if (p.status === "draft") totals.draft++;

    bySource[p.source_type] = (bySource[p.source_type] ?? 0) + 1;
    if (p.status === "published") {
      for (const s of p.stage_categories ?? []) byStage[s] = (byStage[s] ?? 0) + 1;
      for (const t of p.type_tags ?? []) byType[t] = (byType[t] ?? 0) + 1;
    }
  }

  // 이벤트 집계
  const eventCounts = {
    card_click: 0,
    source_link_click: 0,
    status_mark: 0,
    search: 0,
    login_attempt: 0,
    signup_attempt: 0,
  };
  const cardClicks = new Map<string, number>();
  const sourceClicks = new Map<string, number>();
  const uniqueIds = new Set<string>();

  for (const ev of (events ?? []) as Array<{
    event_name: string;
    post_id: string | null;
    anon_id: string | null;
    user_id: string | null;
  }>) {
    if (ev.event_name in eventCounts) {
      eventCounts[ev.event_name as keyof typeof eventCounts]++;
    }
    if (ev.event_name === "card_click" && ev.post_id) {
      cardClicks.set(ev.post_id, (cardClicks.get(ev.post_id) ?? 0) + 1);
    }
    if (ev.event_name === "source_link_click" && ev.post_id) {
      sourceClicks.set(ev.post_id, (sourceClicks.get(ev.post_id) ?? 0) + 1);
    }
    const id = ev.user_id || ev.anon_id;
    if (id) uniqueIds.add(id);
  }

  const ctr =
    eventCounts.card_click > 0
      ? eventCounts.source_link_click / eventCounts.card_click
      : 0;

  // 카드별 Top 10 (card_click + source_click 합 기준)
  const cardScores: Array<{
    post_id: string;
    title: string;
    card_clicks: number;
    source_clicks: number;
    ctr: number;
  }> = [];
  const allCardIds = new Set([...cardClicks.keys(), ...sourceClicks.keys()]);
  for (const id of allCardIds) {
    const cc = cardClicks.get(id) ?? 0;
    const sc = sourceClicks.get(id) ?? 0;
    cardScores.push({
      post_id: id,
      title: postTitleMap.get(id) ?? "(삭제됨)",
      card_clicks: cc,
      source_clicks: sc,
      ctr: cc > 0 ? sc / cc : 0,
    });
  }
  cardScores.sort((a, b) => b.card_clicks + b.source_clicks - (a.card_clicks + a.source_clicks));

  return {
    totals,
    bySource,
    byStage,
    byType,
    events: eventCounts,
    ctr,
    uniqueUsers: uniqueIds.size,
    topCards: cardScores.slice(0, 10),
    periodDays,
  };
}

export async function selectStatusCounts(): Promise<{
  byStatus: Record<PostStatus, number>;
  bySource: Record<SourceType, number>;
}> {
  const { data, error } = await supabaseServer
    .from("posts")
    .select("status, source_type");
  if (error) throw new Error(`selectStatusCounts: ${error.message}`);

  const byStatus: Record<PostStatus, number> = {
    draft: 0,
    pending: 0,
    published: 0,
    expired: 0,
  };
  const bySource: Record<SourceType, number> = {
    admin: 0,
    ingestion: 0,
    submission: 0,
  };
  for (const row of (data ?? []) as { status: PostStatus; source_type: SourceType }[]) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    bySource[row.source_type] = (bySource[row.source_type] ?? 0) + 1;
  }
  return { byStatus, bySource };
}

export async function insertPost(input: PostInsertInput): Promise<Post> {
  const { data, error } = await supabaseServer
    .from("posts")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`insertPost: ${error.message}`);
  return data as Post;
}

export async function updatePost(
  id: string,
  input: Partial<PostInsertInput>
): Promise<Post> {
  const { data, error } = await supabaseServer
    .from("posts")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`updatePost: ${error.message}`);
  return data as Post;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabaseServer.from("posts").delete().eq("id", id);
  if (error) throw new Error(`deletePost: ${error.message}`);
}
