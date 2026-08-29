-- ============================================
-- 023: 2차 AI 검수(리뷰어) + 점수 기반 자동 발행 + 피드백 루프 (2026-08-29)
--
-- 파이프라인: 수집(draft) → 1차 분류(pending) → [NEW] 2차 검수(bd_review.py)
--   → pass & 고점수(기본 85+)는 09:00 KST cron 자동 발행(published_by='auto')
--   → warn/fail/미검수만 /admin/queue 수기 검수
--
-- 값 검증은 앱 레이어(review-results route 화이트리스트)에서 수행.
-- ============================================

-- 1) posts — 검수 결과 컬럼
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS ai_review_score  SMALLINT,
  ADD COLUMN IF NOT EXISTS ai_review_status TEXT CHECK (ai_review_status IN ('pass','warn','fail')),
  ADD COLUMN IF NOT EXISTS ai_review_note   TEXT,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_confidence    REAL,
  ADD COLUMN IF NOT EXISTS published_by     TEXT CHECK (published_by IN ('auto','admin'));

COMMENT ON COLUMN posts.ai_review_score  IS '2차 AI 검수 점수 0~100 (REVIEW-RULES.md 감점표)';
COMMENT ON COLUMN posts.ai_review_status IS 'pass(85+ 자동발행 후보) | warn(사람 판단) | fail(발행 부적합 의심)';
COMMENT ON COLUMN posts.ai_review_note   IS '검수 사유 한 줄 (한국어)';
COMMENT ON COLUMN posts.ai_confidence    IS '1차 분류 신뢰도 0~1 (RULES.md confidence — 023부터 저장)';
COMMENT ON COLUMN posts.published_by     IS '발행 주체: auto(점수 기반 자동) | admin(수기). 023 이전 발행분은 NULL';

-- 검수 루틴이 "미검수 pending"을 집는 경로
CREATE INDEX IF NOT EXISTS idx_posts_pending_unreviewed
  ON posts (created_at) WHERE status = 'pending' AND ai_reviewed_at IS NULL;
-- 자동 발행이 "pass 고점수 pending"을 집는 경로
CREATE INDEX IF NOT EXISTS idx_posts_pending_pass
  ON posts (ai_review_score) WHERE status = 'pending' AND ai_review_status = 'pass';

-- 2) review_feedback — 사람 결정(승인/반려) vs AI 점수 대조 로그 = 검수자 캘리브레이션 데이터
--    post_id 는 FK 아님(카드 하드 삭제 후에도 이력 보존 목적)
CREATE TABLE IF NOT EXISTS review_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID,
  title TEXT,
  brand_name TEXT,
  ai_review_score SMALLINT,
  ai_review_status TEXT,
  ai_review_note TEXT,
  human_action TEXT NOT NULL, -- approve | approve_archived | approve_edited | reject
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_feedback_created
  ON review_feedback (created_at DESC);
ALTER TABLE review_feedback ENABLE ROW LEVEL SECURITY; -- 정책 없음 = service_role 전용

-- 3) classify_skip_log — 1차 분류가 skip(삭제)한 카드의 감사 로그
--    (기존엔 흔적 없는 DELETE라 오탐 skip 검증 불가 → 이 로그로 해소)
CREATE TABLE IF NOT EXISTS classify_skip_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID,
  source_url TEXT,
  reason TEXT,           -- RULES.md skip_reason
  caption_snippet TEXT,  -- 캡션 앞 200자
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_classify_skip_log_created
  ON classify_skip_log (created_at DESC);
ALTER TABLE classify_skip_log ENABLE ROW LEVEL SECURITY; -- 정책 없음 = service_role 전용
