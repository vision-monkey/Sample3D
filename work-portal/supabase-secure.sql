-- 점수 조작 방지 + 등록 제한 + 금칙어 필터
-- supabase.sql, supabase-group.sql 을 실행한 DB에서 SQL Editor에 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전하며, 기존 기록은 건드리지 않습니다.
--
-- 바뀌는 점
--  * 기록은 더 이상 테이블에 직접 넣을 수 없고, 아래 두 함수로만 등록됩니다.
--      start_session(게임)  : 게임 시작 시 서버가 시작 시각을 기록
--      submit_record(...)   : 서버가 경과 시간·점수 범위·이름을 검사한 뒤 등록
--  * 같은 IP에서 1분에 게임 시작 30회 / 기록 등록 10회까지
--  * 욕설이 들어간 이름·그룹명 거부

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
