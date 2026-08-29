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
  | 'giveaway'     // 단순 증정 (댓글·추첨, 후기 의무 없음)
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
  /** 품목 카테고리 (022) — 마이그레이션 미적용 DB에선 undefined일 수 있어 optional. 읽을 땐 `?? []` */
  item_categories?: ItemCategory[]
  topic: TopicCategory
  is_sponsored: boolean
  pinned_until: string | null
  status: PostStatus
  application_mode: 'external' | 'internal'
  /** 2차 AI 검수 점수 0~100 (migration 023) — 미적용 DB에선 undefined */
  ai_review_score?: number | null
  /** pass(자동발행 후보) | warn(사람 판단) | fail(발행 부적합 의심) */
  ai_review_status?: 'pass' | 'warn' | 'fail' | null
  ai_review_note?: string | null
  ai_reviewed_at?: string | null
  /** 1차 분류 신뢰도 0~1 (RULES.md confidence — 023부터 저장) */
  ai_confidence?: number | null
  /** 발행 주체 — 'auto'(점수 기반 자동 발행) | 'admin'(수기 승인). 023 이전 발행분은 null */
  published_by?: 'auto' | 'admin' | null
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
  giveaway: '증정',
  kids_model: '키즈모델',
  supporters: '서포터즈',
  form: '폼 작성',
}

export const ACTIVE_TYPE_TAGS: readonly TypeTag[] = [
  'regram',
  'experience',
  'giveaway',
  'kids_model',
  'supporters',
  'form',
] as const

// ============================================
// 품목 카테고리 (2026-08-13, migration 022) — "무엇을 주는가" axis
// 시기(stage)·유형(type)과 독립. 카드 등록 시 AI가 자동 부여, 보통 1개(최대 2개).
// 목적: 품목별 묶음·필터·개인화 추천의 데이터 기반 선행 축적.
// 변경 시 부수 작업: tools/umbba-cli/RULES.md + bd_local.py CLASSIFY_PROMPT 동기화
// ============================================
export type ItemCategory =
  | 'clothing'          // 의류·잡화 (아동복·신발·모자·양말·가방)
  | 'feeding'           // 수유·이유식 (젖병·빨대컵·식판·이유식·분유·수유용품)
  | 'diaper_hygiene'    // 기저귀·위생 (기저귀·물티슈·구강·세정)
  | 'skincare_bath'     // 스킨·목욕 (로션·선케어·욕조·배쓰밤·헤어·뷰티)
  | 'toys_edu'          // 완구·교구 (장난감·인형·교구·문구)
  | 'books_content'     // 도서·콘텐츠 (전집·그림책·사운드북·활동지)
  | 'gear_outing'       // 외출·이동 (유모차·카시트·아기띠·나들이용품)
  | 'bedding_furniture' // 침구·가구 (침대·매트·베개·이불·수납·가구)
  | 'home_living'       // 리빙·가전 (주방·세탁·청소·가전·생활용품)
  | 'food_health'       // 식품·건강 (간식·음료·영양제·식품 쿠폰)
  | 'service_class'     // 서비스·클래스 (스냅·클래스·티켓·숙박·상담·앱)
  | 'etc'               // 기타 (랜덤박스·굿즈·현금성 경품 등 분류 불가)

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  clothing: '의류·잡화',
  feeding: '수유·이유식',
  diaper_hygiene: '기저귀·위생',
  skincare_bath: '스킨·목욕',
  toys_edu: '완구·교구',
  books_content: '도서·콘텐츠',
  gear_outing: '외출·이동',
  bedding_furniture: '침구·가구',
  home_living: '리빙·가전',
  food_health: '식품·건강',
  service_class: '서비스·클래스',
  etc: '기타',
}

export const ACTIVE_ITEM_CATEGORIES: readonly ItemCategory[] = [
  'clothing',
  'feeding',
  'diaper_hygiene',
  'skincare_bath',
  'toys_edu',
  'books_content',
  'gear_outing',
  'bedding_furniture',
  'home_living',
  'food_health',
  'service_class',
  'etc',
] as const

/** 미지의 문자열 배열 → 유효한 ItemCategory만 (LLM 출력·폼 입력 화이트리스트) */
export function sanitizeItemCategories(raw: unknown): ItemCategory[] {
  if (!Array.isArray(raw)) return []
  return Array.from(
    new Set(
      raw.filter((v): v is ItemCategory =>
        (ACTIVE_ITEM_CATEGORIES as readonly string[]).includes(v as string)
      )
    )
  ).slice(0, 2)
}
