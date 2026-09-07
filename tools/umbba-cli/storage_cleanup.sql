-- card-images 버킷 정리 (2026-09-08) — Supabase 대시보드 SQL Editor에서 실행
-- 현황(9/8): 총 24,706개 · 1,213MB. 고아(카드 미참조) 21,266개 975MB / 만료 3,179개 226MB / 현역 187개 9MB / 대기 74개 3MB
-- Storage API가 402(할당량 초과)로 막혀 있어 SQL로 storage.objects 행을 지운다.
-- 주의: SQL 삭제는 메타데이터 행만 지우고 실제 파일은 오브젝트 스토어에 남을 수 있음 → 삭제 목록을 로그 테이블에 남겨 나중에 API로 정리.

-- 1) 삭제 로그 테이블
create table if not exists public.storage_deleted_log (
  name text primary key, size bigint, deleted_at timestamptz default now(), reason text
);

-- 2) 고아(어떤 posts.thumbnail_url에도 없는 파일) 기록
with orphan as (
  select o.name, (o.metadata->>'size')::bigint sz
  from storage.objects o
  where o.bucket_id = 'card-images'
    and not exists (select 1 from posts p where p.thumbnail_url like '%/card-images/' || o.name)
)
insert into public.storage_deleted_log(name, size, reason)
select name, sz, 'orphan' from orphan on conflict do nothing;

-- 3) 고아 삭제 (≈975MB)
delete from storage.objects o
where o.bucket_id = 'card-images'
  and exists (select 1 from public.storage_deleted_log l where l.name = o.name and l.reason = 'orphan');

-- 4) 결과 확인
select reason, count(*) n, round(sum(size)/1e6) mb from public.storage_deleted_log group by 1;
select count(*) n, round(sum((metadata->>'size')::bigint)/1e6) mb from storage.objects where bucket_id = 'card-images';

-- (선택) 5) 만료 14일+ 카드 이미지도 지우려면 — 앱의 만료 카드 썸네일이 깨지므로 thumbnail_url을 비운다
-- with ex as (select o.name,(o.metadata->>'size')::bigint sz from storage.objects o join posts p on p.thumbnail_url like '%/card-images/'||o.name
--             where o.bucket_id='card-images' and p.deadline < now()-interval '14 days')
-- insert into public.storage_deleted_log(name,size,reason) select name,sz,'expired14' from ex on conflict do nothing;
-- update posts set thumbnail_url = null where deadline < now()-interval '14 days' and thumbnail_url like '%/card-images/%';
-- delete from storage.objects o where o.bucket_id='card-images' and exists (select 1 from public.storage_deleted_log l where l.name=o.name and l.reason='expired14');
