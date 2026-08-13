// ============================================
// Curation Service — 관리자 페이지가 호출하는 공개 창구
// 모든 함수는 server-only
// ============================================

import "server-only";
import {
  selectActivePostsAdmin,
  selectExpiredPostsPage,
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

/** 어드민 메인 초기 로드 — 활성(초안·승인대기·발행)만. 마감은 listExpiredPage로 지연 로드 */
export async function listActivePosts(): Promise<Post[]> {
  return selectActivePostsAdmin();
}

/** 마감 카드 페이지 조회 (최근 마감 순) */
export async function listExpiredPage(
  offset: number,
  pageSize: number
): Promise<Post[]> {
  return selectExpiredPostsPage(offset, pageSize);
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
