-- WorkSpace 업무 포털 공유 순위 테이블
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.

create table if not exists public.records (
  id          bigint generated always as identity primary key,
  game_id     text        not null,
  name        text        not null,
  score       double precision not null,
  created_at  timestamptz not null default now(),

  constraint records_game_chk  check (game_id in (
    'report', 'risk', 'budget', 'approve', 'inbox',
    'settle', 'urgent', 'match', 'pipeline', 'order'
  )),
  constraint records_name_chk  check (char_length(btrim(name)) between 1 and 16),
  constraint records_score_chk check (score >= 0 and score < 10000000)
);

create index if not exists records_game_score_idx on public.records (game_id, score);
create index if not exists records_created_idx    on public.records (created_at desc);

-- 누구나 조회·등록만 가능 (수정/삭제 불가)
alter table public.records enable row level security;

drop policy if exists "records are readable" on public.records;
create policy "records are readable"
  on public.records for select
  to anon, authenticated
  using (true);

drop policy if exists "anyone can add a record" on public.records;
create policy "anyone can add a record"
  on public.records for insert
  to anon, authenticated
  with check (true);

grant select, insert on public.records to anon, authenticated;

-- 그룹명 (supabase-group.sql과 동일, 새로 설치할 때도 함께 적용)
alter table public.records
  add column if not exists group_name text not null default '무소속';

alter table public.records drop constraint if exists records_group_chk;
alter table public.records
  add constraint records_group_chk check (char_length(btrim(group_name)) between 1 and 20);

create index if not exists records_group_idx on public.records (group_name);
