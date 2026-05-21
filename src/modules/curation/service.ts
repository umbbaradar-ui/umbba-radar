// ============================================
// Curation Service — 관리자 페이지가 호출하는 공개 창구
// 모든 함수는 server-only
// ============================================

import "server-only";
import {
  selectAllPosts,
  selectPostByIdAdmin,
  type PostInsertInput,
} from "./repository";
import type { Post } from "@/shared/types/post";

export async function listAllPosts(): Promise<Post[]> {
  return selectAllPosts();
}

export async function getPostForAdmin(id: string): Promise<Post | null> {
  return selectPostByIdAdmin(id);
}

export type { PostInsertInput };
