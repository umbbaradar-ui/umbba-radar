-- ============================================
-- Migration 018: ingest_queue 미리보기 컬럼 추가
-- CLI --scan 모드가 gallery-dl 메타로 받은 정보를 큐에 같이 저장
-- → 검수 화면에서 인스타 클릭 없이 바로 판단 가능
-- ============================================

alter table ingest_queue
  add column if not exists source_username text,
  add column if not exists source_post_date timestamptz,
  add column if not exists caption_preview text;
