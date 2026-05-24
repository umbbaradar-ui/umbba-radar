// ============================================
// Content Service — 공개 창구
// 다른 모듈·UI는 이 파일만 import 한다
// ============================================

import {
  selectPublishedPosts,
  selectPostById,
  selectExpiredPosts,
  type SelectPostsOptions,
  type SortMode,
} from './repository'
import type { Post } from '@/shared/types/post'

/** 발행된 카드 (필터·정렬·검색 옵션) */
export async function listPosts(options: SelectPostsOptions = {}): Promise<Post[]> {
  return selectPublishedPosts(options)
}

/** 지난 이벤트 (expired) — /archive 페이지용 */
export async function listExpiredPosts(): Promise<Post[]> {
  return selectExpiredPosts()
}

/** 단일 카드 조회 */
export async function getPost(id: string): Promise<Post | null> {
  return selectPostById(id)
}

export type { Post, SortMode }
