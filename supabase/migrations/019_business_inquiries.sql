-- ============================================
-- Migration 019: business_inquiries — 업체(B2B) 문의 수집
-- /business 공개 폼으로 들어오는 입점·상품추가·제휴·인스타모니터링 요청.
-- 무료 리드 수집(받기만). 처리(심사·계약·정산)는 사업자등록 후 별도.
-- 로드맵: docs/ROADMAP-NEXT.md (5-B-1/B-2)
-- ============================================

create table if not exists business_inquiries (
  id uuid primary key default gen_random_uuid(),

  -- 요청 유형: 입점(체험단 올려달라) / 상품추가 / 제휴 / 인스타 모니터링 요청
  inquiry_type text not null
    check (inquiry_type in ('listing', 'product', 'partnership', 'instagram')),

  -- 업체 정보
  company_name text not null,
  contact_name text,              -- 담당자명
  contact_email text not null,    -- 회신 받을 이메일 (필수)
  contact_phone text,             -- 전화 (선택)
  -- 인스타/홈페이지 등 참고 URL. instagram 유형이면 모니터링 대상 계정 URL
  link_url text,

  -- 한 줄 메시지 / 요청 내용
  message text,

  -- 처리 상태: 신규 → 연락함 → 완료 / 보류
  status text not null default 'new'
    check (status in ('new', 'contacted', 'done', 'rejected')),

  -- 관리자 메모 (내부용)
  admin_note text,

  created_at timestamptz not null default now()
);

-- 신규 문의 빠르게 조회 (관리자 목록: 미처리 먼저, 최신순)
create index if not exists business_inquiries_status_idx
  on business_inquiries(status, created_at desc);

-- RLS: service_role(관리자 server action)로만 읽기. insert는 공개 폼이 anon으로 함.
alter table business_inquiries enable row level security;

-- 공개 폼에서 anon 으로 insert 허용 (읽기/수정은 service_role 만 → 정책 추가 안 함).
-- 업체가 자기 문의를 남기는 것만 가능, 조회는 불가(개인정보 보호).
create policy "anyone can submit business inquiry"
  on business_inquiries
  for insert
  to anon, authenticated
  with check (true);
