-- 그룹명 기능 추가 (기존 기록은 그대로 두고 그룹을 '무소속'으로 채움)
-- 이미 supabase.sql을 실행한 DB에서 SQL Editor에 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.

alter table public.records
  add column if not exists group_name text not null default '무소속';

alter table public.records drop constraint if exists records_group_chk;
alter table public.records
  add constraint records_group_chk check (char_length(btrim(group_name)) between 1 and 20);

create index if not exists records_group_idx on public.records (group_name);
