-- ============================================
-- 엄빠레이더 — 샘플 시드 데이터 3개
-- Version: 002
-- (테스트용. 진짜 데이터 채우면 삭제 가능)
-- ============================================

INSERT INTO posts (
  kind, title, brand_name, thumbnail_url, source_url, body,
  deadline, stage_categories, type_tags, status
) VALUES
(
  'recruiting',
  '○○ 분유 무료 샘플 신청',
  '○○분유',
  'https://placehold.co/600x600/FFE4E1/333?text=Formula',
  'https://instagram.com/p/example1',
  '인스타 게시물 댓글 + 친구 태그 → 무료 샘플 발송',
  now() + interval '3 days',
  ARRAY['newborn', 'infant'],
  ARRAY['free_trial', 'sponsored'],
  'published'
),
(
  'recruiting',
  '유아용 책 세트 추첨 이벤트',
  '○○출판',
  'https://placehold.co/600x600/E1F5FE/333?text=Book+Set',
  'https://instagram.com/p/example2',
  '리그램 후 신청폼 작성. 5명 추첨',
  now() + interval '7 days',
  ARRAY['toddler', 'preschool'],
  ARRAY['lottery', 'regram'],
  'published'
),
(
  'review',
  '○○ 기저귀 한 달 사용 후기',
  '○○기저귀',
  'https://placehold.co/600x600/F0F4C3/333?text=Diaper',
  'https://blog.example.com/review-001',
  '실제 사용 후기 — 흡수력·피부 자극·가격 비교',
  null,
  ARRAY['newborn', 'infant'],
  ARRAY['sponsored'],
  'published'
);
