-- ============================================
-- 004: Analytics 부서용 events 테이블
-- 사용자 행동 이벤트 (클릭·체크·외부링크·필터·로그인 등) 저장
-- Phase 1부터 가동해서 향후 광고 영업·의사결정 데이터 확보
-- ============================================

CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  event_name  TEXT NOT NULL,                       -- 'card_click' | 'source_link_click' | 'status_mark' | 'filter_change' | 'login_attempt' 등
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_id     TEXT,                                -- 로그인 전 익명 식별 (localStorage UUID)
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  properties  JSONB NOT NULL DEFAULT '{}',
  user_agent  TEXT,
  referer     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_name_created ON events(event_name, created_at DESC);
CREATE INDEX idx_events_post ON events(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_events_user ON events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_events_anon ON events(anon_id) WHERE anon_id IS NOT NULL;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT 가능 (익명 트래킹 가능해야 함)
CREATE POLICY "Anyone can insert events"
  ON events FOR INSERT
  WITH CHECK (true);

-- SELECT 정책 없음 — service_role(관리자) 만 조회 가능
-- (anon·authenticated 사용자는 자기 데이터도 조회 불가)
