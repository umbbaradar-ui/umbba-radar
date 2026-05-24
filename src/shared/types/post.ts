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

// 2026-05 분류 체계 간소화 (migration 013 참조)
// 6개로 통합: preschool→toddler, elementary_lower+upper→elementary
// 옛 값은 마이그레이션 직후 사라지지만 배포 타이밍 보호용으로 union에 임시 포함.
export type StageCategory =
  | 'pregnancy'   // 임신중
  | 'newborn'     // 신생아 (옛 라벨 "출산 직후")
  | 'infant'      // 영아
  | 'toddler'     // 유아 (preschool 흡수)
  | 'elementary'  // 초등생 (저학년 + 고학년 통합, 신규 키)
  | 'all_ages'    // 전연령
  // ↓ deprecated — 마이그레이션 013 실행 후 DB에서 사라짐. 다음 PR에서 제거.
  | 'preschool'
  | 'elementary_lower'
  | 'elementary_upper'

// 2026-05 분류 체계 간소화 (migration 011 참조)
// 옛 값(follow/lottery/free_trial/experience_group/sponsored/gov_support)은
// DB 마이그레이션 직후 사라지지만, 배포 시점 timing 이슈로 1~2분 잔존 가능 →
// 잔여 카드 깨지지 않도록 union에 legacy 값도 임시 포함, 다음 정리 회차에 제거.
export type TypeTag =
  | 'regram'        // 리그램 (필수/옵션 구분 있어 의미 큰 카테고리)
  | 'experience'   // 체험단 (free_trial + experience_group + sponsored 통합)
  | 'kids_model'   // 키즈모델 (촬영·모델 활동, 신규)
  | 'supporters'   // 서포터즈 (장기 SNS 활동, 신규)
  // ↓ deprecated — 마이그레이션 011 실행 후 DB에서 사라짐. 다음 PR에서 제거.
  | 'follow'
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
  // 신규 6종
  pregnancy: '임신중',
  newborn: '신생아',
  infant: '영아',
  toddler: '유아',
  elementary: '초등생',
  all_ages: '전연령',
  // ↓ deprecated — 마이그레이션 013 잔여물 보호용
  preschool: '유아',
  elementary_lower: '초등생',
  elementary_upper: '초등생',
}

// 필터·관리자 폼·AI 프롬프트가 사용할 "현재 살아있는" 6개만 노출
export const ACTIVE_STAGE_CATEGORIES: readonly StageCategory[] = [
  'pregnancy',
  'newborn',
  'infant',
  'toddler',
  'elementary',
  'all_ages',
] as const

export const TYPE_LABELS: Record<TypeTag, string> = {
  // 신규 (관리자 입력 + AI 추출이 사용하는 정식 4종)
  regram: '리그램',
  experience: '체험단',
  kids_model: '키즈모델',
  supporters: '서포터즈',
  // ↓ deprecated — 마이그레이션 011 잔여물 보호용. 사용자 보기엔 무해.
  follow: '팔로우',
  lottery: '추첨',
  free_trial: '체험단',
  experience_group: '체험단',
  sponsored: '체험단',
  gov_support: '정부지원',
}

// 관리자 폼 / AI 프롬프트 / 필터 UI가 사용할 "현재 살아있는" 4개만 노출.
// TYPE_LABELS는 deprecated 포함이라 lookup용, 이건 enumeration용.
export const ACTIVE_TYPE_TAGS: readonly TypeTag[] = [
  'regram',
  'experience',
  'kids_model',
  'supporters',
] as const
