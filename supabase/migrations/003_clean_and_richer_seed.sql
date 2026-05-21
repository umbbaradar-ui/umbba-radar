-- ============================================
-- 003: 기존 시드 제거 + 풍부한 더미 데이터 15개
-- (시드를 두 번 돌려서 중복된 행 정리 + 시기·유형 다양화)
-- ============================================

DELETE FROM posts;

INSERT INTO posts (
  kind, title, brand_name, thumbnail_url, source_url, body,
  deadline, stage_categories, type_tags, status
) VALUES
-- 임신중
(
  'recruiting',
  '임산부 비타민 추첨 이벤트',
  '맘앤베베',
  'https://placehold.co/600x600/F8E1E7/333?text=Vitamin',
  'https://instagram.com/p/sample-vitamin',
  '인스타 리그램 + 친구 2명 태그 → 10명 추첨',
  now() + interval '5 days',
  ARRAY['pregnancy'],
  ARRAY['lottery', 'regram'],
  'published'
),
(
  'recruiting',
  '산모 골반 벨트 무료 체험단 모집',
  '코르셋랩',
  'https://placehold.co/600x600/F8E1E7/333?text=Belt',
  'https://instagram.com/p/sample-belt',
  '체험 후 1회 솔직 후기 작성 조건. 30명 선정.',
  now() + interval '10 days',
  ARRAY['pregnancy', 'newborn'],
  ARRAY['free_trial', 'sponsored'],
  'published'
),
(
  'recruiting',
  '정부지원 출산 바우처 신청 안내',
  '복지로',
  'https://placehold.co/600x600/D6F4E0/333?text=Voucher',
  'https://www.bokjiro.go.kr',
  '첫만남이용권 200만 원 + 산모·신생아 건강관리 신청 방법',
  now() + interval '30 days',
  ARRAY['pregnancy', 'newborn'],
  ARRAY['gov_support'],
  'published'
),

-- 출산 직후·영아
(
  'recruiting',
  '○○ 분유 무료 샘플 받기',
  '엠파스밀',
  'https://placehold.co/600x600/FFE4D6/333?text=Formula',
  'https://instagram.com/p/sample-formula',
  '인스타 댓글 + 친구 태그 → 무료 샘플 즉시 발송',
  now() + interval '2 days',
  ARRAY['newborn', 'infant'],
  ARRAY['free_trial', 'sponsored'],
  'published'
),
(
  'recruiting',
  '신생아 손싸개 세트 리그램 이벤트',
  '꼬마사랑',
  'https://placehold.co/600x600/FFE4D6/333?text=Mittens',
  'https://instagram.com/p/sample-mittens',
  '리그램만 해도 5명 추첨 증정',
  now() + interval '1 day',
  ARRAY['newborn'],
  ARRAY['regram', 'lottery'],
  'published'
),
(
  'review',
  '○○ 기저귀 한 달 사용 후기',
  '센스블레스',
  'https://placehold.co/600x600/FFF4B8/333?text=Diaper',
  'https://blog.naver.com/sample-diaper',
  '흡수력·피부 자극·가격 모두 정리. 결론은 ○○이 가성비 1등.',
  null,
  ARRAY['newborn', 'infant'],
  ARRAY['sponsored'],
  'published'
),
(
  'recruiting',
  '아기 모빌 추첨 이벤트',
  '꿈나라모빌',
  'https://placehold.co/600x600/FFF4B8/333?text=Mobile',
  'https://instagram.com/p/sample-mobile',
  '게시물 좋아요 + 친구 1명 태그 → 3명 추첨',
  now() + interval '7 days',
  ARRAY['infant'],
  ARRAY['lottery'],
  'published'
),
(
  'recruiting',
  '기저귀 한 박스 체험단 모집',
  '베이비드라이',
  'https://placehold.co/600x600/FFF4B8/333?text=Box',
  'https://instagram.com/p/sample-box',
  '체험 후기 작성 조건. 50명 대규모 모집.',
  now() + interval '14 days',
  ARRAY['infant'],
  ARRAY['free_trial', 'sponsored'],
  'published'
),

-- 유아·유치원
(
  'recruiting',
  '유아용 책 세트 추첨',
  '한솔교육',
  'https://placehold.co/600x600/D6F4E0/333?text=Book+Set',
  'https://instagram.com/p/sample-books',
  '리그램 후 신청폼 작성 → 5명 추첨',
  now() + interval '7 days',
  ARRAY['toddler', 'preschool'],
  ARRAY['lottery', 'regram'],
  'published'
),
(
  'recruiting',
  '유아 식판 무료 체험',
  '맘스마일',
  'https://placehold.co/600x600/D6F4E0/333?text=Plate',
  'https://instagram.com/p/sample-plate',
  '체험 후 인스타 후기 1건. 20명 선정.',
  now() + interval '4 days',
  ARRAY['toddler'],
  ARRAY['free_trial'],
  'published'
),
(
  'recruiting',
  '키즈 카페 자유이용권 추첨',
  '플레이타임',
  'https://placehold.co/600x600/D6F4E0/333?text=Kids+Cafe',
  'https://instagram.com/p/sample-cafe',
  '댓글 이벤트 → 10팀 추첨',
  now() + interval '6 days',
  ARRAY['toddler', 'preschool'],
  ARRAY['lottery'],
  'published'
),
(
  'recruiting',
  '유치원 가방 협찬 이벤트',
  '키즈백',
  'https://placehold.co/600x600/D6EFFF/333?text=Bag',
  'https://instagram.com/p/sample-bag',
  '협찬 가방 + 후기 작성 조건. 15명.',
  now() + interval '9 days',
  ARRAY['preschool'],
  ARRAY['sponsored'],
  'published'
),

-- 초등
(
  'recruiting',
  '한글 워크북 무료 체험',
  '아이러브한글',
  'https://placehold.co/600x600/D6EFFF/333?text=Hangul',
  'https://blog.naver.com/sample-hangul',
  '워크북 1권 무료 + 솔직 후기. 30명.',
  now() + interval '12 days',
  ARRAY['preschool', 'elementary_lower'],
  ARRAY['free_trial'],
  'published'
),
(
  'review',
  '초등 저학년 수학 문제집 비교 후기',
  '맘북스',
  'https://placehold.co/600x600/E1D6FF/333?text=Math',
  'https://blog.naver.com/sample-math',
  '시중 3종 문제집 한 달씩 풀려본 솔직 후기',
  null,
  ARRAY['elementary_lower'],
  ARRAY['sponsored'],
  'published'
),
(
  'recruiting',
  '초등 영어 학습지 체험단',
  '잉글리쉬에그',
  'https://placehold.co/600x600/E1D6FF/333?text=English',
  'https://instagram.com/p/sample-eng',
  '2주 무료 체험 + 후기. 40명.',
  now() + interval '15 days',
  ARRAY['elementary_lower', 'elementary_upper'],
  ARRAY['free_trial', 'sponsored'],
  'published'
);
