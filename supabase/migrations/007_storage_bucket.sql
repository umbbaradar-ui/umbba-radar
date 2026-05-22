-- ============================================
-- 007: Supabase Storage 'card-images' 버킷 + 정책
-- 관리자가 입력한 이미지 + 사용자 제보 이미지를 저장
-- ============================================

-- 버킷 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'card-images',
  'card-images',
  true,             -- 누구나 read 가능
  5242880,          -- 5MB 제한
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- RLS: 누구나 READ 가능
-- WRITE는 service_role (서버) 만 — anon/authenticated는 막힘
-- 따라서 관리자 페이지에서 Server Action을 통해서만 업로드 가능
-- ============================================
DROP POLICY IF EXISTS "Public read card-images" ON storage.objects;
CREATE POLICY "Public read card-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'card-images');
