-- ============================================
-- Migration 012: posts.topic 컬럼 추가 (주제 분류 axis)
--
-- 기존 시기(stage_categories)·유형(type_tags)에 추가로
-- 콘텐츠 주제를 분류하는 새 차원.
--   - parenting (육아): 부모-자녀 활동, 키즈모델, 체험단 등 아동 관련
--   - living (리빙): 가전·가구·식기·생활용품 등 살림 관련
--
-- 기존 카드는 사용자 결정에 따라 일괄 'parenting'으로 설정
-- (DEFAULT 값으로 자동 처리 — 추가 UPDATE 불필요)
--
-- 향후 확장 시 CHECK constraint 갱신 + TypeScript enum 갱신만 하면 됨
-- ============================================

BEGIN;

ALTER TABLE posts
  ADD COLUMN topic TEXT NOT NULL DEFAULT 'parenting'
  CHECK (topic IN ('parenting', 'living'));

-- 필터 쿼리 성능 — topic 단일 값이라 btree로 충분
CREATE INDEX idx_posts_topic ON posts(topic);

-- 검증
DO $$
DECLARE
  total_count INT;
  parenting_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM posts;
  SELECT COUNT(*) INTO parenting_count FROM posts WHERE topic = 'parenting';

  IF parenting_count != total_count THEN
    RAISE EXCEPTION 'topic 기본값 적용 실패: 전체 % 카드 중 parenting %', total_count, parenting_count;
  END IF;

  RAISE NOTICE '✓ topic 컬럼 추가 완료: % 카드 전체 parenting 기본값 적용', total_count;
END $$;

COMMIT;

-- ============================================
-- 사후 확인 (수동):
--   SELECT topic, COUNT(*) FROM posts GROUP BY topic;
-- ============================================
