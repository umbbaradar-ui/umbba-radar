-- ============================================
-- 020: posts 공개 INSERT 정책 제거 (보안)
--
-- 배경: 005 "Anyone can submit a post for review" 정책은 anon/authenticated에게
--       posts INSERT를 열어두고 WITH CHECK가 status='pending'·source_type='submission'만
--       강제한다. submitter_user_id 컬럼엔 제약이 없어 PostgREST 직접 호출로
--       ① 타인 UUID를 submitter_user_id에 박는 신원 위조 ② 무제한 텍스트 INSERT 스팸이 가능.
--
-- 사실: 사용자 제보(submitPostAction)는 service_role 클라이언트(supabaseServer)로
--       insert하므로 RLS를 우회한다 → 이 anon INSERT 정책에 의존하지 않는다.
--       코드베이스에 anon/authenticated 클라이언트의 posts 직접 insert 경로가 없으므로
--       정책을 제거해도 기능 손실이 없다(제보는 그대로 동작).
--
-- 효과: 위조·스팸 벡터를 원천 차단. (자동발행 금지·전건 관리자 승인 정책과도 정합.)
--
-- ⚠️ 적용 후 /submit 제보가 정상 저장되는지 1회 확인 권장(서버 액션 경유라 정상이어야 함).
--    문제가 생기면 005의 정책을 임시 복구할 수 있음(아래 주석 참고).
-- ============================================

DROP POLICY IF EXISTS "Anyone can submit a post for review" ON posts;

-- 적용 후 posts의 INSERT 정책은 없어야 정상(서버 service_role만 insert).
-- 만약 롤백이 필요하면(권장하지 않음) 005의 원 정책 대신 신원 바인딩을 추가한 버전으로:
--   CREATE POLICY "submit pending posts" ON posts FOR INSERT TO anon, authenticated
--     WITH CHECK (
--       status = 'pending'
--       AND source_type = 'submission'
--       AND (submitter_user_id IS NULL OR submitter_user_id = auth.uid())
--     );
