// ============================================
// Content Service — 공개 창구
// 다른 모듈·UI는 이 파일만 import 한다
// ============================================

import { selectPublishedPosts, selectPostById } from './repository'
import type { Post } from '@/shared/types/post'

/** 발행된 카드 전체 (마감 임박순) */
export async function listPosts(): Promise<Post[]> {
  return selectPublishedPosts()
}

/** 단일 카드 조회 */
export async function getPost(id: string): Promise<Post | null> {
  return selectPostById(id)
}

export type { Post }
