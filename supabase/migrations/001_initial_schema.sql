-- ============================================
-- 엄빠레이더 Phase 1 — 데이터 모델
-- Version: 001
-- ============================================

-- ENUM 타입
CREATE TYPE post_kind AS ENUM ('recruiting', 'review', 'group_buy', 'sponsored_ad');
CREATE TYPE post_status AS ENUM ('draft', 'pending', 'published', 'expired');
CREATE TYPE user_post_status_kind AS ENUM ('applied', 'interested');

-- ============================================
-- 메인 컨텐츠 테이블
-- ============================================
CREATE TABLE posts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             post_kind NOT NULL DEFAULT 'recruiting',
  title            TEXT NOT NULL,
  brand_name       TEXT,
  thumbnail_url    TEXT,
  source_url       TEXT NOT NULL,
  body             TEXT,
  deadline         TIMESTAMPTZ,
  reviewer_handle  TEXT,
  stage_categories TEXT[] NOT NULL DEFAULT '{}',
  type_tags        TEXT[] NOT NULL DEFAULT '{}',
  is_sponsored     BOOLEAN NOT NULL DEFAULT false,
  pinned_until     TIMESTAMPTZ,
  status           post_status NOT NULL DEFAULT 'draft',
  application_mode TEXT NOT NULL DEFAULT 'external',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_status_deadline ON posts(status, deadline);
CREATE INDEX idx_posts_stage_categories ON posts USING GIN (stage_categories);
CREATE INDEX idx_posts_type_tags ON posts USING GIN (type_tags);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 사용자 체크 상태
-- ============================================
CREATE TABLE user_post_status (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  status     user_post_status_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_user_post_status_user ON user_post_status(user_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published posts"
  ON posts FOR SELECT
  USING (status = 'published');

ALTER TABLE user_post_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own status"
  ON user_post_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own status"
  ON user_post_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own status"
  ON user_post_status FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own status"
  ON user_post_status FOR DELETE USING (auth.uid() = user_id);
