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

// 주제 분류 (시기·유형과 별개의 axis)
// parenting: 부모-자녀 활동, 아동 관련 (대부분 카드)
// living: 가전·가구·식기·생활용품 등 살림 관련
export type TopicCategory = 'parenting' | 'living'

export const TOPIC_LABELS: Record<TopicCategory, string> = {
  parenting: '육아',
  living: '리빙',
}

export const ACTIVE_TOPIC_CATEGORIES: readonly TopicCategory[] = [
  'parenting',
  'living',
] as const

// 2026-05 분류 체계 간소화 (migration 013): preschool→toddler, elementary_lower+upper→elementary
export type StageCategory =
  | 'pregnancy'   // 임신중
  | 'newborn'     // 신생아
  | 'infant'      // 영아
  | 'toddler'     // 유아
  | 'elementary'  // 초등생
  | 'all_ages'    // 전연령

// 2026-05 분류 체계 간소화 (migration 011): free_trial+experience_group+sponsored→experience, follow/lottery/gov_support 제거
// 2026-05 후반: form 추가 — 네이버폼/구글폼/자체폼 등 별도 작성 필수인 카드 식별 (진입장벽 인지)
export type TypeTag =
  | 'regram'       // 리그램
  | 'experience'   // 체험단
  | 'kids_model'   // 키즈모델
  | 'supporters'   // 서포터즈
  | 'form'         // 폼 작성 필수 (네이버폼/구글폼/자체폼)

export interface Post {
  id: string
  kind: PostKind
  title: string
  brand_name: string | null
  thumbnail_url: string | null
  source_url: string
  body: string | null
  /** 검색 매칭용 동의어·유사어 (콤마 구분, UI 노출 X). 예: "기저귀,팬티,기저귀팬티" */
  search_keywords: string | null
  deadline: string | null
  /** true = 실제 마감일 모름, deadline은 등록일+7일 자동 계산값 (UI에 "추정" 표시) */
  deadline_unknown: boolean
  reviewer_handle: string | null
  stage_categories: StageCategory[]
  type_tags: TypeTag[]
  topic: TopicCategory
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
  newborn: '신생아',
  infant: '영아',
  toddler: '유아',
  elementary: '초등생',
  all_ages: '전연령',
}

export const ACTIVE_STAGE_CATEGORIES: readonly StageCategory[] = [
  'pregnancy',
  'newborn',
  'infant',
  'toddler',
  'elementary',
  'all_ages',
] as const

export const TYPE_LABELS: Record<TypeTag, string> = {
  regram: '리그램',
  experience: '체험단',
  kids_model: '키즈모델',
  supporters: '서포터즈',
  form: '폼 작성',
}

export const ACTIVE_TYPE_TAGS: readonly TypeTag[] = [
  'regram',
  'experience',
  'kids_model',
  'supporters',
  'form',
] as const
