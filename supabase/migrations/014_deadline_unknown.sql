-- ============================================
-- 014: deadline_unknown 컬럼 — "마감일 미정" 카드 처리
--
-- 배경:
--   네이버 블로그·인스타 단발성 이벤트는 본문에 마감일 안 적혀 있는 경우가 많음.
--   현재는 deadline=NULL로 들어와서 expireOverduePosts가 만료시키지 못해 영원히 노출됨.
--
-- 해결:
--   - deadline_unknown=true 카드는 deadline = created_at + 7일 자동 채움 (실제 값)
--   - 모든 정렬·필터·만료 로직은 deadline 그대로 사용 (변경 0)
--   - UI에서만 deadline_unknown=true일 때 "추정 마감" 라벨 표시
--   - 푸시 알림(notify-deadline cron)은 deadline_unknown=true 제외
--
-- 트랜잭션 + 검증 (실패 시 자동 롤백)
-- ============================================

BEGIN;

-- 1. 컬럼 추가 (기본 false → 기존 카드는 정확한 마감일로 간주)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS deadline_unknown BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. 부분 인덱스 — notify-deadline cron 등에서 deadline_unknown=false만 빠르게 필터
--    (대부분 카드가 false이지만, true 카드 제외 쿼리가 자주 도니까 도움됨)
CREATE INDEX IF NOT EXISTS idx_posts_deadline_known
  ON posts (deadline)
  WHERE deadline_unknown = FALSE AND deadline IS NOT NULL;

-- 3. 검증: 컬럼이 정상 생성되고 모든 기존 row가 false인지
DO $$
DECLARE
  col_exists BOOLEAN;
  nonfalse_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'deadline_unknown'
  ) INTO col_exists;
  IF NOT col_exists THEN
    RAISE EXCEPTION '014 검증 실패: deadline_unknown 컬럼이 생성되지 않음';
  END IF;

  SELECT COUNT(*) FROM posts WHERE deadline_unknown IS NOT FALSE INTO nonfalse_count;
  IF nonfalse_count > 0 THEN
    RAISE EXCEPTION '014 검증 실패: 기본값 false 적용 실패 (% 행)', nonfalse_count;
  END IF;
END $$;

COMMIT;
