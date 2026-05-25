-- ============================================
-- 015: search_keywords 컬럼 — 동의어·유사어 검색 매칭
--
-- 배경:
--   현재 검색은 title/brand_name/body 3개 컬럼 ILIKE만 함.
--   "팬티"만 적힌 카드는 "기저귀"로 검색 시 안 잡힘 (유사어 누락).
--
-- 해결:
--   - search_keywords TEXT 컬럼에 콤마 구분 동의어 저장 (예: "기저귀,팬티,기저귀팬티")
--   - 관리자 폼에서 직접 입력 + AI 자동수집 시 동의어 1~3개 자동 생성
--   - 검색 쿼리는 title/brand_name/body + search_keywords 4개 컬럼 ILIKE OR
--
-- 인덱스:
--   pg_trgm extension + GIN index — LIKE/ILIKE 패턴 매칭에 결정적 가속
--   (text_pattern_ops로는 %prefix만 가속됨, %substring%은 trigram 필요)
--
-- 트랜잭션 + 검증
-- ============================================

BEGIN;

-- 1. pg_trgm extension (대부분 Supabase 프로젝트에 이미 활성, IF NOT EXISTS로 안전)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 컬럼 추가 (기본 NULL — 기존 카드는 영향 없음, 검색 시 자연스럽게 무시됨)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS search_keywords TEXT;

COMMENT ON COLUMN posts.search_keywords IS
  '검색 동의어·유사어 (콤마 구분). 예: "기저귀,팬티,기저귀팬티". 검색 매칭에만 사용, UI 노출 X.';

-- 3. GIN trigram 인덱스 — title/brand_name/body/search_keywords 검색 가속
--    (없으면 카드 수 늘어났을 때 ILIKE가 느려짐)
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm
  ON posts USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_brand_trgm
  ON posts USING gin (brand_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_body_trgm
  ON posts USING gin (body gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_search_keywords_trgm
  ON posts USING gin (search_keywords gin_trgm_ops);

-- 4. 검증
DO $$
DECLARE
  col_exists BOOLEAN;
  ext_installed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'search_keywords'
  ) INTO col_exists;
  IF NOT col_exists THEN
    RAISE EXCEPTION '015 검증 실패: search_keywords 컬럼 생성 실패';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) INTO ext_installed;
  IF NOT ext_installed THEN
    RAISE EXCEPTION '015 검증 실패: pg_trgm extension 활성화 실패';
  END IF;
END $$;

COMMIT;
