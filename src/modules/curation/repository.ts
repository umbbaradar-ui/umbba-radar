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
