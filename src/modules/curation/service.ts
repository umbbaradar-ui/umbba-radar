// ============================================
// Curation Service — 관리자 페이지가 호출하는 공개 창구
// 모든 함수는 server-only
// ============================================

import "server-only";
import {
  selectAllPosts,
  selectPostByIdAdmin,
  selectPendingPosts,
  selectStatusCounts,
  type PostInsertInput,
} from "./repository";
import type { Post, SourceType } from "@/shared/types/post";

export async function listAllPosts(): Promise<Post[]> {
  return selectAllPosts();
}

export async function getPostForAdmin(id: string): Promise<Post | null> {
  return selectPostByIdAdmin(id);
}

export async function listPendingPosts(filter?: SourceType): Promise<Post[]> {
  return selectPendingPosts(filter);
}

export async function getCounts() {
  return selectStatusCounts();
}

export type { PostInsertInput };
