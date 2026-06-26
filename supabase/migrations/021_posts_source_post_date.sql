-- ============================================
-- 021: posts.source_post_date — 원문(인스타) 게시일
--
-- 목적: 상시(마감 미정) 카드의 자동 마감일을 "등록일 + 7" 대신
--       "원문 게시일 + 7"로 계산하기 위해 BD date_posted 를 저장.
--       없으면(인스타 외: 네이버·관리자·제보) created_at 으로 폴백.
--
-- 적용 후 동작(코드):
--   - bulk-ingest raw → 이 컬럼에 원문 게시일 best-effort 저장
--   - cards/classify → 마감 미정이면 source_post_date+7 (없으면 created_at+7),
--                      그 값이 오늘(KST)보다 과거면 'expired'(마감) 처리
--   - 컬럼 미생성 상태에서도 코드는 안 깨짐(저장 무시 + created_at 폴백)
-- ============================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS source_post_date timestamptz;

COMMENT ON COLUMN posts.source_post_date IS
  '원문 게시일(인스타 date_posted). 상시 자동마감(게시일+7) 계산 기준. 없으면 created_at 사용.';
