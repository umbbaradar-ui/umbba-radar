-- ============================================
-- 005: posts에 입력 채널 추적 컬럼 + 제보자 핸들 추가
-- 3개 입력 채널 (수동/자동/제보)을 통합 큐로 모으는 구조의 기초
-- ============================================

-- 입력 채널 (어디서 들어왔는지)
ALTER TABLE posts ADD COLUMN source_type TEXT NOT NULL DEFAULT 'admin';
-- 'admin'      : 관리자가 직접 입력 (Phase 1)
-- 'ingestion'  : 자동 수집 (Phase 2)
-- 'submission' : 사용자 제보 (Phase 3)

CREATE INDEX idx_posts_source_status ON posts(source_type, status);

-- 제보자 닉네임 (사용자 제보 시 게이미피케이션·표기용)
ALTER TABLE posts ADD COLUMN submitter_handle TEXT;
-- 익명 제보 가능. 로그인 제보 시 user_id로도 추적 가능 (아래 추가)

-- 제보자 user_id (로그인 사용자의 경우)
ALTER TABLE posts ADD COLUMN submitter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- 사용자 제보용 RLS 추가
-- 누구나 INSERT 가능하지만 status='pending', source_type='submission' 강제
-- ============================================
CREATE POLICY "Anyone can submit a post for review"
  ON posts FOR INSERT
  WITH CHECK (
    status = 'pending' AND
    source_type = 'submission'
  );
