-- 업무포털 공유 순위 테이블
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

-- ===== 점수 조작 방지 (supabase-secure.sql과 동일) =====
-- 플레이 세션 (사이트에서 직접 읽거나 쓸 수 없음)
create table if not exists public.game_sessions (
  id         uuid primary key default gen_random_uuid(),
  game_id    text        not null,
  ip         text        not null,
  started_at timestamptz not null default now(),
  used_at    timestamptz
);
create index if not exists game_sessions_ip_start_idx on public.game_sessions (ip, started_at desc);
create index if not exists game_sessions_ip_used_idx  on public.game_sessions (ip, used_at desc);
alter table public.game_sessions enable row level security;
revoke all on public.game_sessions from anon, authenticated;

-- 요청한 사람의 IP (Supabase API 게이트웨이가 넘겨주는 헤더)
create or replace function public.wp_client_ip() returns text
language sql stable as $$
  select coalesce(
    nullif(btrim(split_part(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ',', 1)), ''),
    nullif(current_setting('request.headers', true), '')::json->>'cf-connecting-ip',
    'unknown')
$$;

-- 금칙어 검사 (공백·숫자·기호를 빼고 비교)
create or replace function public.wp_has_bad_word(t text) returns boolean
language sql immutable as $$
  select exists (
    select 1
    from unnest(array[
      '시발','씨발','씨팔','시팔','쉬발','ㅅㅂ','ㅆㅂ','병신','븅신','ㅂㅅ','좆','존나','졸라','지랄','ㅈㄹ',
      '개새','새끼','섀끼','미친놈','미친년','염병','엠창','느금','니애미','니미럴','애미','애비','썅','쌍놈','쌍년',
      '꺼져','닥쳐','보지','자지','섹스','sex','fuck','shit','bitch','nigger'
    ]) w
    where position(w in lower(regexp_replace(coalesce(t, ''), '[[:space:][:punct:][:digit:]]', '', 'g'))) > 0
  )
$$;

create or replace function public.start_session(p_game text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ip text := wp_client_ip();
  v_id uuid;
begin
  if p_game not in ('report','risk','budget','approve','inbox','settle','urgent','match','pipeline','order') then
    raise exception 'invalid_game';
  end if;
  if (select count(*) from game_sessions where ip = v_ip and started_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  delete from game_sessions where started_at < now() - interval '1 day';
  insert into game_sessions (game_id, ip) values (p_game, v_ip) returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_record(p_session uuid, p_name text, p_group text, p_score double precision)
returns json
language plpgsql security definer set search_path = public as $$
declare
  s       game_sessions;
  v_ip    text := wp_client_ip();
  v_name  text := btrim(coalesce(p_name, ''));
  v_group text := coalesce(nullif(btrim(coalesce(p_group, '')), ''), '무소속');
  el      double precision; -- 서버가 잰 경과 시간(초)
  ok      boolean;
  r       records;
begin
  select * into s from game_sessions where id = p_session for update;
  if not found or s.used_at is not null or s.started_at < now() - interval '3 hours' then
    raise exception 'invalid_session';
  end if;
  if (select count(*) from game_sessions where ip = v_ip and used_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limited';
  end if;
  if v_name = '' or char_length(v_name) > 16 or char_length(v_group) > 20
     or wp_has_bad_word(v_name) or wp_has_bad_word(v_group) then
    raise exception 'bad_name';
  end if;

  el := extract(epoch from now() - s.started_at);
  -- 게임별로 사람이 낼 수 있는 범위인지 검사 (NaN/무한대는 범위 비교에서 걸러짐)
  ok := case s.game_id
    when 'report'   then p_score > 0    and p_score <= 1200   and el >= 15000 / p_score          -- 타/분, 최소 약 300타 입력
    when 'risk'     then p_score >= 1   and p_score <= el + 1                                     -- 초
    when 'budget'   then p_score >= 4   and p_score <= 200000 and el >= p_score / 200             -- 초당 200점 이하
    when 'approve'  then p_score >= 3   and p_score <= 600    and el >= 3                         -- 초 (오처리 패널티 포함)
    when 'inbox'    then p_score >= 0   and p_score <= 60     and el >= 39                        -- 40초 게임
    when 'settle'   then p_score >= 1   and p_score <= 50     and el >= 59                        -- 60초 게임
    when 'urgent'   then p_score >= 100 and p_score <= 5000   and el >= 7                         -- ms, 5회
    when 'match'    then p_score >= 4   and p_score <= el + 1                                     -- 초
    when 'pipeline' then p_score >= 1   and p_score <= 357    and el >= p_score * 0.06            -- 칸당 최소 60ms
    when 'order'    then p_score >= 1   and p_score <= 60     and el >= 0.15 * p_score * p_score  -- 단계별 재생 시간
    else false
  end;
  if ok is not true then
    raise exception 'invalid_score';
  end if;

  update game_sessions set used_at = now() where id = s.id;
  insert into records (game_id, name, group_name, score)
    values (s.game_id, v_name, v_group, p_score)
    returning * into r;
  return row_to_json(r);
end $$;

revoke all on function public.start_session(text) from public;
revoke all on function public.submit_record(uuid, text, text, double precision) from public;
grant execute on function public.start_session(text) to anon, authenticated;
grant execute on function public.submit_record(uuid, text, text, double precision) to anon, authenticated;

-- 테이블에 직접 등록하는 길을 막는다 (조회는 계속 허용)
drop policy if exists "anyone can add a record" on public.records;
revoke insert on public.records from anon, authenticated;

-- ===== 방문 통계 (supabase-stats.sql과 동일) =====
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  day        date        not null default (now() at time zone 'Asia/Seoul')::date,
  kind       text        not null check (kind in ('visit', 'play', 'record')),
  game_id    text,
  visitor    text        not null check (char_length(visitor) between 8 and 40),
  created_at timestamptz not null default now()
);
create index if not exists events_day_idx on public.events (day, kind);
create index if not exists events_visitor_idx on public.events (visitor, created_at desc);
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;

-- 이벤트 기록 함수. 잘못된 값은 조용히 무시하고, 같은 방문자는 1분에 60건까지만 받는다.
create or replace function public.track(p_kind text, p_game text, p_visitor text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('visit', 'play', 'record')
     or (p_game is not null and p_game not in ('report','risk','budget','approve','inbox','settle','urgent','match','pipeline','order'))
     or p_visitor is null or p_visitor !~ '^[A-Za-z0-9_-]{8,40}$' then
    return;
  end if;
  if (select count(*) from events where visitor = p_visitor and created_at > now() - interval '1 minute') >= 60 then
    return;
  end if;
  insert into events (kind, game_id, visitor) values (p_kind, p_game, p_visitor);
  -- 보관 기간 13개월 (가끔씩 정리)
  if random() < 0.01 then
    delete from events where created_at < now() - interval '13 months';
  end if;
end $$;

revoke all on function public.track(text, text, text) from public;
grant execute on function public.track(text, text, text) to anon, authenticated;

-- 대시보드용 집계 (사이트 방문자는 읽을 수 없음)
create or replace view public.stats_daily as
  select day,
         count(*) filter (where kind = 'visit')                      as visits,
         count(distinct visitor) filter (where kind = 'visit')       as visitors,
         count(*) filter (where kind = 'play')                       as plays,
         count(*) filter (where kind = 'record')                     as records
  from public.events
  group by day
  order by day desc;

create or replace view public.stats_games as
  select game_id,
         count(*) filter (where kind = 'play')   as plays,
         count(*) filter (where kind = 'record') as records,
         count(distinct visitor)                 as players
  from public.events
  where game_id is not null and day > (now() at time zone 'Asia/Seoul')::date - 30
  group by game_id
  order by plays desc;

revoke all on public.stats_daily, public.stats_games from anon, authenticated;
