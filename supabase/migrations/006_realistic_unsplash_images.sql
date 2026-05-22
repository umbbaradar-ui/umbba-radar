-- ============================================
-- 006: 시드 카드 썸네일을 placehold.co → Unsplash 실사진으로 교체
-- "AI 데모" 느낌 해소. 향후 본인이 직접 입력하는 카드도 인스타 이미지·실사진 사용 권장.
-- ============================================

-- 임신중·영양제
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=600&h=600&fit=crop'
WHERE title LIKE '%임산부 비타민%';

-- 산모 골반 벨트
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&h=600&fit=crop'
WHERE title LIKE '%골반 벨트%';

-- 정부지원 출산 바우처
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1581952976147-5a2d15560349?w=600&h=600&fit=crop'
WHERE title LIKE '%출산 바우처%';

-- 분유 (모집)
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1559246645-3f7b6da42db8?w=600&h=600&fit=crop'
WHERE title LIKE '%분유 무료 샘플%';

-- 신생아 손싸개
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1546015720-b8b30df5aa27?w=600&h=600&fit=crop'
WHERE title LIKE '%손싸개%';

-- 기저귀 후기
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1544454262-c63d9adf3b16?w=600&h=600&fit=crop'
WHERE title LIKE '%기저귀 한 달%';

-- 아기 모빌
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1576437048293-1b6c1ed28e9d?w=600&h=600&fit=crop'
WHERE title LIKE '%모빌%';

-- 기저귀 박스 체험단
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=600&h=600&fit=crop'
WHERE title LIKE '%기저귀 한 박스%';

-- 유아용 책 세트
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600&h=600&fit=crop'
WHERE title LIKE '%책 세트%';

-- 유아 식판
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1564834744159-ff0ea41ba4b9?w=600&h=600&fit=crop'
WHERE title LIKE '%식판%';

-- 키즈 카페
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1543248939-4296e1fea89b?w=600&h=600&fit=crop'
WHERE title LIKE '%키즈 카페%';

-- 유치원 가방
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop'
WHERE title LIKE '%유치원 가방%';

-- 한글 워크북
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=600&fit=crop'
WHERE title LIKE '%한글 워크북%';

-- 초등 수학 후기
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&h=600&fit=crop'
WHERE title LIKE '%수학 문제집%';

-- 초등 영어 학습지
UPDATE posts SET thumbnail_url = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=600&fit=crop'
WHERE title LIKE '%영어 학습지%';
