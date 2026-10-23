-- [데이터 정합성 검증](diff) 기록 허용 (+ risk_hard, dodge 포함)
-- SQL Editor에 붙여넣고 Run 하세요. 여러 번 실행해도 안전하며 기존 기록은 그대로입니다.
-- 이전 게임 추가 SQL(supabase-hard.sql, supabase-dodge.sql)을 안 돌렸어도 이 파일 하나면 됩니다.

alter table public.records drop constraint if exists records_game_chk;
alter table public.records add constraint records_game_chk check (game_id in (
  'report', 'risk', 'budget', 'approve', 'inbox',
  'settle', 'urgent', 'match', 'pipeline', 'order', 'risk_hard', 'dodge', 'diff'
));

create or replace function public.start_session(p_game text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ip text := wp_client_ip();
  v_id uuid;
begin
  if p_game not in ('report','risk','budget','approve','inbox','settle','urgent','match','pipeline','order','risk_hard','dodge','diff') then
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
    when 'risk_hard' then p_score >= 20 and p_score <= el + 1                                    -- 초 (30×16, 99개)
    when 'dodge'    then p_score >= 1   and p_score <= 1800   and p_score <= el + 1               -- 초 (버틴 시간)
    when 'diff'     then p_score >= 15  and p_score <= 3600   and el >= 15                        -- 초 (18건 대조, 오검출 패널티 포함)
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
