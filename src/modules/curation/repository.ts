// ============================================
// Curation Repository — 관리자 전용 DB 접근층
// 모든 상태의 카드(draft/pending/published/expired)에 접근
// 외부 모듈은 service.ts·actions.ts만 사용
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import type { Post, PostStatus } from "@/shared/types/post";

export async function selectAllPosts(): Promise<Post[]> {
  const { data, error } = await supabaseServer
    .from("posts")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`selectAllPosts: ${error.message}`);
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
