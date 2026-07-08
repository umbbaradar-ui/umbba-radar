// ============================================
// Curation Repository — 관리자 전용 DB 접근층
// 모든 상태의 카드(draft/pending/published/expired)에 접근
// 외부 모듈은 service.ts·actions.ts만 사용
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import type { Post, PostStatus, SourceType } from "@/shared/types/post";
import { isPastDeadline, kstTodayStartIso } from "@/shared/utils/dday";

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
  /** 검색 매칭용 동의어·유사어 (콤마 구분, UI 노출 X) */
  search_keywords?: string | null;
  /** ISO 또는 null. deadline_unknown=true면 actions가 자동 계산해서 채움 */
  deadline?: string | null;
  /** true면 마감 미정 — UI에 "추정" 표시, 푸시 알림 제외 */
  deadline_unknown?: boolean;
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

/**
 * 승인 — 단, 마감일(KST 날짜)이 이미 지난 카드는 published 대신 곧장 expired로 보관.
 * (지난달 카드를 뒤늦게 승인해도 피드에 "마감" 상태로 노출되는 일 방지)
 * @returns 실제 적용된 상태 — "published"(정상 발행) | "expired"(마감 보관)
 */
export async function approvePost(id: string): Promise<"published" | "expired"> {
  const { data: row, error: selErr } = await supabaseServer
    .from("posts")
    .select("deadline")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw new Error(`approvePost(select): ${selErr.message}`);

  const deadline = (row as { deadline: string | null } | null)?.deadline ?? null;
  const nextStatus: "published" | "expired" = isPastDeadline(deadline)
    ? "expired"
    : "published";

  const { error } = await supabaseServer
    .from("posts")
    .update({ status: nextStatus })
    .eq("id", id);
  if (error) throw new Error(`approvePost: ${error.message}`);
  return nextStatus;
}

/** 마감일(KST 날짜)이 지난 published 카드를 일괄 expired 처리.
 *  기준을 시각(now)이 아닌 "오늘 KST 00:00"으로 잡아 화면 D-day(캘린더 날짜)와 일치시킴
 *  — 마감일 당일 카드를 cron이 먼저 만료시키던 1일 오차 제거. */
export async function expireOverduePosts(): Promise<number> {
  const cutoff = kstTodayStartIso();
  const { data, error } = await supabaseServer
    .from("posts")
    .update({ status: "expired" })
    .eq("status", "published")
    .lt("deadline", cutoff)
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

// ============================================
// 수집 파이프라인 현황 — 팔로잉 계정 → 큐(찾은 게시물) → 발행 카드
// instagram_accounts / ingest_queue / posts 를 가로질러 집계 (관리자 대시보드용)
// ============================================
export interface PipelineStats {
  accountsActive: number;
  draftTotal: number; // 미분류(수집됨, 분류 대기) — BD 수집이 만든 draft 카드
  pendingTotal: number; // 분류완료, 검수 대기
  publishedTotal: number; // 발행
  /** 최근 24시간 자동수집 카드 (생성 / 그중 발행 / 검수대기 진입 / 마감보관) */
  last24h: { collected: number; published: number; pending: number; expired: number };
  /** 최근 N일 KST 일별 (오늘 포함, 최신이 먼저) */
  daily: Array<{ date: string; collected: number; published: number }>;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function toKstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export async function selectPipelineStats(days = 7): Promise<PipelineStats> {
  const now = Date.now();
  const since = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [accRes, draftRes, pendingRes, publishedRes, postRowsRes] =
    await Promise.all([
      supabaseServer
        .from("instagram_accounts")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      supabaseServer
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
      supabaseServer
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseServer
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabaseServer
        .from("posts")
        .select("created_at, status, source_type")
        .gte("created_at", since),
    ]);

  // KST 일별 버킷 (오늘 포함 최신 days일)
  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    dayKeys.push(
      new Date(now + KST_OFFSET_MS - i * 86400000).toISOString().slice(0, 10)
    );
  }
  const bucket = new Map<string, { collected: number; published: number }>();
  for (const d of dayKeys) bucket.set(d, { collected: 0, published: 0 });

  // 자동수집(ingestion) 카드: 생성=collected(draft+pending+published 무관), 그중 published 집계
  let collected24 = 0;
  let published24 = 0;
  let pending24 = 0;
  let expired24 = 0;
  for (const p of (postRowsRes.data ?? []) as {
    created_at: string;
    status: string;
    source_type: string;
  }[]) {
    if (p.source_type !== "ingestion") continue;
    const b = bucket.get(toKstDate(p.created_at));
    if (b) {
      b.collected++;
      if (p.status === "published") b.published++;
    }
    if (p.created_at >= since24h) {
      collected24++;
      if (p.status === "published") published24++;
      else if (p.status === "pending") pending24++;
      else if (p.status === "expired") expired24++;
    }
  }

  return {
    accountsActive: accRes.count ?? 0,
    draftTotal: draftRes.count ?? 0,
    pendingTotal: pendingRes.count ?? 0,
    publishedTotal: publishedRes.count ?? 0,
    last24h: { collected: collected24, published: published24, pending: pending24, expired: expired24 },
    daily: dayKeys.map((d) => ({ date: d, ...bucket.get(d)! })),
  };
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
  // 삭제 전 thumbnail_url 조회 — 우리 Storage(card-images)에 올린 이미지면 함께 정리(orphan 방지)
  const { data: row } = await supabaseServer
    .from("posts")
    .select("thumbnail_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseServer.from("posts").delete().eq("id", id);
  if (error) throw new Error(`deletePost: ${error.message}`);

  // 베스트에포트 Storage 정리 — 외부 URL(시드·og)은 건너뜀, 실패해도 삭제는 성공 처리
  const url = (row as { thumbnail_url: string | null } | null)?.thumbnail_url;
  if (url && url.includes("/card-images/")) {
    try {
      const path = url.split("/card-images/")[1]?.split("?")[0];
      if (path) {
        await supabaseServer.storage
          .from("card-images")
          .remove([decodeURIComponent(path)]);
      }
    } catch {
      // Storage 정리 실패는 무시(DB 삭제는 이미 완료). 별도 orphan 정리로 회수 가능.
    }
  }
}
