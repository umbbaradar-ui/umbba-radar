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
  selectAdminStats,
  selectPipelineStats,
  type PostInsertInput,
  type AdminStats,
  type PipelineStats,
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

export async function getAdminStats(periodDays = 7): Promise<AdminStats> {
  return selectAdminStats(periodDays);
}

export async function getPipelineStats(days = 7): Promise<PipelineStats> {
  return selectPipelineStats(days);
}

export type { PostInsertInput, AdminStats, PipelineStats };
