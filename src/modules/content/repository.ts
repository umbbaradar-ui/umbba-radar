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

// Supabase(PostgREST) 1회 응답 상한 — 대시보드 Max Rows 기본값과 동일하게 유지할 것
const PAGE_SIZE = 1000;

export async function selectPublishedPosts(
  options: SelectPostsOptions = {}
): Promise<Post[]> {
  // limit 미지정 시 "노출 대상 발행 카드 전량"을 페이지 루프로 로드 — 카드 누락 제로가 원칙.
  // (기존 limit 300 스톱갭은 발행 391건 시점에 91건이 조용히 잘려서 제거, 2026-08-13)
  const { q, sort = "deadline_asc", limit } = options;

  // Supabase 쿼리 빌더는 1회용이라 페이지마다 새로 조립
  function buildQuery() {
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

    // 정렬 — 페이지 경계에서 행이 겹치거나 빠지지 않도록 id 2차 정렬로 순서 고정
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
    return query.order("id", { ascending: true });
  }

  const all: Post[] = [];
  for (;;) {
    const size = limit ? Math.min(PAGE_SIZE, limit - all.length) : PAGE_SIZE;
    if (size <= 0) break;

    const { data, error } = await buildQuery().range(
      all.length,
      all.length + size - 1
    );
    if (error) {
      throw new Error(`Failed to fetch published posts: ${error.message}`);
    }

    all.push(...((data ?? []) as Post[]));
    if (!data || data.length < size) break; // 마지막 페이지
  }
  return all;
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
