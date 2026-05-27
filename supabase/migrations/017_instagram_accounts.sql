-- ============================================
-- Migration 017: instagram_accounts — 모니터링할 인스타 계정 목록
-- 매일 저녁 CLI --scan 모드가 활성 계정 순회 → 신규 게시물 URL 을 ingest_queue 에 push
-- ============================================

create table if not exists instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  -- 활성 계정만 스캔 대상. 일시 비활성화 시 false (계정 삭제 X)
  active boolean not null default true,
  -- 마지막으로 스캔한 시각 (CLI 가 업데이트)
  last_scanned_at timestamptz,
  -- 마지막 스캔에서 발견된 신규 URL 개수 (운영 모니터링용)
  last_new_count int not null default 0,
  -- 마지막 스캔에서 실패했으면 에러 메시지 (비공개·삭제·쿠키만료 등)
  last_error text,
  -- 메모 (운영자가 어드민에서 자유롭게 기록)
  note text,
  created_at timestamptz not null default now()
);

-- username 소문자 unique (인스타는 case-insensitive)
create unique index if not exists instagram_accounts_username_uniq
  on instagram_accounts(lower(username));

-- 활성 계정만 빠르게 fetch
create index if not exists instagram_accounts_active_idx
  on instagram_accounts(active, last_scanned_at)
  where active = true;

-- RLS: service_role 로만 접근 (관리자 server action + CLI 만 다룸)
alter table instagram_accounts enable row level security;
