-- ============================================
-- Migration 013: stage_categories 8개 → 6개 간소화
--
-- 변경 사유:
--   - preschool: 유아(toddler)와 연령 범위 대부분 겹쳐서 변별력 낮음
--   - elementary_lower / upper: 초등 = 한 묶음으로 큐레이션 가능 (분리 가치 낮음)
--   - newborn 라벨만 "출산 직후" → "신생아"로 변경 (DB key는 newborn 유지)
--
-- 매핑:
--   pregnancy           → pregnancy (유지)
--   newborn             → newborn (유지, 라벨만 신생아)
--   infant              → infant (유지)
--   toddler             → toddler (유지)
--   preschool           → toddler (병합)
--   elementary_lower    → elementary (병합·신규 키)
--   elementary_upper    → elementary (병합·신규 키)
--   all_ages            → all_ages (유지)
--
-- 새 enum: pregnancy / newborn / infant / toddler / elementary / all_ages (6개)
--
-- 위험: stage_categories 배열에 옛 값 잔존 시 새 필터에서 매칭 안 됨.
-- 트랜잭션으로 안전 처리 + 검증.
-- ============================================

BEGIN;

UPDATE posts SET stage_categories = COALESCE(
  (
    SELECT array_agg(DISTINCT new_stage ORDER BY new_stage)
    FROM (
      SELECT
        CASE
          WHEN stage = 'preschool' THEN 'toddler'
          WHEN stage IN ('elementary_lower', 'elementary_upper') THEN 'elementary'
          -- 나머지(pregnancy, newborn, infant, toddler, all_ages)는 그대로
          ELSE stage
        END AS new_stage
      FROM unnest(stage_categories) AS stage
    ) sub
  ),
  '{}'::TEXT[]
);

-- 검증: 옛 값이 남아있는지 확인
DO $$
DECLARE
  legacy_count INT;
BEGIN
  SELECT COUNT(*) INTO legacy_count
  FROM posts
  WHERE stage_categories && ARRAY['preschool', 'elementary_lower', 'elementary_upper'];

  IF legacy_count > 0 THEN
    RAISE EXCEPTION 'stage 마이그레이션 후에도 옛 값이 % 카드에 남아있음 — 롤백 권장', legacy_count;
  END IF;

  RAISE NOTICE '✓ stage_categories 마이그레이션 완료: % 카드 전체 검증 통과', (SELECT COUNT(*) FROM posts);
END $$;

COMMIT;

-- ============================================
-- 사후 확인:
--   SELECT DISTINCT unnest(stage_categories) AS stage, COUNT(*) AS card_count
--   FROM posts
--   GROUP BY stage
--   ORDER BY card_count DESC;
--
-- 기대: pregnancy / newborn / infant / toddler / elementary / all_ages 만 등장
-- ============================================
