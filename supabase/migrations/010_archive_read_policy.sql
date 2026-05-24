-- ============================================
-- 010: /archive 페이지에서 expired posts 읽기 허용
-- 기존 'published' 정책은 그대로 두고, 'expired'도 누구나 읽기 가능하게
-- ============================================

CREATE POLICY "Anyone can read expired posts"
  ON posts FOR SELECT
  USING (status = 'expired');
