-- ============================================
-- 024: 리빙 택소노미 불변식 (2026-09-12)
--
-- 리빙(topic='living') = 어른·가족이 쓰는 살림 제품 전부. 두 가지를 데이터에 강제한다:
--   1) stage_categories = '{all_ages}' 단독 — 리빙은 전연령이 대상. "전연령+영아" 같은 섞임은
--      시기 필터를 오염시킨다 (홈 허브 "임신중 21건" → 탐색 107건 불일치의 원인).
--   2) item_categories 는 12종 중 리빙 5종만:
--        skincare_bath · bedding_furniture · home_living · food_health · etc
--      같은 키를 육아와 공유하되 topic 으로 갈라 읽는다 — (living, skincare_bath)=어른 화장품.
--      리빙에 없는 품목은 귀속표로 보정:
--        clothing/toys_edu/books_content/gear_outing/service_class → etc
--        feeding/diaper_hygiene → home_living
--
-- 앱 레이어(src/shared/types/post.ts enforceTopicTaxonomy)가 모든 쓰기 경로에서 같은 규칙을
-- 적용하므로 이 SQL 은 기존 데이터 정리 + 재실행 가능한 안전망이다 (멱등).
-- 발행 중이던 리빙 70건 + 육아→리빙 이동 16건의 개별 재분류는 사람이 캡션을 읽고 정했고
-- (docs/WORKLOG-2026-09-12-LIVING-TAXONOMY.md), 이 SQL 은 그 외 카드(초안·마감 포함)를 기계적으로 맞춘다.
-- ============================================

BEGIN;

-- 1) 리빙은 전연령 단독
UPDATE posts
SET stage_categories = '{all_ages}'::TEXT[]
WHERE topic = 'living'
  AND stage_categories IS DISTINCT FROM '{all_ages}'::TEXT[];

-- 2) 리빙 품목은 5종으로 귀속 (첫 등장 순서 보존·중복 제거)
UPDATE posts
SET item_categories = COALESCE(
  (
    SELECT array_agg(mapped ORDER BY first_ord)
    FROM (
      SELECT mapped, MIN(ord) AS first_ord
      FROM (
        SELECT
          CASE c
            WHEN 'clothing'       THEN 'etc'
            WHEN 'toys_edu'       THEN 'etc'
            WHEN 'books_content'  THEN 'etc'
            WHEN 'gear_outing'    THEN 'etc'
            WHEN 'service_class'  THEN 'etc'
            WHEN 'feeding'        THEN 'home_living'
            WHEN 'diaper_hygiene' THEN 'home_living'
            ELSE c
          END AS mapped,
          ord
        FROM unnest(posts.item_categories) WITH ORDINALITY AS u(c, ord)
      ) m
      GROUP BY mapped
    ) d
  ),
  '{}'::TEXT[]
)
WHERE topic = 'living'
  AND item_categories && ARRAY['clothing','toys_edu','books_content','gear_outing','service_class','feeding','diaper_hygiene'];

-- 2개 초과분 잘라내기 (귀속 후 중복 제거로 대부분 2개 이하지만 방어)
UPDATE posts
SET item_categories = item_categories[1:2]
WHERE topic = 'living' AND array_length(item_categories, 1) > 2;

-- 검증
DO $$
DECLARE
  bad_stage INT;
  bad_item INT;
BEGIN
  SELECT COUNT(*) INTO bad_stage
  FROM posts
  WHERE topic = 'living' AND stage_categories IS DISTINCT FROM '{all_ages}'::TEXT[];

  SELECT COUNT(*) INTO bad_item
  FROM posts
  WHERE topic = 'living'
    AND item_categories && ARRAY['clothing','toys_edu','books_content','gear_outing','service_class','feeding','diaper_hygiene'];

  IF bad_stage > 0 OR bad_item > 0 THEN
    RAISE EXCEPTION '리빙 불변식 위반 잔존 — 시기 %건 / 품목 %건. 롤백 권장', bad_stage, bad_item;
  END IF;

  RAISE NOTICE '✓ 리빙 택소노미 정리 완료: 리빙 카드 %건 전부 전연령 단독·리빙 5품목', (SELECT COUNT(*) FROM posts WHERE topic = 'living');
END $$;

COMMIT;

-- ============================================
-- 사후 확인:
--   SELECT stage_categories, COUNT(*) FROM posts WHERE topic='living' GROUP BY 1;   -- {all_ages} 한 줄만
--   SELECT unnest(item_categories) AS c, COUNT(*) FROM posts WHERE topic='living' GROUP BY 1 ORDER BY 2 DESC;
--   -- skincare_bath / bedding_furniture / home_living / food_health / etc 만 등장
-- ============================================
