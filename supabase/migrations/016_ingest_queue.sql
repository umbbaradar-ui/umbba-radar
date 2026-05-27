-- ============================================
-- Migration 016: ingest_queue 테이블 신규
-- 웹에서 URL 리스트 업로드 → 큐 저장 → CLI 가 polling 으로 가져가 처리
-- ============================================

create table if not exists ingest_queue (
  id uuid primary key default gen_random_uuid(),
  url text not null,

  -- 상태 머신
  --   todo       : 대기 중 (CLI 가 pull 가능)
  --   processing : CLI 가 claim 했고 처리 중 (timeout 후 todo 로 복귀 가능)
  --   done       : 성공적으로 카드 생성 (post_id 기록)
  --   duplicate  : 이미 같은 source_url 의 posts 존재 → 스킵
  --   failed     : 실패 (error 기록)
  status text not null default 'todo'
    check (status in ('todo', 'processing', 'done', 'duplicate', 'failed')),

  error text,
  post_id uuid references posts(id) on delete set null,
  attempts int not null default 0,

  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  processed_at timestamptz,

  -- 추후: who added it (관리자 식별)
  created_by text
);

-- URL 중복 방지 (정확히 같은 URL 중복 등록 X)
-- 정규화 (쿼리 파라미터 제거 등) 은 application 단에서 처리
create unique index if not exists ingest_queue_url_uniq on ingest_queue(url);

-- todo 만 빠르게 fetch 하기 위한 partial index
create index if not exists ingest_queue_todo_idx
  on ingest_queue(created_at)
  where status = 'todo';

-- 검수 화면 최신순 정렬
create index if not exists ingest_queue_created_idx
  on ingest_queue(created_at desc);

-- RLS: 서비스 롤만 접근 (관리자 server action + CLI 만 다룸)
alter table ingest_queue enable row level security;

-- (anon/authenticated 정책 없음 = 서비스 키로만 접근 가능)
