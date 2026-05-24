// ============================================
// Content Repository — DB 접근층 (모듈 내부 전용)
// 외부 모듈은 service.ts 만 import 할 것
// ============================================

import { supabase } from "@/shared/db/supabase";
import type { Post } from "@/shared/types/post";

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
  const { q, sort = "deadline_asc", limit = 100 } = options;

  let query = supabase.from("posts").select("*").eq("status", "published");

  // 검색어 필터
  if (q) {
    const safe = sanitizeSearchTerm(q);
    if (safe) {
      const pattern = `%${safe}%`;
      query = query.or(
        `title.ilike.${pattern},brand_name.ilike.${pattern},body.ilike.${pattern}`
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
