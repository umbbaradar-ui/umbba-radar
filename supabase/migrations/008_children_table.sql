-- ============================================
-- 008: children 테이블 — 사용자 자녀 정보 (월령 기반 맞춤 큐레이션)
-- 다둥이 지원: 한 user_id 가 여러 행 가질 수 있음
-- ============================================

CREATE TABLE children (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gender      TEXT NOT NULL CHECK (gender IN ('M', 'F', 'X')),  -- M:남 / F:여 / X:비공개·예정
  birth_date  DATE NOT NULL,                                     -- 출산 예정일 입력도 허용 (미래 날짜)
  nickname    TEXT,                                              -- 별명 (선택)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_children_user ON children(user_id);
CREATE INDEX idx_children_birth ON children(birth_date);

CREATE TRIGGER children_updated_at
  BEFORE UPDATE ON children
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS — 본인 자녀만 관리
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own children"
  ON children FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own children"
  ON children FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own children"
  ON children FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own children"
  ON children FOR DELETE
  USING (auth.uid() = user_id);
