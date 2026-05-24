-- ============================================
-- Migration 011: type_tags 분류 체계 간소화
--
-- 변경 사유:
--   - follow: 사실상 100% 카드가 팔로우 필수 → 필터 변별력 0
--   - lottery: "추첨"은 결과 방식이지 카드 유형이 아님
--   - gov_support: 큐레이팅 안 함 (정책 결정)
--   - free_trial / experience_group / sponsored: 사용자 입장에선 모두 "체험단"
--
-- 매핑:
--   follow              → 제거
--   regram              → regram (유지)
--   lottery             → 제거
--   free_trial          → experience
--   experience_group    → experience
--   sponsored           → experience
--   gov_support         → 제거
--   (신규) kids_model, supporters → 관리자 신규 입력만
--
-- 위험: 기존 카드의 type_tags 일괄 변환. 트랜잭션으로 감싸 안전.
-- 롤백 필요 시 BEGIN; ROLLBACK; 으로 테스트 권장.
-- ============================================

BEGIN;

-- 1. 매핑 함수: 한 카드의 type_tags 배열을 새 enum 배열로 변환
UPDATE posts SET type_tags = COALESCE(
  (
    SELECT array_agg(DISTINCT new_tag ORDER BY new_tag)
    FROM (
      SELECT
        CASE
          WHEN tag = 'follow' THEN NULL
          WHEN tag = 'regram' THEN 'regram'
          WHEN tag = 'lottery' THEN NULL
          WHEN tag IN ('free_trial', 'experience_group', 'sponsored') THEN 'experience'
          WHEN tag = 'gov_support' THEN NULL
          -- 알려지지 않은 값(kids_model, supporters 등 신규)은 통과
          ELSE tag
        END AS new_tag
      FROM unnest(type_tags) AS tag
    ) sub
    WHERE new_tag IS NOT NULL
  ),
  '{}'::TEXT[]
);

-- 2. 검증: 옛 값이 남아있는지 확인 (있으면 트랜잭션 롤백 권장)
DO $$
DECLARE
  legacy_count INT;
BEGIN
  SELECT COUNT(*) INTO legacy_count
  FROM posts
  WHERE type_tags && ARRAY['follow', 'lottery', 'free_trial', 'experience_group', 'sponsored', 'gov_support'];

  IF legacy_count > 0 THEN
    RAISE EXCEPTION '마이그레이션 후에도 옛 type_tags 값이 % 카드에 남아있음 — 롤백 권장', legacy_count;
  END IF;

  RAISE NOTICE '✓ type_tags 마이그레이션 완료: % 카드 전체 검증 통과', (SELECT COUNT(*) FROM posts);
END $$;

COMMIT;

-- ============================================
-- 사후 확인 쿼리 (수동 실행 권장):
--
--   SELECT DISTINCT unnest(type_tags) AS tag, COUNT(*) AS card_count
--   FROM posts
--   GROUP BY tag
--   ORDER BY card_count DESC;
--
-- 기대 결과: regram, experience, (신규 카드 입력 시 kids_model, supporters)만 등장
-- ============================================
