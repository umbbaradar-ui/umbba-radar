-- ============================================
-- 022: 품목 카테고리 (2026-08-13)
-- "무엇을 주는가" axis — 시기(stage_categories)·유형(type_tags)과 독립.
-- 카드 등록 시 AI 분류가 자동 부여 (보통 1개, 최대 2개).
-- 값 검증은 앱 레이어(sanitizeItemCategories 화이트리스트)에서 수행.
-- 유효값: clothing | feeding | diaper_hygiene | skincare_bath | toys_edu
--       | books_content | gear_outing | bedding_furniture | home_living
--       | food_health | service_class | etc
-- ============================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS item_categories TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_posts_item_categories
  ON posts USING GIN (item_categories);

COMMENT ON COLUMN posts.item_categories IS
  '품목 카테고리 (src/shared/types/post.ts ItemCategory와 동기화)';
