// ============================================
// ingest_queue Supabase repository
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import type {
  AddUrlsResult,
  IngestQueueItem,
  IngestQueueStatus,
  QueueStats,
  UrlInput,
} from "./types";

/**
 * 인스타 URL 정규화
 * - 쿼리 파라미터 제거 (?img_index=1 등)
 * - 끝 슬래시 제거
 * - 소문자화 (host)
 *
 * 인스타 URL 형식:
 *   https://www.instagram.com/p/{shortcode}/
 *   https://www.instagram.com/reel/{shortcode}/
 *
 * shortcode 만 고유키처럼 동작하므로 쿼리·해시 다 제거해도 OK
 */
export function normalizeInstagramUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (!/^https?:$/.test(u.protocol)) return null;
    // 쿼리, 해시 제거
    u.search = "";
    u.hash = "";
    // 끝 슬래시 한 번만
    let pathname = u.pathname.replace(/\/+$/, "");
    if (!pathname.endsWith("/")) pathname += "/";
    u.pathname = pathname;
    // host 소문자
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`;
  } catch {
    return null;
  }
}

/**
 * URL 리스트를 큐에 추가
 * - 정규화 → 형식 무효한 것 제외
 * - 이미 ingest_queue 에 있는 동일 URL 스킵
 * - 이미 posts 에 같은 source_url 있는 건 스킵 (이미 등록된 카드)
 * - 입력이 객체면 preview 정보 (source_username·post_date·caption_preview) 같이 저장
 */
export async function addUrlsToQueue(
  rawUrls: UrlInput[]
): Promise<AddUrlsResult> {
  const result: AddUrlsResult = {
    added: 0,
    skipped_duplicate_in_queue: 0,
    skipped_already_posted: 0,
    invalid: 0,
    invalidUrls: [],
  };

  // 1) 정규화 + 중복 제거 (in-batch). preview 정보 함께 보존.
  interface NormalizedItem {
    url: string;
    source_username: string | null;
    source_post_date: string | null;
    caption_preview: string | null;
  }
  const seen = new Set<string>();
  const normalized: NormalizedItem[] = [];
  for (const raw of rawUrls) {
    const isObject = typeof raw === "object" && raw !== null;
    const rawUrl = isObject ? raw.url : raw;
    const n = normalizeInstagramUrl(rawUrl);
    if (!n) {
      const display = (rawUrl ?? "").trim();
      if (display) {
        result.invalid++;
        result.invalidUrls.push(display.slice(0, 200));
      }
      continue;
    }
    if (seen.has(n)) continue;
    seen.add(n);
    normalized.push({
      url: n,
      source_username: isObject ? raw.source_username ?? null : null,
      source_post_date: isObject ? raw.source_post_date ?? null : null,
      caption_preview: isObject
        ? raw.caption_preview?.slice(0, 500) ?? null
        : null,
    });
  }

  if (normalized.length === 0) return result;

  const urlsOnly = normalized.map((n) => n.url);

  // 2) 이미 ingest_queue 에 있는 URL 제외
  const { data: existingQueue } = await supabaseServer
    .from("ingest_queue")
    .select("url")
    .in("url", urlsOnly);
  const existingQueueSet = new Set((existingQueue ?? []).map((r) => r.url as string));

  // 3) 이미 posts 에 있는 source_url 제외
  const { data: existingPosts } = await supabaseServer
    .from("posts")
    .select("source_url")
    .in("source_url", urlsOnly);
  const existingPostsSet = new Set(
    (existingPosts ?? []).map((r) => r.source_url as string)
  );

  // 4) 큐에 추가할 것만 추리기
  const toInsert: Array<{
    url: string;
    status: IngestQueueStatus;
    source_username: string | null;
    source_post_date: string | null;
    caption_preview: string | null;
  }> = [];
  for (const item of normalized) {
    if (existingQueueSet.has(item.url)) {
      result.skipped_duplicate_in_queue++;
      continue;
    }
    if (existingPostsSet.has(item.url)) {
      result.skipped_already_posted++;
      continue;
    }
    toInsert.push({
      url: item.url,
      status: "todo",
      source_username: item.source_username,
      source_post_date: item.source_post_date,
      caption_preview: item.caption_preview,
    });
  }

  if (toInsert.length === 0) return result;

  // 5) 일괄 INSERT
  const { error: insertError, count } = await supabaseServer
    .from("ingest_queue")
    .insert(toInsert, { count: "exact" });

  if (insertError) {
    throw new Error(`큐 저장 실패: ${insertError.message}`);
  }

  result.added = count ?? toInsert.length;
  return result;
}

/** 큐 전체 조회 (관리자 검수용) — 최신순 */
export async function listQueue(limit = 100): Promise<IngestQueueItem[]> {
  const { data, error } = await supabaseServer
    .from("ingest_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as IngestQueueItem[];
}

/** 큐 상태 통계 */
export async function getQueueStats(): Promise<QueueStats> {
  const stats: QueueStats = {
    todo: 0,
    processing: 0,
    done: 0,
    duplicate: 0,
    failed: 0,
    total: 0,
  };

  const statuses: IngestQueueStatus[] = [
    "todo",
    "processing",
    "done",
    "duplicate",
    "failed",
  ];

  await Promise.all(
    statuses.map(async (s) => {
      const { count } = await supabaseServer
        .from("ingest_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      stats[s] = count ?? 0;
      stats.total += count ?? 0;
    })
  );

  return stats;
}

/**
 * CLI 가 호출하는 atomic claim
 * todo 인 행 N개를 processing 으로 바꾸고 claimed_at 기록 → 반환
 *
 * 동시 실행 안전성: Supabase 의 update returning 사용 + select for update 흉내
 *   PostgreSQL 자체 RLS/lock 까진 안 가고, 실용적으로 single CLI 운영 가정
 */
export async function claimNext(limit: number): Promise<IngestQueueItem[]> {
  // 1) todo 인 행 N개 id 가져오기
  const { data: candidates } = await supabaseServer
    .from("ingest_queue")
    .select("id")
    .eq("status", "todo")
    .order("created_at", { ascending: true })
    .limit(limit);

  const ids = (candidates ?? []).map((r) => r.id as string);
  if (ids.length === 0) return [];

  // 2) 일괄 update → processing (race 시 다른 CLI 가 먼저 잡았으면 결과는 빈 배열)
  const { data: updated, error } = await supabaseServer
    .from("ingest_queue")
    .update({ status: "processing", claimed_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "todo") // race-safe
    .select("*");

  if (error) throw new Error(error.message);
  return (updated ?? []) as IngestQueueItem[];
}

export async function markDone(
  id: string,
  postId: string | null
): Promise<void> {
  const { error } = await supabaseServer
    .from("ingest_queue")
    .update({
      status: "done",
      post_id: postId,
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markDuplicate(id: string, postId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("ingest_queue")
    .update({
      status: "duplicate",
      post_id: postId,
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markFailed(id: string, message: string): Promise<void> {
  // attempts 증가
  const { data: current } = await supabaseServer
    .from("ingest_queue")
    .select("attempts")
    .eq("id", id)
    .single();
  const attempts = (current?.attempts ?? 0) + 1;

  const { error } = await supabaseServer
    .from("ingest_queue")
    .update({
      status: "failed",
      processed_at: new Date().toISOString(),
      error: message.slice(0, 500),
      attempts,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** failed 또는 done 항목 재시도 (status → todo) */
export async function requeue(id: string): Promise<void> {
  const { error } = await supabaseServer
    .from("ingest_queue")
    .update({
      status: "todo",
      claimed_at: null,
      processed_at: null,
      error: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** processing 인데 일정 시간 지난 것 → todo 로 복귀 (CLI 가 죽었을 때) */
export async function reapStuckProcessing(
  timeoutMs = 10 * 60 * 1000
): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMs).toISOString();
  const { data, error } = await supabaseServer
    .from("ingest_queue")
    .update({ status: "todo", claimed_at: null })
    .eq("status", "processing")
    .lt("claimed_at", cutoff)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function deleteQueueItem(id: string): Promise<void> {
  const { error } = await supabaseServer
    .from("ingest_queue")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
