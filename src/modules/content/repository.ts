// ============================================
// Content Repository — DB 접근층 (모듈 내부 전용)
// 외부 모듈은 service.ts 만 import 할 것
// ============================================

import { supabase } from "@/shared/db/supabase";
import type { Post } from "@/shared/types/post";
import { kstTodayStartIso } from "@/shared/utils/dday";

export type SortMode = "deadline_asc" | "created_desc" | "deadline_desc";

export interface SelectPostsOptions {
  q?: string;
  sort?: SortMode;
  limit?: number;
}

/** 검색어를 ILIKE 패턴으로 안전하게 정제 (특수 문자 이스케이프) */
function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[%_,()]/g, " ") // PostgREST OR 구분자·LIKE 와일드카드 제거
    .trim()
    .slice(0, 50);
}

export async function selectPublishedPosts(
  options: SelectPostsOptions = {}
): Promise<Post[]> {
  // 기본 limit 상향(100→300) — 발행 카드 누적 시 마감 먼·상시 카드가 조용히 잘리는 것 완화(스톱갭).
  // 카드 수가 더 늘면 keyset 페이지네이션으로 전환(감사 보고 §5.2).
  const { q, sort = "deadline_asc", limit = 300 } = options;

  let query = supabase.from("posts").select("*").eq("status", "published");

  // 마감일(KST 날짜)이 지난 카드는 피드에서 즉시 제외.
  // cron(expireOverduePosts)이 status를 expired로 정리하기 전이라도 사용자에겐 안 보이게 함.
  // deadline 없는 상시 카드는 유지(deadline.is.null). 기준은 "오늘 KST 00:00".
  const todayStart = kstTodayStartIso();
  query = query.or(`deadline.gte.${todayStart},deadline.is.null`);

  // 검색어 필터 — title/brand_name/body + search_keywords(동의어) 4개 컬럼 ILIKE OR
  // search_keywords는 관리자 직접 입력 또는 AI 자동 생성한 동의어 (콤마 구분 텍스트)
  if (q) {
    const safe = sanitizeSearchTerm(q);
    if (safe) {
      const pattern = `%${safe}%`;
      query = query.or(
        `title.ilike.${pattern},brand_name.ilike.${pattern},body.ilike.${pattern},search_keywords.ilike.${pattern}`
      );
    }
  }

  // 정렬
  switch (sort) {
    case "created_desc":
      query = query.order("created_at", { ascending: false });
      break;
    case "deadline_desc":
      query = query.order("deadline", { ascending: false, nullsFirst: false });
      break;
    case "deadline_asc":
    default:
      query = query.order("deadline", { ascending: true, nullsFirst: false });
      break;
  }

  query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch published posts: ${error.message}`);
  }
  return (data ?? []) as Post[];
}

export async function selectExpiredPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "expired")
    .order("deadline", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to fetch expired posts: ${error.message}`);
  }
  return (data ?? []) as Post[];
}

export async function selectPostById(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch post ${id}: ${error.message}`);
  }
  return (data as Post | null) ?? null;
}
