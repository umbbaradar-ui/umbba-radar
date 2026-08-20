// ============================================
// Curation Repository — 관리자 전용 DB 접근층
// 모든 상태의 카드(draft/pending/published/expired)에 접근
// 외부 모듈은 service.ts·actions.ts만 사용
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import { fetchAllRows } from "@/shared/db/fetch-all-rows";
import type { Post, PostStatus, SourceType } from "@/shared/types/post";
import { isPastDeadline, kstTodayStartIso } from "@/shared/utils/dday";

/** 활성 카드(초안·승인대기·발행) 전량 — 어드민 메인 목록용. 마감 카드는 selectExpiredPostsPage로 지연 로드 */
export async function selectActivePostsAdmin(): Promise<Post[]> {
  return fetchAllRows<Post>("selectActivePostsAdmin", (from, to) =>
    supabaseServer
      .from("posts")
      .select("*")
      .neq("status", "expired")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }) // 페이지 경계 순서 고정
      .range(from, to)
  );
}

/** 마감 카드 페이지 조회 — 어드민 "마감" 탭에서 필요할 때만 100건 단위로 불러옴 */
export async function selectExpiredPostsPage(
  offset: number,
  pageSize: number
): Promise<Post[]> {
  const { data, error } = await supabaseServer
    .from("posts")
    .select("*")
    .eq("status", "expired")
    .order("deadline", { ascending: false, nullsFirst: false }) // 최근 마감부터
    .order("id", { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(`selectExpiredPostsPage: ${error.message}`);
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
  /** 품목 카테고리 (022) — sanitizeItemCategories 통과값만 넣을 것 */
  item_categories?: string[];
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
  /**
   * 영역(zone)별 카드 진입 성과 — `card_open` 이벤트 기반 (2026-08-20 도입).
   * 나중에 배너·프리미엄 카드를 "실제로 눌리는 자리"에 배치하고,
   * B2B 상품화 시 자리별 단가 근거로 쓰기 위한 선행 집계.
   */
  byZone: Array<{
    zone: string;
    opens: number;
    /** 그 영역에서 들어간 카드 중 원문까지 간 비율(추정) */
    sourceClicks: number;
    /** 자리별 클릭 분포 — index 0부터, 상위 8자리까지 */
    byPosition: number[];
  }>;
  /** 기간 (일) */
  periodDays: number;
}

export async function selectAdminStats(periodDays: number = 7): Promise<AdminStats> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  // 1. 카드 — 상태·소스·시기·유형 (1,000행 상한 회피를 위해 전량 페이지 루프)
  const posts = await fetchAllRows<{
    id: string;
    title: string;
    status: PostStatus;
    source_type: SourceType;
    stage_categories: string[];
    type_tags: string[];
  }>("selectAdminStats.posts", (from, to) =>
    supabaseServer
      .from("posts")
      .select("id, title, status, source_type, stage_categories, type_tags")
      .order("id", { ascending: true })
      .range(from, to)
  );

  // 2. 이벤트 (최근 N일) — 트래픽이 늘면 1,000건을 금방 넘으므로 역시 전량 루프
  const events = await fetchAllRows<{
    event_name: string;
    post_id: string | null;
    anon_id: string | null;
    user_id: string | null;
    created_at: string;
    properties: Record<string, unknown> | null;
  }>("selectAdminStats.events", (from, to) =>
    supabaseServer
      .from("events")
      .select("event_name, post_id, anon_id, user_id, created_at, properties")
      .gte("created_at", since)
      .order("id", { ascending: true })
      .range(from, to)
  );

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

  // 영역·자리별 집계 (card_open) — 어느 자리가 실제로 눌리는지
  const zoneOpens = new Map<string, number>();
  const zonePositions = new Map<string, number[]>();
  /** card_open으로 진입한 post_id → zone. 뒤이은 source_link_click을 영역에 귀속시킴 */
  const lastZoneByPost = new Map<string, string>();
  const zoneSourceClicks = new Map<string, number>();
  const POSITION_BUCKETS = 8;

  for (const ev of (events ?? [])) {
    if (ev.event_name in eventCounts) {
      eventCounts[ev.event_name as keyof typeof eventCounts]++;
    }
    if (ev.event_name === "card_click" && ev.post_id) {
      cardClicks.set(ev.post_id, (cardClicks.get(ev.post_id) ?? 0) + 1);
    }
    if (ev.event_name === "source_link_click" && ev.post_id) {
      sourceClicks.set(ev.post_id, (sourceClicks.get(ev.post_id) ?? 0) + 1);
      // 직전에 어느 영역에서 이 카드로 들어왔는지 알면 그 영역 실적으로 귀속
      const zone = lastZoneByPost.get(ev.post_id);
      if (zone) zoneSourceClicks.set(zone, (zoneSourceClicks.get(zone) ?? 0) + 1);
    }
    if (ev.event_name === "card_open") {
      const props = ev.properties ?? {};
      const zone = typeof props.zone === "string" ? props.zone : "unknown";
      zoneOpens.set(zone, (zoneOpens.get(zone) ?? 0) + 1);

      const pos = typeof props.position === "number" ? props.position : -1;
      if (pos >= 0) {
        const arr = zonePositions.get(zone) ?? new Array(POSITION_BUCKETS).fill(0);
        arr[Math.min(pos, POSITION_BUCKETS - 1)]++;
        zonePositions.set(zone, arr);
      }
      if (ev.post_id) lastZoneByPost.set(ev.post_id, zone);
    }
    const id = ev.user_id || ev.anon_id;
    if (id) uniqueIds.add(id);
  }

  const byZone = [...zoneOpens.entries()]
    .map(([zone, opens]) => ({
      zone,
      opens,
      sourceClicks: zoneSourceClicks.get(zone) ?? 0,
      byPosition: zonePositions.get(zone) ?? [],
    }))
    .sort((a, b) => b.opens - a.opens);

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
    byZone,
    periodDays,
  };
}

export async function selectStatusCounts(): Promise<{
  byStatus: Record<PostStatus, number>;
  bySource: Record<SourceType, number>;
}> {
  // 행을 내려받아 세면 PAGE_SIZE 상한에 걸려 1,000에서 멈춤 → count=exact HEAD 쿼리로 정확 집계
  const countWhere = async (column: "status" | "source_type", value: string) => {
    const { count, error } = await supabaseServer
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq(column, value);
    if (error) throw new Error(`selectStatusCounts(${value}): ${error.message}`);
    return count ?? 0;
  };

  const [draft, pending, published, expired, admin, ingestion, submission] =
    await Promise.all([
      countWhere("status", "draft"),
      countWhere("status", "pending"),
      countWhere("status", "published"),
      countWhere("status", "expired"),
      countWhere("source_type", "admin"),
      countWhere("source_type", "ingestion"),
      countWhere("source_type", "submission"),
    ]);

  return {
    byStatus: { draft, pending, published, expired },
    bySource: { admin, ingestion, submission },
  };
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
  /** 최근 24시간 자동수집 카드 (생성 / 그중 발행) */
  last24h: { collected: number; published: number };
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
    }
  }

  return {
    accountsActive: accRes.count ?? 0,
    draftTotal: draftRes.count ?? 0,
    pendingTotal: pendingRes.count ?? 0,
    publishedTotal: publishedRes.count ?? 0,
    last24h: { collected: collected24, published: published24 },
    daily: dayKeys.map((d) => ({ date: d, ...bucket.get(d)! })),
  };
}

export async function insertPost(input: PostInsertInput): Promise<Post> {
  let { data, error } = await supabaseServer
    .from("posts")
    .insert(input)
    .select()
    .single();

  // 마이그레이션 022 미적용 DB — 품목만 빼고 재시도
  if (error && error.message.includes("item_categories")) {
    const { item_categories: _drop, ...rest } = input;
    void _drop;
    ({ data, error } = await supabaseServer
      .from("posts")
      .insert(rest)
      .select()
      .single());
  }

  if (error) throw new Error(`insertPost: ${error.message}`);
  return data as Post;
}

export async function updatePost(
  id: string,
  input: Partial<PostInsertInput>
): Promise<Post> {
  let { data, error } = await supabaseServer
    .from("posts")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  // 마이그레이션 022 미적용 DB — 품목만 빼고 재시도
  if (error && error.message.includes("item_categories")) {
    const { item_categories: _drop, ...rest } = input;
    void _drop;
    ({ data, error } = await supabaseServer
      .from("posts")
      .update(rest)
      .eq("id", id)
      .select()
      .single());
  }

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
