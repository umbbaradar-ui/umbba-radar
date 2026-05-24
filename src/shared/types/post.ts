// ============================================
// 엄빠레이더 — Post 도메인 타입
// DB 스키마 supabase/migrations/001 과 일치해야 함
// ============================================

export type PostKind = 'recruiting' | 'review' | 'group_buy' | 'sponsored_ad'

export type PostStatus = 'draft' | 'pending' | 'published' | 'expired'

export type SourceType = 'admin' | 'ingestion' | 'submission'

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  admin: '관리자',
  ingestion: '자동수집',
  submission: '제보',
}

export type StageCategory =
  | 'pregnancy'
  | 'newborn'
  | 'infant'
  | 'toddler'
  | 'preschool'
  | 'elementary_lower'
  | 'elementary_upper'
  | 'all_ages'

export type TypeTag =
  | 'follow'
  | 'regram'
  | 'lottery'
  | 'free_trial'
  | 'experience_group'
  | 'sponsored'
  | 'gov_support'

export interface Post {
  id: string
  kind: PostKind
  title: string
  brand_name: string | null
  thumbnail_url: string | null
  source_url: string
  body: string | null
  deadline: string | null
  reviewer_handle: string | null
  stage_categories: StageCategory[]
  type_tags: TypeTag[]
  is_sponsored: boolean
  pinned_until: string | null
  status: PostStatus
  application_mode: 'external' | 'internal'
  source_type: SourceType
  submitter_handle: string | null
  submitter_user_id: string | null
  created_at: string
  updated_at: string
}

// 화면 표시용 라벨
export const STAGE_LABELS: Record<StageCategory, string> = {
  pregnancy: '임신중',
  newborn: '출산 직후',
  infant: '영아',
  toddler: '유아',
  preschool: '유치원',
  elementary_lower: '초등 저학년',
  elementary_upper: '초등 고학년',
  all_ages: '전연령',
}

export const TYPE_LABELS: Record<TypeTag, string> = {
  follow: '팔로우',
  regram: '리그램',
  lottery: '추첨',
  free_trial: '무료체험',
  experience_group: '체험단',
  sponsored: '협찬',
  gov_support: '정부지원',
}
