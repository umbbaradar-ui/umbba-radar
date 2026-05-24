// ============================================
// Content Repository — DB 접근층 (모듈 내부 전용)
// 외부 모듈은 service.ts 만 import 할 것
// ============================================

import { supabase } from '@/shared/db/supabase'
import type { Post } from '@/shared/types/post'

export async function selectPublishedPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('deadline', { ascending: true, nullsFirst: false })

  if (error) {
    throw new Error(`Failed to fetch published posts: ${error.message}`)
  }
  return (data ?? []) as Post[]
}

export async function selectExpiredPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "expired")
    .order("deadline", { ascending: false }) // 최근 마감 먼저
    .limit(100);

  if (error) {
    throw new Error(`Failed to fetch expired posts: ${error.message}`);
  }
  return (data ?? []) as Post[];
}

export async function selectPostById(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch post ${id}: ${error.message}`)
  }
  return (data as Post | null) ?? null
}
