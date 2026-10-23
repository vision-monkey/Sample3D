-- 방문 통계 (외부 서비스 가입 없이 Supabase에 직접 집계)
-- SQL Editor에 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.
--
-- 저장하는 것: 날짜, 이벤트 종류(방문/게임 시작/기록 등록), 게임, 브라우저별 임의 ID
-- 저장하지 않는 것: IP, 이름, 기기 정보
-- 보관 기간: 13개월
-- 통계는 사이트에서 읽을 수 없고, Supabase 대시보드에서만 볼 수 있습니다.
--
-- 통계 보는 법 (SQL Editor):
--   select * from public.stats_daily;   -- 날짜별 방문수·방문자수·플레이·등록
--   select * from public.stats_games;   -- 최근 30일 게임별 플레이·등록

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
     or (p_game is not null and p_game not in ('report','risk','budget','approve','inbox','settle','urgent','match','pipeline','order','risk_hard','dodge','diff'))
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
